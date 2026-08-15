import { createClient } from '@supabase/supabase-js';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TEST_USER_A_EMAIL', 'TEST_USER_A_PASSWORD', 'TEST_USER_B_EMAIL', 'TEST_USER_B_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`缺少环境变量：${key}`);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const clientA = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, options);
const clientB = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, options);
const anonymous = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, options);

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`测试账号登录失败：${error?.message ?? email}`);
  return data.user;
}

const userA = await signIn(clientA, process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_A_PASSWORD);
await signIn(clientB, process.env.TEST_USER_B_EMAIL, process.env.TEST_USER_B_PASSWORD);
const entryId = crypto.randomUUID();
const storagePath = `${userA.id}/${entryId}/isolation-proof.png`;

try {
  const { error: insertError } = await clientA.from('entries').insert({
    id: entryId, user_id: userA.id, content: 'RLS 隔离测试', happened_at: new Date().toISOString(), revision: 1,
  });
  if (insertError) throw insertError;
  const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const { error: uploadError } = await clientA.storage.from('memory-media').upload(storagePath, onePixelPng, { contentType: 'image/png' });
  if (uploadError) throw uploadError;

  const { data: visibleToB, error: selectError } = await clientB.from('entries').select('id').eq('id', entryId);
  if (selectError) throw selectError;
  if (visibleToB?.length) throw new Error('RLS 失败：账号 B 看到了账号 A 的记录');
  const { data: privateMedia } = await clientB.storage.from('memory-media').download(storagePath);
  if (privateMedia) throw new Error('存储策略失败：账号 B 读取了账号 A 的私有媒体');

  const { error: ownerFunctionError } = await clientB.functions.invoke('analyze-entry', { body: { entryId, revision: 1 } });
  if (!ownerFunctionError) throw new Error('Edge Function 越权测试失败：账号 B 可分析账号 A 的记录');
  const { error: anonymousFunctionError } = await anonymous.functions.invoke('ask-memory', { body: { question: '她喜欢什么？' } });
  if (!anonymousFunctionError) throw new Error('Edge Function 未登录测试失败');
  console.log('通过：数据库 RLS、私有存储、跨账号 Edge Function 和未登录调用均被拒绝。');
} finally {
  await clientA.storage.from('memory-media').remove([storagePath]);
  await clientA.from('entries').delete().eq('id', entryId);
  await clientA.auth.signOut();
  await clientB.auth.signOut();
}
