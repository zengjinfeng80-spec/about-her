import { describe, expect, it } from 'vitest';
import { extractResponseText, parseAnalysisPayload } from '../../supabase/functions/_shared/contracts';

describe('parseAnalysisPayload', () => {
  it('接受六类档案和明确/推测状态', () => {
    const result = parseAnalysisPayload({
      claims: [{ category: 'like', statement: '喜欢草莓', evidenceLevel: 'explicit', evidenceQuote: '我喜欢草莓', happenedAt: '2026-08-15T08:00:00.000Z' }],
    });
    expect(result.claims[0].category).toBe('like');
  });

  it('拒绝照片表情类无依据推断', () => {
    expect(() => parseAnalysisPayload({
      claims: [{ category: 'personality', statement: '她看起来不开心', evidenceLevel: 'inferred', evidenceQuote: '', happenedAt: '2026-08-15T08:00:00.000Z' }],
    })).toThrow('AI 返回了不支持的档案类别');
  });

  it('保留图片识别文字并校验附件标识', () => {
    expect(parseAnalysisPayload({ claims: [], attachments: [{ attachmentId: 'image-1', text: '饮料杯标签写着草莓' }] }).attachments)
      .toEqual([{ attachmentId: 'image-1', text: '饮料杯标签写着草莓' }]);
    expect(() => parseAnalysisPayload({ claims: [], attachments: [{ text: '缺少标识' }] })).toThrow('AI 返回了无效附件识别结果');
  });

  it('从 Responses API 原始输出中提取结构化文本', () => {
    expect(extractResponseText({ output: [{ content: [{ type: 'output_text', text: '{"claims":[]}' }] }] }))
      .toBe('{"claims":[]}');
    expect(() => extractResponseText({ output: [] })).toThrow('AI 没有返回可用内容');
  });
});
