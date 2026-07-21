// POST /api/r2/upload-url
// Verifies the caller, then returns a short-lived presigned PUT URL plus the
// permanent object key the browser should persist in Firestore.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import {
  verifyRequest,
  getR2Client,
  getBucket,
  PutObjectCommand,
  getSignedUrl,
  readJsonBody,
  sanitizeFileName,
  sanitizeFolder,
  getMaxUploadBytes,
  methodGuard,
  fail,
  HttpError,
  SIGNED_URL_TTL_SECONDS,
} from './_shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!methodGuard(req, res)) return;
  try {
    await verifyRequest(req);

    const body = readJsonBody(req);
    const fileName = sanitizeFileName(String(body.fileName ?? 'file'));
    const contentType =
      typeof body.contentType === 'string' && body.contentType
        ? body.contentType
        : 'application/octet-stream';
    const size = Number(body.size ?? 0);

    const max = getMaxUploadBytes();
    if (size > max) {
      const mb = Math.floor(max / (1024 * 1024));
      throw new HttpError(413, `File too large. The maximum upload size is ${mb} MB.`);
    }

    const folder = sanitizeFolder(body.folder);
    const datePart = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const objectKey = `${folder}/${datePart}/${randomUUID()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(getR2Client(), command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });

    res.status(200).json({ uploadUrl, objectKey, contentType });
  } catch (err) {
    fail(res, err);
  }
}
