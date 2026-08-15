import { requireUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { structuredResponse } from '../_shared/openai.ts';

const answerSchema = {
  type: 'object', additionalProperties: false, required: ['answer', 'citations'],
  properties: {
    answer: { type: 'string' },
    citations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claimId', 'entryId', 'quote'], properties: { claimId: { type: 'string' }, entryId: { type: 'string' }, quote: { type: ['string', 'null'] } } } },
  },
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return errorResponse(new Error('只支持 POST'), 405);
  try {
    const { client } = await requireUser(request);
    const body = await request.json() as { question?: unknown };
    if (typeof body.question !== 'string' || !body.question.trim() || body.question.length > 1000) throw new Error('问题不能为空且不能超过 1000 字');
    const [{ data: claims, error: claimError }, { data: evidence, error: evidenceError }, { data: entries, error: entryError }] = await Promise.all([
      client.from('claims').select('id, category, statement, evidence_level, review_status, lifecycle, happened_at').eq('lifecycle', 'active').neq('review_status', 'rejected'),
      client.from('claim_evidence').select('claim_id, entry_id, quote'),
      client.from('entries').select('id, content, happened_at'),
    ]);
    if (claimError || evidenceError || entryError) throw new Error(claimError?.message || evidenceError?.message || entryError?.message);
    const context = { claims: claims ?? [], evidence: evidence ?? [], entries: entries ?? [] };
    const result = await structuredResponse({
      modelEnv: 'OPENAI_ASK_MODEL', schemaName: 'about_her_answer', schema: answerSchema,
      instructions: '只根据给定档案和原始证据回答。不能扮演她，不能补充常识猜测。推测只有 review_status=confirmed 时才可当作已确认信息。证据不足时明确回答“现有记录不足，暂时不能判断”。每个事实必须引用真实 claimId 和 entryId。回答使用简洁中文。',
      content: [{ type: 'input_text', text: `问题：${body.question.trim()}\n可用资料：${JSON.stringify(context)}` }],
    }) as { answer?: unknown; citations?: unknown };
    if (typeof result.answer !== 'string' || !Array.isArray(result.citations)) throw new Error('问答服务返回格式无效');
    const claimIds = new Set((claims ?? []).map((item) => item.id));
    const entryIds = new Set((entries ?? []).map((item) => item.id));
    const citations = result.citations.filter((item): item is { claimId: string; entryId: string; quote?: string | null } => Boolean(item && typeof item === 'object' && typeof (item as { claimId?: unknown }).claimId === 'string' && typeof (item as { entryId?: unknown }).entryId === 'string'));
    if (citations.some((item) => !claimIds.has(item.claimId) || !entryIds.has(item.entryId))) throw new Error('问答返回了不存在的引用');
    return json({ answer: result.answer, citations });
  } catch (error) { return errorResponse(error); }
});
