// Client-side helper for Cloudflare R2 document storage.
//
// The browser never sees R2 credentials. It asks our own /api/r2/* endpoints
// (which verify the Firebase ID token) for short-lived presigned URLs, then
// talks to R2 directly. Firestore stores the returned `objectKey`, never a
// signed URL — signed URLs expire and are regenerated on demand when opening.

import { auth } from '@/firebase/config';

export interface R2Attachment {
  storageProvider: 'r2';
  objectKey: string;
  originalName: string;
  contentType: string;
  size: number;
  uploadedAt: string; // ISO timestamp
}

export interface UploadOptions {
  /** Logical folder prefix for the object key, e.g. "invoice-documents". */
  folder?: string;
  /** Upload progress as a whole-number percentage (0–100). */
  onProgress?: (percent: number) => void;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to manage documents.');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function postJson<T>(path: string, payload: unknown, fallbackError: string): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await extractError(res, fallbackError));
  return (await res.json()) as T;
}

async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Upload a file to R2 via a presigned PUT and return the metadata to persist
 * in Firestore. Throws on auth, size, CORS, or network failure.
 */
export async function uploadFileToR2(file: File, options: UploadOptions = {}): Promise<R2Attachment> {
  const contentType = file.type || 'application/octet-stream';

  const { uploadUrl, objectKey, contentType: signedContentType } = await postJson<{
    uploadUrl: string;
    objectKey: string;
    contentType: string;
  }>(
    '/api/r2/upload-url',
    {
      folder: options.folder ?? 'documents',
      fileName: file.name,
      contentType,
      size: file.size,
    },
    'Failed to prepare the upload.',
  );

  await putWithProgress(uploadUrl, file, signedContentType || contentType, options.onProgress);

  return {
    storageProvider: 'r2',
    objectKey,
    originalName: file.name,
    contentType: signedContentType || contentType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (HTTP ${xhr.status}). Check the R2 bucket CORS policy.`));
      }
    };
    xhr.onerror = () =>
      reject(new Error('Upload failed. Check your connection and the R2 bucket CORS policy.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));
    xhr.send(file);
  });
}

/** Fetch a fresh short-lived signed GET URL for an object key. */
export async function getR2DownloadUrl(objectKey: string): Promise<string> {
  const { downloadUrl } = await postJson<{ downloadUrl: string }>(
    '/api/r2/download-url',
    { objectKey },
    'Failed to open the document.',
  );
  return downloadUrl;
}

/**
 * Open an R2 object in a new tab. A blank tab is opened synchronously inside
 * the click gesture (so pop-up blockers allow it) and redirected once the
 * signed URL resolves.
 */
export async function openR2File(objectKey: string): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  try {
    const url = await getR2DownloadUrl(objectKey);
    if (tab) tab.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/** Permanently delete an R2 object. */
export async function deleteFileFromR2(objectKey: string): Promise<void> {
  await postJson<{ ok: boolean }>('/api/r2/delete', { objectKey }, 'Failed to delete the document.');
}

export interface AttachmentRef {
  documentKey?: string | null; // R2 object key (new storage)
  documentUrl?: string | null; // legacy Firebase Storage URL
}

/** Open an attachment: signed URL for R2-backed keys, else the legacy URL. */
export function openAttachment(a: AttachmentRef): void {
  if (a.documentKey) {
    openR2File(a.documentKey).catch((err) =>
      alert(err instanceof Error ? err.message : 'Failed to open the document.'),
    );
  } else if (a.documentUrl) {
    window.open(a.documentUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Resolve a directly-usable href for an attachment — a fresh signed URL for an
 * R2 object, or the stored legacy URL. Returns null when neither is available
 * (or the signed URL can't be minted). Intended for embedding into generated
 * print/preview HTML; the signed URL is short-lived, so resolve it at the
 * moment the document is opened, never persist it.
 */
export async function resolveAttachmentHref(a: AttachmentRef): Promise<string | null> {
  if (a.documentKey) {
    try {
      return await getR2DownloadUrl(a.documentKey);
    } catch {
      return null;
    }
  }
  return a.documentUrl ?? null;
}

/** Best-effort delete of an attachment's R2 object (no-op for legacy URLs). */
export async function deleteAttachmentObject(a: {
  documentKey?: string | null;
  storageProvider?: string | null;
}): Promise<void> {
  if (a.storageProvider === 'r2' && a.documentKey) {
    try {
      await deleteFileFromR2(a.documentKey);
    } catch (err) {
      console.error('Failed to delete R2 object', a.documentKey, err);
    }
  }
}
