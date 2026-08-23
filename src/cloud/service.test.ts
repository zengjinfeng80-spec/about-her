import { describe, expect, it, vi } from 'vitest';
import { buildStoragePath, parseAskResponse, SupabaseMemoryService } from './service';

describe('cloud service helpers', () => {
  it('媒体路径始终归属当前用户和记录', () => {
    expect(buildStoragePath('user-1', 'entry-1', 'photo one.jpg', 'attachment-1'))
      .toBe('user-1/entry-1/attachment-1-photo-one.jpg');
  });

  it('问答响应必须包含正文和可追溯引用', () => {
    expect(parseAskResponse({ answer: '她喜欢草莓。', citations: [{ claimId: 'claim-1', entryId: 'entry-1', quote: '喜欢草莓' }] }))
      .toEqual({ answer: '她喜欢草莓。', citations: [{ claimId: 'claim-1', entryId: 'entry-1', quote: '喜欢草莓' }] });
    expect(() => parseAskResponse({ answer: '没有引用', citations: 'bad' })).toThrow('问答服务返回格式无效');
  });

  it('保存记录时保持 idle 且不调度 AI', async () => {
    const entryId = '00000000-0000-4000-8000-000000000001';
    const insertEntry = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === 'entries') return {
        insert: insertEntry,
      };
      throw new Error(`保存记录后不应重新读取数据表：${table}`);
    });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from,
      functions: { invoke },
      storage: { from: vi.fn() },
    };
    const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue(entryId);

    const service = new SupabaseMemoryService(client as never);
    const result = await service.createEntry({ content: ' 原始记录 ', happenedAt: '2026-08-16T08:00:00.000Z', files: [] });

    expect(insertEntry).toHaveBeenCalledWith(expect.objectContaining({ analysis_status: 'idle' }));
    expect(from).not.toHaveBeenCalledWith('analysis_jobs');
    expect(invoke).not.toHaveBeenCalled();
    expect(result.content).toBe('原始记录');
    expect(result.analysisStatus).toBe('idle');
    randomUUID.mockRestore();
  });

  it('多个媒体会并行上传并返回本次附件', async () => {
    const insertEntry = vi.fn().mockResolvedValue({ error: null });
    const insertAttachment = vi.fn().mockResolvedValue({ error: null });
    const started: string[] = [];
    let releaseFirst!: () => void;
    const firstUpload = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const upload = vi.fn()
      .mockImplementationOnce(async (path: string) => { started.push(path); await firstUpload; return { error: null }; })
      .mockImplementationOnce(async (path: string) => { started.push(path); releaseFirst(); return { error: null }; });
    const storageFrom = vi.fn(() => ({
      upload,
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/media' } }),
    }));
    const from = vi.fn((table: string) => {
      if (table === 'entries') return { insert: insertEntry };
      if (table === 'attachments') return { insert: insertAttachment };
      throw new Error(`不应访问数据表：${table}`);
    });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from,
      storage: { from: storageFrom },
    };
    const randomUUID = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003');

    const service = new SupabaseMemoryService(client as never);
    const result = await service.createEntry({
      content: '带媒体的记录', happenedAt: '2026-08-16T08:00:00.000Z',
      files: [new File(['one'], 'one.jpg', { type: 'image/jpeg' }), new File(['two'], 'two.webm', { type: 'audio/webm' })],
    });

    expect(started).toHaveLength(2);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(insertAttachment).toHaveBeenCalledTimes(2);
    expect(result.attachments).toHaveLength(2);
    randomUUID.mockRestore();
  });

  it('媒体签名 URL 可以在基础档案之后单独补齐', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/later' } });
    const service = new SupabaseMemoryService({ storage: { from: vi.fn(() => ({ createSignedUrl })) } } as never);
    const snapshot = {
      profileName: '雪梨',
      entries: [{
        id: 'entry-1', content: '记录', happenedAt: '2026-08-16T08:00:00.000Z', createdAt: '2026-08-16T08:00:01.000Z',
        revision: 1, analysisStatus: 'idle' as const,
        attachments: [{ id: 'attachment-1', kind: 'image' as const, name: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 10, storagePath: 'user/entry/photo.jpg' }],
      }],
      claims: [],
    };

    const result = await service.loadMediaUrls(snapshot);

    expect(createSignedUrl).toHaveBeenCalledWith('user/entry/photo.jpg', 3600);
    expect(result.entries[0].attachments[0].url).toBe('https://signed.example/later');
  });

  it('手动入档时写入已确认档案和原始依据且不调用 AI', async () => {
    const claimId = '00000000-0000-4000-8000-000000000010';
    const evidenceId = '00000000-0000-4000-8000-000000000011';
    const insertClaim = vi.fn().mockResolvedValue({ error: null });
    const insertEvidence = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === 'claims') return { insert: insertClaim };
      if (table === 'claim_evidence') return { insert: insertEvidence };
      throw new Error(`不应访问数据表：${table}`);
    });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from,
      functions: { invoke },
    };
    const randomUUID = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(claimId)
      .mockReturnValueOnce(evidenceId);

    const service = new SupabaseMemoryService(client as never);
    const result = await service.createManualClaim({
      entryId: 'entry-1', entryRevision: 1,
      entryContent: '她说喜欢草莓，也不喜欢椰奶。',
      happenedAt: '2026-08-17T08:00:00.000Z',
      category: 'like', statement: '喜欢草莓',
    });

    expect(insertClaim).toHaveBeenCalledWith({
      id: claimId, user_id: 'user-1', category: 'like', statement: '喜欢草莓',
      evidence_level: 'explicit', review_status: 'confirmed', lifecycle: 'active',
      happened_at: '2026-08-17T08:00:00.000Z', source_entry_id: 'entry-1', source_revision: 1,
    });
    expect(insertEvidence).toHaveBeenCalledWith({
      id: evidenceId, user_id: 'user-1', claim_id: claimId, entry_id: 'entry-1',
      attachment_id: null, quote: '她说喜欢草莓，也不喜欢椰奶。',
    });
    expect(result).toEqual(expect.objectContaining({
      id: claimId, category: 'like', statement: '喜欢草莓',
      evidenceLevel: 'explicit', reviewStatus: 'confirmed', lifecycle: 'active',
      evidence: [{ entryId: 'entry-1', quote: '她说喜欢草莓，也不喜欢椰奶。' }],
    }));
    expect(invoke).not.toHaveBeenCalled();
    randomUUID.mockRestore();
  });

  it('档案依据关联失败时清理刚创建的档案', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteClaim = vi.fn().mockReturnValue({ eq: deleteEq });
    const insertClaim = vi.fn().mockResolvedValue({ error: null });
    const insertEvidence = vi.fn().mockResolvedValue({ error: { message: '关联写入失败' } });
    const from = vi.fn((table: string) => {
      if (table === 'claims') return { insert: insertClaim, delete: deleteClaim };
      if (table === 'claim_evidence') return { insert: insertEvidence };
      throw new Error(`不应访问数据表：${table}`);
    });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from,
    };
    const randomUUID = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000020')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000021');
    const service = new SupabaseMemoryService(client as never);

    await expect(service.createManualClaim({
      entryId: 'entry-1', entryRevision: 1, entryContent: '',
      happenedAt: '2026-08-17T08:00:00.000Z', category: 'wish', statement: '想看夜场电影',
    })).rejects.toThrow('档案关联失败：关联写入失败');
    expect(deleteEq).toHaveBeenCalledWith('id', '00000000-0000-4000-8000-000000000020');
    randomUUID.mockRestore();
  });
});
