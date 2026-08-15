import { describe, expect, it } from 'vitest';
import { groupClaims, selectCurrentClaims } from './claims';
import type { MemoryClaim } from './types';

const claim = (overrides: Partial<MemoryClaim>): MemoryClaim => ({
  id: crypto.randomUUID(),
  category: 'like',
  statement: '喜欢草莓味',
  evidenceLevel: 'explicit',
  reviewStatus: 'unreviewed',
  lifecycle: 'active',
  happenedAt: '2026-08-15T08:00:00.000Z',
  evidence: [],
  ...overrides,
});

describe('groupClaims', () => {
  it('只把未确认推测放进待确认区', () => {
    const result = groupClaims([
      claim({ id: 'explicit', evidenceLevel: 'explicit' }),
      claim({ id: 'pending', evidenceLevel: 'inferred' }),
      claim({ id: 'confirmed', evidenceLevel: 'inferred', reviewStatus: 'confirmed' }),
      claim({ id: 'rejected', evidenceLevel: 'inferred', reviewStatus: 'rejected' }),
    ]);

    expect(result.profile.map((item) => item.id)).toEqual(['explicit', 'confirmed']);
    expect(result.pending.map((item) => item.id)).toEqual(['pending']);
  });
});

describe('selectCurrentClaims', () => {
  it('冲突结论保留历史但只把较新版本视为当前', () => {
    const older = claim({ id: 'old', statement: '不喜欢咖啡', lifecycle: 'superseded', happenedAt: '2026-08-01T08:00:00.000Z' });
    const newer = claim({ id: 'new', statement: '最近喜欢拿铁', happenedAt: '2026-08-15T08:00:00.000Z' });

    expect(selectCurrentClaims([older, newer]).map((item) => item.id)).toEqual(['new']);
  });
});

