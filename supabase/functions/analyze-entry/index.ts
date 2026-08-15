import { parseAnalysisPayload } from '../_shared/contracts.ts';
import { requireUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { structuredResponse, transcribeAudio } from '../_shared/openai.ts';

const analysisSchema = {
  type: 'object', additionalProperties: false, required: ['claims', 'attachments'],
  properties: {
    claims: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['category', 'statement', 'evidenceLevel', 'evidenceQuote', 'happenedAt', 'attachmentId', 'supersedesClaimId'], properties: {
      category: { type: 'string', enum: ['like', 'dislike', 'quote', 'important', 'boundary', 'wish'] },
      statement: { type: 'string' }, evidenceLevel: { type: 'string', enum: ['explicit', 'inferred'] },
      evidenceQuote: { type: 'string' }, happenedAt: { type: 'string' },
      attachmentId: { type: ['string', 'null'] }, supersedesClaimId: { type: ['string', 'null'] },
    } } },
    attachments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['attachmentId', 'text'], properties: { attachmentId: { type: 'string' }, text: { type: 'string' } } } },
  },
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return errorResponse(new Error('只支持 POST'), 405);
  let client: Awaited<ReturnType<typeof requireUser>>['client'] | undefined;
  let entryId = '';
  let revision = 0;
  try {
    ({ client } = await requireUser(request));
    const body = await request.json() as { entryId?: unknown; revision?: unknown };
    if (typeof body.entryId !== 'string' || !Number.isInteger(body.revision) || Number(body.revision) < 1) throw new Error('entryId 或 revision 无效');
    entryId = body.entryId; revision = Number(body.revision);

    const { data: claimed, error: claimError } = await client.rpc('claim_analysis_job', { p_entry_id: entryId, p_revision: revision });
    if (claimError) throw new Error(claimError.message);
    if (!claimed) {
      const { data: existing } = await client.from('analysis_jobs').select('status').eq('entry_id', entryId).eq('revision', revision).maybeSingle();
      if (!existing) return errorResponse(new Error('记录不存在或无权访问'), 404);
      return json({ status: existing.status, duplicate: true });
    }
    await client.from('entries').update({ analysis_status: 'processing', analysis_error: null }).eq('id', entryId).eq('revision', revision);

    const [{ data: entry, error: entryError }, { data: attachments, error: attachmentsError }, { data: activeClaims, error: claimsError }] = await Promise.all([
      client.from('entries').select('id, content, happened_at, revision').eq('id', entryId).eq('revision', revision).single(),
      client.from('attachments').select('id, kind, original_name, mime_type, storage_path').eq('entry_id', entryId),
      client.from('claims').select('id, category, statement, happened_at').eq('lifecycle', 'active').neq('source_entry_id', entryId),
    ]);
    if (entryError || attachmentsError || claimsError) throw new Error(entryError?.message || attachmentsError?.message || claimsError?.message);

    const transcripts: Record<string, string> = {};
    const content: Array<Record<string, unknown>> = [];
    for (const attachment of attachments ?? []) {
      const { data: signed, error: signedError } = await client.storage.from('memory-media').createSignedUrl(attachment.storage_path, 300);
      if (signedError || !signed?.signedUrl) throw new Error(`无法读取私有媒体：${signedError?.message ?? attachment.id}`);
      if (attachment.kind === 'audio') {
        const mediaResponse = await fetch(signed.signedUrl);
        if (!mediaResponse.ok) throw new Error('无法读取待转写语音');
        transcripts[attachment.id] = await transcribeAudio(await mediaResponse.blob(), attachment.original_name);
      } else {
        content.push({ type: 'input_image', image_url: signed.signedUrl, detail: 'auto' });
      }
    }

    const prompt = `原始记录发生时间：${entry.happened_at}\n原文：${entry.content || '（无文字）'}\n语音转写：${JSON.stringify(transcripts)}\n图片附件标识：${JSON.stringify((attachments ?? []).filter((item) => item.kind === 'image').map((item) => item.id))}\n现有有效档案（仅在确有新旧冲突时填写 supersedesClaimId）：${JSON.stringify(activeClaims ?? [])}`;
    content.unshift({ type: 'input_text', text: prompt });
    const raw = await structuredResponse({
      modelEnv: 'OPENAI_ANALYSIS_MODEL', schemaName: 'about_her_analysis', schema: analysisSchema, content,
      instructions: '你只整理用户提供的关于一个人的记录。提取喜欢、不喜欢、原话、重要的人与事、习惯与边界、愿望。明确说过或清晰可见的信息标 explicit；需要归纳的标 inferred。不得根据照片表情、长相或姿态推断性格、感情、态度或关系。statement 用简洁中文。evidenceQuote 必须来自原文、转写或图片可见文字。图片 attachments 只写客观可见文字或内容。没有依据就不要生成。',
    });
    const parsed = parseAnalysisPayload(raw);
    const ocr = Object.fromEntries(parsed.attachments.map((item) => [item.attachmentId, item.text]));
    const { error: applyError } = await client.rpc('apply_entry_analysis', { p_entry_id: entryId, p_revision: revision, p_claims: parsed.claims, p_transcripts: transcripts, p_ocr: ocr });
    if (applyError) throw new Error(applyError.message);
    return json({ status: 'completed', claims: parsed.claims.length });
  } catch (error) {
    if (client && entryId && revision) {
      const message = error instanceof Error ? error.message.slice(0, 2000) : '分析失败';
      await Promise.all([
        client.from('analysis_jobs').update({ status: 'failed', error: message, completed_at: new Date().toISOString() }).eq('entry_id', entryId).eq('revision', revision),
        client.from('entries').update({ analysis_status: 'failed', analysis_error: message }).eq('id', entryId).eq('revision', revision),
      ]);
    }
    return errorResponse(error);
  }
});
