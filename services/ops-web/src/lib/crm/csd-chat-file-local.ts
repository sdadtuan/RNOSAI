import type { CsdAttachmentRow } from '@/lib/crm/csd-api';
import { fetchCsdFileBlob } from '@/lib/crm/csd-api';

const DB_NAME = 'csd-chat-files-v1';
const DB_VERSION = 1;
const BLOB_STORE = 'blobs';
const HANDLE_STORE = 'handles';
const SETTINGS_STORE = 'settings';
const SAVE_DIR_KEY = 'saveDir';

type BlobRecord = {
  fileId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  blob: Blob;
  cachedAt: string;
};

type HandleRecord = {
  fileId: string;
  fileName: string;
  handle: FileSystemFileHandle;
  savedAt: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('indexeddb_open_failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE, { keyPath: 'fileId' });
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE, { keyPath: 'fileId' });
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function readStore<T>(storeName: string, key: string): Promise<T | null> {
  if (!isBrowser()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onerror = () => reject(req.error ?? new Error('indexeddb_read_failed'));
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('indexeddb_tx_failed'));
    };
  });
}

async function writeStore<T>(storeName: string, value: T): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('indexeddb_write_failed'));
    };
  });
}

export function formatCsdChatFileBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function csdChatFileKind(fileName: string): string {
  const ext = String(fileName).split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xls';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['zip', 'rar', '7z'].includes(ext)) return 'zip';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'img';
  return ext || 'file';
}

export async function hasCsdChatFileLocally(fileId: string): Promise<boolean> {
  if (!isBrowser()) return false;
  const blob = await readStore<BlobRecord>(BLOB_STORE, fileId);
  if (blob) return true;
  const handle = await readStore<HandleRecord>(HANDLE_STORE, fileId);
  return Boolean(handle);
}

export async function cacheCsdChatFileBlob(file: CsdAttachmentRow, blob: Blob): Promise<void> {
  if (!isBrowser()) return;
  await writeStore<BlobRecord>(BLOB_STORE, {
    fileId: file.id,
    fileName: file.file_name,
    mimeType: file.mime_type,
    byteSize: file.byte_size,
    blob,
    cachedAt: new Date().toISOString(),
  });
}

async function readCachedBlob(fileId: string): Promise<Blob | null> {
  const row = await readStore<BlobRecord>(BLOB_STORE, fileId);
  return row?.blob ?? null;
}

export async function ensureCsdChatFileBlob(
  token: string,
  file: CsdAttachmentRow,
): Promise<Blob> {
  const cached = await readCachedBlob(file.id);
  if (cached) return cached;
  const blob = await fetchCsdFileBlob(token, file.id);
  await cacheCsdChatFileBlob(file, blob);
  return blob;
}

export async function openCsdChatFile(token: string, file: CsdAttachmentRow): Promise<void> {
  const blob = await ensureCsdChatFileBlob(token, file);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error('popup_blocked');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function saveWithFilePicker(blob: Blob, fileName: string, mimeType: string): Promise<FileSystemFileHandle | null> {
  if (typeof window.showSaveFilePicker !== 'function') return null;
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  const handle = await window.showSaveFilePicker({
    suggestedName: fileName,
    startIn: 'downloads',
    types: ext ? [{
      description: ext.toUpperCase(),
      accept: { [mimeType || 'application/octet-stream']: [`.${ext}`] },
    }] : undefined,
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return handle;
}

export async function saveCsdChatFileToDisk(token: string, file: CsdAttachmentRow): Promise<void> {
  const blob = await ensureCsdChatFileBlob(token, file);
  try {
    const handle = await saveWithFilePicker(blob, file.file_name, file.mime_type);
    if (handle) {
      await writeStore<HandleRecord>(HANDLE_STORE, {
        fileId: file.id,
        fileName: file.file_name,
        handle,
        savedAt: new Date().toISOString(),
      });
      return;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    if (error instanceof Error && error.name === 'AbortError') return;
  }
  triggerBrowserDownload(blob, file.file_name);
}

async function getSaveDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  return readStore<FileSystemDirectoryHandle>(SETTINGS_STORE, SAVE_DIR_KEY);
}

async function setSaveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(handle, SAVE_DIR_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('indexeddb_write_failed'));
    };
  });
}

async function pickSaveDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window.showDirectoryPicker !== 'function') return null;
  const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' });
  await setSaveDirectoryHandle(handle);
  return handle;
}

async function writeToDirectory(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob,
): Promise<FileSystemFileHandle> {
  const sub = await dir.getDirectoryHandle('CSD-Chat', { create: true });
  const handle = await sub.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return handle;
}

export async function revealCsdChatFileInFolder(token: string, file: CsdAttachmentRow): Promise<void> {
  let dir = await getSaveDirectoryHandle();
  if (!dir) {
    try {
      dir = await pickSaveDirectory();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      throw error;
    }
  }
  if (!dir) {
    await saveCsdChatFileToDisk(token, file);
    return;
  }

  const blob = await ensureCsdChatFileBlob(token, file);
  const handle = await writeToDirectory(dir, file.file_name, blob);
  await writeStore<HandleRecord>(HANDLE_STORE, {
    fileId: file.id,
    fileName: file.file_name,
    handle,
    savedAt: new Date().toISOString(),
  });

  if (typeof window.showDirectoryPicker === 'function') {
    try {
      const sub = await dir.getDirectoryHandle('CSD-Chat');
      await window.showDirectoryPicker({ startIn: sub, mode: 'read' });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  await openCsdChatFile(token, file);
}
