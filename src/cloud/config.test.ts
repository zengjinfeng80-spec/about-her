import { describe, expect, it } from 'vitest';
import { readCloudConfig } from './config';

describe('readCloudConfig', () => {
  it('只有 URL 和匿名密钥都存在时才启用云端', () => {
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'https://project.supabase.co' })).toBeNull();
    expect(readCloudConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })).toEqual({ url: 'https://project.supabase.co', anonKey: 'anon-key' });
  });
});
