// Shared helpers for the Cloudflare R2 storage API functions.
//
// These run as Vercel serverless (Node.js) functions — NEVER imported by the
// browser bundle. They hold the R2 credentials and the Firebase Admin service
// account, verify the caller's Firebase identity, and mint short-lived
// presigned URLs so the browser can talk to R2 directly without ever seeing a
// secret.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl };

export const DEFAULT_MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
export const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

/** Typed error whose `status` becomes the HTTP response code. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getMaxUploadBytes(): number {
  const v = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MAX_UPLOAD_BYTES;
}

// ── Firebase Admin (lazy singleton) ───────────────────────────────
let adminApp: App | undefined;
function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length) {
    adminApp = existing[0];
    return adminApp;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new HttpError(500, 'Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  let parsed: { project_id?: string; client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(500, 'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new HttpError(500, 'FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields');
  }
  adminApp = initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // The JSON stores the key with escaped "\n"; JSON.parse already turned
      // those into real newlines, which is exactly what cert() expects.
      privateKey: parsed.private_key,
    }),
  });
  return adminApp;
}

/**
 * Verify the request's Firebase ID token and enforce the optional single-user
 * UID allowlist. Returns the caller's UID or throws an HttpError.
 */
export async function verifyRequest(req: VercelRequest): Promise<string> {
  const header = req.headers.authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : '';
  if (!token) throw new HttpError(401, 'Missing authentication token');

  let uid: string;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw new HttpError(401, 'Invalid or expired authentication token');
  }

  const allowed = process.env.ALLOWED_FIREBASE_UID;
  if (allowed && uid !== allowed) {
    throw new HttpError(403, 'This account is not authorized to access storage');
  }
  return uid;
}

// ── Cloudflare R2 (S3-compatible) client ──────────────────────────
export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new HttpError(500, 'Missing R2 configuration');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // R2 rejects the AWS SDK's default flexible-checksum trailers on presigned
    // PUTs; only add a checksum when the operation actually requires one.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
}

export function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new HttpError(500, 'Missing R2 configuration');
  return bucket;
}

// ── Request/response helpers ──────────────────────────────────────
export function methodGuard(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function readJsonBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try {
      return JSON.parse(b) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof b === 'object') return b as Record<string, unknown>;
  return {};
}

export function sanitizeFileName(name: string): string {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file';
}

export function sanitizeFolder(folder: unknown): string {
  const raw = typeof folder === 'string' ? folder : '';
  const clean = raw
    .replace(/\.\.+/g, '') // no path traversal
    .replace(/[^a-zA-Z0-9._/-]/g, '')
    .replace(/^\/+|\/+$/g, '');
  return clean || 'documents';
}

export function fail(res: VercelResponse, err: unknown): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[r2] unexpected error', err);
  res.status(500).json({ error: 'Internal server error' });
}
