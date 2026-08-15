import type { MemorySnapshot } from '../domain/types';

export const EMPTY_SNAPSHOT: MemorySnapshot = {
  profileName: '她',
  entries: [],
  claims: [],
};

export const DEMO_SNAPSHOT: MemorySnapshot = {
  profileName: '她',
  entries: [
    {
      id: 'demo-entry-1',
      content: '她说喜欢草莓味，但不爱太甜，芒果可以，不过不要放椰奶。',
      happenedAt: '2026-08-14T19:20:00.000Z',
      createdAt: '2026-08-14T19:21:00.000Z',
      revision: 1,
      analysisStatus: 'completed',
      attachments: [],
    },
    {
      id: 'demo-entry-2',
      content: '她周末想找一个安静的地方走走，不想临时改变已经约好的安排。',
      happenedAt: '2026-08-12T12:30:00.000Z',
      createdAt: '2026-08-12T12:31:00.000Z',
      revision: 1,
      analysisStatus: 'completed',
      attachments: [],
    },
  ],
  claims: [
    { id: 'demo-like-1', category: 'like', statement: '喜欢草莓味，但不爱太甜', evidenceLevel: 'explicit', reviewStatus: 'confirmed', lifecycle: 'active', happenedAt: '2026-08-14T19:20:00.000Z', evidence: [{ entryId: 'demo-entry-1', quote: '喜欢草莓味，但不爱太甜' }] },
    { id: 'demo-dislike-1', category: 'dislike', statement: '不喜欢椰奶', evidenceLevel: 'explicit', reviewStatus: 'unreviewed', lifecycle: 'active', happenedAt: '2026-08-14T19:20:00.000Z', evidence: [{ entryId: 'demo-entry-1', quote: '不要放椰奶' }] },
    { id: 'demo-wish-1', category: 'wish', statement: '周末想找安静的地方走走', evidenceLevel: 'explicit', reviewStatus: 'unreviewed', lifecycle: 'active', happenedAt: '2026-08-12T12:30:00.000Z', evidence: [{ entryId: 'demo-entry-2' }] },
    { id: 'demo-boundary-1', category: 'boundary', statement: '可能不喜欢临时改变计划', evidenceLevel: 'inferred', reviewStatus: 'unreviewed', lifecycle: 'active', happenedAt: '2026-08-12T12:30:00.000Z', evidence: [{ entryId: 'demo-entry-2' }] },
  ],
};

