const NETWORK_HINTS = [
  'failed to fetch',
  'fetch failed',
  'load failed',
  'networkerror',
  'network request failed',
  'network connection lost',
  'err_internet_disconnected',
  'authretryablefetcherror',
  'econnrefused',
  'enotfound',
  'etimedout',
];

const RATE_LIMIT_HINTS = ['rate limit', 'too many requests'];

export function toFriendlyMessage(reason: unknown, fallback: string) {
  const raw = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
  const message = raw.trim();
  if (!message) return fallback;
  const normalized = message.toLowerCase();
  if (NETWORK_HINTS.some((hint) => normalized.includes(hint))) return '后端连接失败，请稍后重试';
  if (RATE_LIMIT_HINTS.some((hint) => normalized.includes(hint))) return '操作过于频繁，请等几分钟再试';
  return message;
}
