import type { MemoryClaim } from './types';

export function selectCurrentClaims(claims: MemoryClaim[]) {
  return claims
    .filter((claim) => claim.lifecycle === 'active' && claim.reviewStatus !== 'rejected')
    .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));
}

export function groupClaims(claims: MemoryClaim[]) {
  const current = selectCurrentClaims(claims);
  return {
    profile: current.filter((claim) => claim.evidenceLevel === 'explicit' || claim.reviewStatus === 'confirmed'),
    pending: current.filter((claim) => claim.evidenceLevel === 'inferred' && claim.reviewStatus === 'unreviewed'),
  };
}

