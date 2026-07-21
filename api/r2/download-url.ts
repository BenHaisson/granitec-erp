// POST /api/r2/download-url
// Verifies the caller, then returns a short-lived presigned GET URL for the
// requested object key. The URL is generated fresh on every open because it
// expires — it must never be persisted in Firestore.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  verifyRequest,
  getR2Client,
  getBucket,
  GetObjectCommand,
  getSignedUrl,
  readJsonBody,
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
    const objectKey = String(body.objectKey ?? '').trim();
    if (!objectKey) throw new HttpError(400, 'Missing objectKey');

    const command = new GetObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      // Open PDFs/images inline in the browser rather than force-downloading.
      ResponseContentDisposition: 'inline',
    });
    const downloadUrl = await getSignedUrl(getR2Client(), command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });

    res.status(200).json({ downloadUrl });
  } catch (err) {
    fail(res, err);
  }
}
