import type { ClaimCategory, MemorySnapshot } from './types';

const CATEGORY_LABELS: Record<ClaimCategory, string> = {
  like: '喜欢',
  dislike: '不喜欢',
  quote: '她说过的话',
  important: '重要的人与事',
  boundary: '习惯与边界',
  wish: '愿望',
};

export function buildMarkdownExport(snapshot: MemorySnapshot) {
  const lines = ['# 雪梨', '', `导出时间：${new Date().toLocaleString('zh-CN')}`, ''];

  for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
    const claims = snapshot.claims.filter((claim) => claim.category === category && claim.reviewStatus !== 'rejected');
    if (!claims.length) continue;
    lines.push(`## ${label}`, '');
    for (const claim of claims) {
      const marker = claim.evidenceLevel === 'inferred' && claim.reviewStatus !== 'confirmed' ? '（待确认）' : '';
      lines.push(`- ${claim.statement}${marker}`);
    }
    lines.push('');
  }

  lines.push('## 原始记录', '');
  for (const entry of [...snapshot.entries].sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))) {
    lines.push(`### ${new Date(entry.happenedAt).toLocaleString('zh-CN')}`, '', entry.content || '（仅包含媒体）', '');
  }
  return lines.join('\n');
}

export function buildJsonExport(snapshot: MemorySnapshot) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...snapshot }, null, 2);
}
