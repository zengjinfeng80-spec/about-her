import { extractResponseText } from './contracts.ts';
import { fetchWithTimeout } from './http.ts';

function apiKey() {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OpenAI 服务端密钥未配置');
  return key;
}

export function requiredModel(name: string) {
  const model = Deno.env.get(name);
  if (!model) throw new Error(`服务端模型变量 ${name} 未配置`);
  return model;
}

export async function transcribeAudio(blob: Blob, filename: string) {
  const form = new FormData();
  form.append('file', new File([blob], filename, { type: blob.type || 'audio/webm' }));
  form.append('model', requiredModel('OPENAI_TRANSCRIPTION_MODEL'));
  const response = await fetchWithTimeout('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey()}` }, body: form,
  });
  if (!response.ok) throw new Error(`语音转写失败：${response.status} ${await response.text()}`);
  const data = await response.json() as { text?: unknown };
  if (typeof data.text !== 'string') throw new Error('语音转写没有返回文字');
  return data.text;
}

export async function structuredResponse(options: {
  modelEnv: string;
  instructions: string;
  content: Array<Record<string, unknown>>;
  schemaName: string;
  schema: Record<string, unknown>;
}) {
  const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: requiredModel(options.modelEnv),
      instructions: options.instructions,
      input: [{ role: 'user', content: options.content }],
      text: { format: { type: 'json_schema', name: options.schemaName, strict: true, schema: options.schema } },
    }),
  });
  if (!response.ok) throw new Error(`AI 请求失败：${response.status} ${await response.text()}`);
  return JSON.parse(extractResponseText(await response.json())) as unknown;
}
