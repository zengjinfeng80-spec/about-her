import { describe, expect, it } from 'vitest';
import { buildMarkdownExport } from './export';
import type { MemorySnapshot } from './types';

describe('buildMarkdownExport', () => {
  it('导出档案结论和来源记录', () => {
    const snapshot: MemorySnapshot = {
      profileName: '她',
      entries: [{
        id: 'entry-1',
        content: '她说喜欢草莓味，但不爱太甜。',
        happenedAt: '2026-08-15T08:00:00.000Z',
        createdAt: '2026-08-15T08:00:00.000Z',
        revision: 1,
        analysisStatus: 'completed',
        attachments: [],
      }],
      claims: [{
        id: 'claim-1',
        category: 'like',
        statement: '喜欢草莓味，但不爱太甜',
        evidenceLevel: 'explicit',
        reviewStatus: 'confirmed',
        lifecycle: 'active',
        happenedAt: '2026-08-15T08:00:00.000Z',
        evidence: [{ entryId: 'entry-1', quote: '喜欢草莓味，但不爱太甜' }],
      }],
    };

    const markdown = buildMarkdownExport(snapshot);
    expect(markdown).toContain('# 关于她');
    expect(markdown).toContain('## 喜欢');
    expect(markdown).toContain('喜欢草莓味，但不爱太甜');
    expect(markdown).toContain('她说喜欢草莓味，但不爱太甜。');
  });
});

