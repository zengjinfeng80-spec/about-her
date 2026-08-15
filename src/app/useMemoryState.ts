import { useEffect, useState } from 'react';
import type { MemorySnapshot } from '../domain/types';

const STORAGE_KEY = 'about-her-memory';

function loadSnapshot(fallback: MemorySnapshot) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as MemorySnapshot : fallback;
  } catch {
    return fallback;
  }
}

export function useMemoryState(initialSnapshot: MemorySnapshot, persist: boolean) {
  const [snapshot, setSnapshot] = useState(() => persist ? loadSnapshot(initialSnapshot) : initialSnapshot);

  useEffect(() => {
    if (persist) localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [persist, snapshot]);

  return [snapshot, setSnapshot] as const;
}

