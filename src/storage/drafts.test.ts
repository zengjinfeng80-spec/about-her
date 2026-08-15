import { beforeEach, describe, expect, it } from 'vitest';
import { clearDrafts, listDrafts, removeDraft, saveDraft } from './drafts';

describe('drafts', () => {
  beforeEach(async () => clearDrafts());

  it('保存并读取包含媒体引用的离线草稿', async () => {
    await saveDraft({
      id: 'draft-1',
      content: '她说想去看夜场电影。',
      happenedAt: '2026-08-15T20:00',
      createdAt: '2026-08-15T20:01:00.000Z',
      files: [new File(['audio'], 'voice.webm', { type: 'audio/webm' })],
    });

    const drafts = await listDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].content).toBe('她说想去看夜场电影。');
    expect(drafts[0].files[0].name).toBe('voice.webm');
  });

  it('提交成功后删除草稿', async () => {
    await saveDraft({ id: 'draft-1', content: '一条草稿', happenedAt: '', createdAt: '', files: [] });
    await removeDraft('draft-1');
    expect(await listDrafts()).toEqual([]);
  });
});

