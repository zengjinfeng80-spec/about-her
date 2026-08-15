import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemoryClaim, MemoryEntry, MemorySnapshot, ReviewStatus } from '../domain/types';
import { rowsToSnapshot } from './mappers';

export interface CreateEntryInput {
  content: string;
  happenedAt: string;
  files: File[];
}

export interface MemoryCitation {
  claimId: string;
  entryId: string;
  quote?: string;
}

export interface MemoryAnswer {
  answer: string;
  citations: MemoryCitation[];
}

export interface MemoryService {
  loadSnapshot(): Promise<MemorySnapshot>;
  createEntry(input: CreateEntryInput): Promise<MemoryEntry>;
  updateClaim(id: string, reviewStatus: ReviewStatus): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  retryAnalysis(entryId: string, revision: number): Promise<void>;
  askMemory(question: string): Promise<MemoryAnswer>;
  deleteAccount(): Promise<void>;
}

function assertData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('云端没有返回数据');
  return data;
}

function safeFilename(name: string) {
  const normalized = name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'media';
}

export function buildStoragePath(userId: string, entryId: string, filename: string, attachmentId: string) {
  return `${userId}/${entryId}/${attachmentId}-${safeFilename(filename)}`;
}

export function parseAskResponse(value: unknown): MemoryAnswer {
  if (!value || typeof value !== 'object') throw new Error('问答服务返回格式无效');
  const response = value as Record<string, unknown>;
  if (typeof response.answer !== 'string' || !Array.isArray(response.citations)) throw new Error('问答服务返回格式无效');
  const citations = response.citations.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('问答服务返回格式无效');
    const citation = item as Record<string, unknown>;
    if (typeof citation.claimId !== 'string' || typeof citation.entryId !== 'string') throw new Error('问答服务返回格式无效');
    return { claimId: citation.claimId, entryId: citation.entryId, quote: typeof citation.quote === 'string' ? citation.quote : undefined };
  });
  return { answer: response.answer, citations };
}

export class SupabaseMemoryService implements MemoryService {
  constructor(private readonly client: SupabaseClient) {}

  private async userId() {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error('登录已失效，请重新登录');
    return data.user.id;
  }

  async loadSnapshot(): Promise<MemorySnapshot> {
    const [profileResult, entriesResult, attachmentsResult, claimsResult, evidenceResult] = await Promise.all([
      this.client.from('profiles').select('display_name, avatar_path').maybeSingle(),
      this.client.from('entries').select('id, content, happened_at, created_at, revision, analysis_status, analysis_error').order('happened_at', { ascending: false }),
      this.client.from('attachments').select('id, entry_id, kind, original_name, mime_type, size_bytes, storage_path, transcript, duration_seconds'),
      this.client.from('claims').select('id, category, statement, evidence_level, review_status, lifecycle, happened_at').order('happened_at', { ascending: false }),
      this.client.from('claim_evidence').select('claim_id, entry_id, attachment_id, quote'),
    ]);
    if (profileResult.error) throw new Error(profileResult.error.message);
    const entries = assertData(entriesResult.data, entriesResult.error);
    const attachments = assertData(attachmentsResult.data, attachmentsResult.error);
    const claims = assertData(claimsResult.data, claimsResult.error);
    const evidence = assertData(evidenceResult.data, evidenceResult.error);
    const signed = await Promise.all(attachments.map(async (attachment) => {
      const { data } = await this.client.storage.from('memory-media').createSignedUrl(attachment.storage_path, 3600);
      return { ...attachment, signed_url: data?.signedUrl ?? null };
    }));
    return rowsToSnapshot({ profile: profileResult.data, entries, attachments: signed, claims, evidence });
  }

  async createEntry(input: CreateEntryInput): Promise<MemoryEntry> {
    const userId = await this.userId();
    const entryId = crypto.randomUUID();
    const { error: entryError } = await this.client.from('entries').insert({
      id: entryId, user_id: userId, content: input.content.trim(), happened_at: input.happenedAt,
      revision: 1, analysis_status: 'queued',
    });
    if (entryError) throw new Error(entryError.message);

    try {
      for (const file of input.files) {
        const attachmentId = crypto.randomUUID();
        const storagePath = buildStoragePath(userId, entryId, file.name, attachmentId);
        const { error: uploadError } = await this.client.storage.from('memory-media').upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(`媒体上传失败：${uploadError.message}`);
        const { error: attachmentError } = await this.client.from('attachments').insert({
          id: attachmentId, user_id: userId, entry_id: entryId,
          kind: file.type.startsWith('image/') ? 'image' : 'audio', original_name: file.name,
          mime_type: file.type, size_bytes: file.size, storage_path: storagePath,
        });
        if (attachmentError) {
          await this.client.storage.from('memory-media').remove([storagePath]);
          throw new Error(`媒体信息写入失败：${attachmentError.message}`);
        }
      }
      const { error: jobError } = await this.client.from('analysis_jobs').upsert({ user_id: userId, entry_id: entryId, revision: 1, status: 'queued' }, { onConflict: 'entry_id,revision' });
      if (jobError) throw new Error(`分析任务创建失败：${jobError.message}`);
      const { error: invokeError } = await this.client.functions.invoke('analyze-entry', { body: { entryId, revision: 1 } });
      if (invokeError) throw new Error(`自动分析暂时失败：${invokeError.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '自动分析暂时失败';
      await Promise.all([
        this.client.from('entries').update({ analysis_status: 'failed', analysis_error: message }).eq('id', entryId),
        this.client.from('analysis_jobs').update({ status: 'failed', error: message }).eq('entry_id', entryId).eq('revision', 1),
      ]);
    }
    const snapshot = await this.loadSnapshot();
    const entry = snapshot.entries.find((item) => item.id === entryId);
    if (!entry) throw new Error('记录已保存，但刷新失败');
    return entry;
  }

  async updateClaim(id: string, reviewStatus: ReviewStatus) {
    const { error } = await this.client.from('claims').update({ review_status: reviewStatus }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteEntry(id: string) {
    const { data, error } = await this.client.from('attachments').select('storage_path').eq('entry_id', id);
    if (error) throw new Error(error.message);
    const paths = (data ?? []).map((item) => item.storage_path);
    if (paths.length) {
      const { error: storageError } = await this.client.storage.from('memory-media').remove(paths);
      if (storageError) throw new Error(storageError.message);
    }
    const { error: deleteError } = await this.client.from('entries').delete().eq('id', id);
    if (deleteError) throw new Error(deleteError.message);
  }

  async retryAnalysis(entryId: string, revision: number) {
    const { error } = await this.client.functions.invoke('analyze-entry', { body: { entryId, revision } });
    if (error) throw new Error(error.message);
  }

  async askMemory(question: string) {
    const { data, error } = await this.client.functions.invoke('ask-memory', { body: { question } });
    if (error) throw new Error(error.message);
    return parseAskResponse(data);
  }

  async deleteAccount() {
    const { error } = await this.client.functions.invoke('delete-account');
    if (error) throw new Error(error.message);
  }
}
