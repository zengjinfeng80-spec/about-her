import { createClient } from 'npm:@supabase/supabase-js@2';

export function userClient(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) throw new Error('缺少登录凭证');
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  );
}

export function adminClient() {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) throw new Error('服务端删除权限未配置');
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, { auth: { persistSession: false } });
}

export async function requireUser(request: Request) {
  const client = userClient(request);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('登录已失效');
  return { client, user: data.user };
}
