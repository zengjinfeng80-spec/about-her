import { describe, expect, it } from 'vitest';
import { rowsToSnapshot } from './mappers';

describe('rowsToSnapshot', () => {
  it('把云端记录、附件、结论和依据组合为应用快照', () => {
    const snapshot = rowsToSnapshot({
      profile: { display_name: '她', avatar_path: null },
      entries: [{ id: 'entry-1', content: '她说喜欢草莓。', happened_at: '2026-08-15T08:00:00.000Z', created_at: '2026-08-15T08:01:00.000Z', revision: 1, analysis_status: 'completed', analysis_error: null }],
      attachments: [{ id: 'attachment-1', entry_id: 'entry-1', kind: 'audio', original_name: 'voice.webm', mime_type: 'audio/webm', size_bytes: 1024, storage_path: 'user/entry/voice.webm', transcript: '喜欢草莓', duration_seconds: 3, signed_url: 'https://signed.example/voice' }],
      claims: [{ id: 'claim-1', category: 'like', statement: '喜欢草莓', evidence_level: 'explicit', review_status: 'confirmed', lifecycle: 'active', happened_at: '2026-08-15T08:00:00.000Z' }],
      evidence: [{ claim_id: 'claim-1', entry_id: 'entry-1', attachment_id: 'attachment-1', quote: '喜欢草莓' }],
    });

    expect(snapshot.profileName).toBe('她');
    expect(snapshot.entries[0].attachments[0].url).toBe('https://signed.example/voice');
    expect(snapshot.claims[0].evidence[0]).toEqual({ entryId: 'entry-1', attachmentId: 'attachment-1', quote: '喜欢草莓' });
  });
});

