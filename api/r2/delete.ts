// POST /api/r2/delete
// Verifies the caller, then permanently removes the object from R2.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  verifyRequest,
  getR2Client,
  getBucket,
  DeleteObjectCommand,
  readJsonBody,
  methodGuard,
  fail,
  HttpError,
} from './_shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!methodGuard(req, res)) return;
  try {
    await verifyRequest(req);

    const body = readJsonBody(req);
    const objectKey = String(body.objectKey ?? '').trim();
    if (!objectKey) throw new HttpError(400, 'Missing objectKey');

    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: objectKey }),
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
}
