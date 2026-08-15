import { describe, expect, it } from 'vitest';
import { buildStoragePath, parseAskResponse } from './service';

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
});
