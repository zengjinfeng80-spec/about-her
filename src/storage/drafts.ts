import type { ClaimCategory } from '../domain/types';

export interface MemoryDraft {
  id: string;
  content: string;
  happenedAt: string;
  createdAt: string;
  category?: ClaimCategory;
  files: File[];
}

export interface StoredDraft extends Omit<MemoryDraft, 'files'> {
  files: Array<{
    name: string;
    type: string;
    size: number;
    data: Blob;
  }>;
}

const DATABASE_NAME = 'about-her-drafts';
const STORE_NAME = 'drafts';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveDraft(draft: MemoryDraft) {
  const stored: StoredDraft = {
    ...draft,
    files: draft.files.map((file) => ({ name: file.name, type: file.type, size: file.size, data: file })),
  };
  await transact('readwrite', (store) => store.put(stored));
}

export async function listDrafts() {
  const drafts = await transact<StoredDraft[]>('readonly', (store) => store.getAll());
  return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removeDraft(id: string) {
  await transact('readwrite', (store) => store.delete(id));
}

export async function clearDrafts() {
  await transact('readwrite', (store) => store.clear());
}
