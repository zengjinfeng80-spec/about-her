import type { AnalysisStatus, ClaimCategory, ClaimLifecycle, EvidenceLevel, MemorySnapshot, ReviewStatus } from '../domain/types';

interface CloudRows {
  profile: { display_name: string; avatar_path: string | null } | null;
  entries: Array<{ id: string; content: string; happened_at: string; created_at: string; revision: number; analysis_status: string; analysis_error: string | null }>;
  attachments: Array<{ id: string; entry_id: string; kind: 'image' | 'audio'; original_name: string; mime_type: string; size_bytes: number; storage_path: string; transcript: string | null; duration_seconds: number | null; signed_url?: string | null }>;
  claims: Array<{ id: string; category: string; statement: string; evidence_level: string; review_status: string; lifecycle: string; happened_at: string }>;
  evidence: Array<{ claim_id: string; entry_id: string; attachment_id: string | null; quote: string | null }>;
}

export function rowsToSnapshot(rows: CloudRows): MemorySnapshot {
  return {
    profileName: rows.profile?.display_name || '她',
    profileAvatar: rows.profile?.avatar_path ?? undefined,
    entries: rows.entries.map((entry) => ({
      id: entry.id,
      content: entry.content,
      happenedAt: entry.happened_at,
      createdAt: entry.created_at,
      revision: entry.revision,
      analysisStatus: entry.analysis_status as AnalysisStatus,
      analysisError: entry.analysis_error ?? undefined,
      attachments: rows.attachments.filter((attachment) => attachment.entry_id === entry.id).map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        name: attachment.original_name,
        mimeType: attachment.mime_type,
        sizeBytes: attachment.size_bytes,
        storagePath: attachment.storage_path,
        transcript: attachment.transcript ?? undefined,
        durationSeconds: attachment.duration_seconds ?? undefined,
        url: attachment.signed_url ?? undefined,
      })),
    })),
    claims: rows.claims.map((claim) => ({
      id: claim.id,
      category: claim.category as ClaimCategory,
      statement: claim.statement,
      evidenceLevel: claim.evidence_level as EvidenceLevel,
      reviewStatus: claim.review_status as ReviewStatus,
      lifecycle: claim.lifecycle as ClaimLifecycle,
      happenedAt: claim.happened_at,
      evidence: rows.evidence.filter((item) => item.claim_id === claim.id).map((item) => ({
        entryId: item.entry_id,
        attachmentId: item.attachment_id ?? undefined,
        quote: item.quote ?? undefined,
      })),
    })),
  };
}

