export interface CloudConfig {
  url: string;
  anonKey: string;
}

export function readCloudConfig(env: Record<string, string | boolean | undefined>): CloudConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  return typeof url === 'string' && typeof anonKey === 'string' && url && anonKey
    ? { url, anonKey }
    : null;
}
