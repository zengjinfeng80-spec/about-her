export const CLAIM_CATEGORIES = ['like', 'dislike', 'quote', 'important', 'boundary', 'wish'] as const;
export const EVIDENCE_LEVELS = ['explicit', 'inferred'] as const;

export interface AnalysisClaim {
  category: typeof CLAIM_CATEGORIES[number];
  statement: string;
  evidenceLevel: typeof EVIDENCE_LEVELS[number];
  evidenceQuote: string;
  happenedAt: string;
  attachmentId?: string;
  supersedesClaimId?: string;
}

export interface AnalysisPayload {
  claims: AnalysisClaim[];
  attachments: Array<{ attachmentId: string; text: string }>;
}

export function parseAnalysisPayload(value: unknown): AnalysisPayload {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { claims?: unknown }).claims)) {
    throw new Error('AI 返回的数据结构不完整');
  }
  const claims = (value as { claims: unknown[] }).claims.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('AI 返回了无效档案项');
    const claim = item as Record<string, unknown>;
    if (!CLAIM_CATEGORIES.includes(claim.category as AnalysisClaim['category'])) throw new Error('AI 返回了不支持的档案类别');
    if (!EVIDENCE_LEVELS.includes(claim.evidenceLevel as AnalysisClaim['evidenceLevel'])) throw new Error('AI 返回了无效证据等级');
    if (typeof claim.statement !== 'string' || !claim.statement.trim()) throw new Error('AI 返回了空结论');
    if (typeof claim.evidenceQuote !== 'string') throw new Error('AI 返回的依据摘录无效');
    if (typeof claim.happenedAt !== 'string' || Number.isNaN(Date.parse(claim.happenedAt))) throw new Error('AI 返回的发生时间无效');
    return {
      category: claim.category as AnalysisClaim['category'],
      statement: claim.statement.trim(),
      evidenceLevel: claim.evidenceLevel as AnalysisClaim['evidenceLevel'],
      evidenceQuote: claim.evidenceQuote.trim(),
      happenedAt: claim.happenedAt,
      attachmentId: typeof claim.attachmentId === 'string' ? claim.attachmentId : undefined,
      supersedesClaimId: typeof claim.supersedesClaimId === 'string' ? claim.supersedesClaimId : undefined,
    };
  });
  const rawAttachments = (value as { attachments?: unknown }).attachments ?? [];
  if (!Array.isArray(rawAttachments)) throw new Error('AI 返回了无效附件识别结果');
  const attachments = rawAttachments.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('AI 返回了无效附件识别结果');
    const attachment = item as Record<string, unknown>;
    if (typeof attachment.attachmentId !== 'string' || typeof attachment.text !== 'string') throw new Error('AI 返回了无效附件识别结果');
    return { attachmentId: attachment.attachmentId, text: attachment.text.trim() };
  });
  return { claims, attachments };
}

export function extractResponseText(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('AI 没有返回可用内容');
  const response = value as { output_text?: unknown; output?: unknown };
  if (typeof response.output_text === 'string' && response.output_text) return response.output_text;
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (!item || typeof item !== 'object' || !Array.isArray((item as { content?: unknown }).content)) continue;
      for (const content of (item as { content: unknown[] }).content) {
        if (content && typeof content === 'object' && (content as { type?: unknown }).type === 'output_text' && typeof (content as { text?: unknown }).text === 'string') {
          return (content as { text: string }).text;
        }
      }
    }
  }
  throw new Error('AI 没有返回可用内容');
}
