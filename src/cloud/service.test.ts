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
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{
              id: entryId,
              content: '原始记录',
              happened_at: '2026-08-16T08:00:00.000Z',
              created_at: '2026-08-16T08:00:01.000Z',
              revision: 1,
              analysis_status: 'idle',
              analysis_error: null,
            }],
            error: null,
          }),
        }),
      };
      if (table === 'profiles') return { select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
      if (table === 'attachments') return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      if (table === 'claims') return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      if (table === 'claim_evidence') return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      throw new Error(`不应访问数据表：${table}`);
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
    expect(result.analysisStatus).toBe('idle');
    randomUUID.mockRestore();
  });
});
