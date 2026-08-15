export type ClaimCategory = 'like' | 'dislike' | 'quote' | 'important' | 'boundary' | 'wish';
export type EvidenceLevel = 'explicit' | 'inferred';
export type ReviewStatus = 'unreviewed' | 'confirmed' | 'rejected';
export type ClaimLifecycle = 'active' | 'superseded';
export type AnalysisStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'unavailable';

export interface ClaimEvidence {
  entryId: string;
  attachmentId?: string;
  quote?: string;
}

export interface MemoryClaim {
  id: string;
  category: ClaimCategory;
  statement: string;
  evidenceLevel: EvidenceLevel;
  reviewStatus: ReviewStatus;
  lifecycle: ClaimLifecycle;
  happenedAt: string;
  evidence: ClaimEvidence[];
}

export interface MemoryAttachment {
  id: string;
  kind: 'image' | 'audio';
  name: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
  storagePath?: string;
  transcript?: string;
  durationSeconds?: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  happenedAt: string;
  createdAt: string;
  revision: number;
  analysisStatus: AnalysisStatus;
  analysisError?: string;
  attachments: MemoryAttachment[];
}

export interface MemorySnapshot {
  profileName: string;
  profileAvatar?: string;
  entries: MemoryEntry[];
  claims: MemoryClaim[];
}

