# Document storage: Cloudflare R2

The ERP keeps **Firebase Authentication + Firestore** but stores uploaded
documents in **Cloudflare R2** instead of Firebase Storage. The browser never
holds an R2 credential — it asks our own serverless functions (which verify the
Firebase ID token) for short-lived presigned URLs and talks to R2 directly.

## How it works

```
Upload:  browser → POST /api/r2/upload-url  (verify Firebase token)
                 ← { uploadUrl (presigned PUT), objectKey }
         browser → PUT file to R2 directly
         browser → save objectKey + metadata in Firestore

Open:    browser → POST /api/r2/download-url (verify token) → signed GET URL → open
Delete:  browser → POST /api/r2/delete       (verify token) → object removed
```

Firestore stores the permanent **`objectKey`**, never a signed URL (signed URLs
expire and are minted on demand when a document is opened).

## Files

| Path | Role |
| --- | --- |
| `api/r2/_shared.ts` | Firebase-Admin token verification, UID allowlist, R2 S3 client, helpers |
| `api/r2/upload-url.ts` | Presigned `PUT` + object key (enforces `MAX_UPLOAD_BYTES`) |
| `api/r2/download-url.ts` | Presigned `GET` (inline) for an object key |
| `api/r2/delete.ts` | Deletes an object |
| `src/lib/r2Storage.ts` | Browser client: `uploadFileToR2`, `openR2File`, `deleteFileFromR2` |

## Environment variables

Server-only values (set in `.env.local` for local dev **and** in Vercel →
Settings → Environment Variables). **Never** prefix these with `VITE_` — that
would ship them to the browser.

| Variable | Notes |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID (from R2 overview). Endpoint = `https://<id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | From a bucket-scoped R2 API token (Object Read & Write) |
| `R2_SECRET_ACCESS_KEY` | Shown once when the token is created |
| `R2_BUCKET_NAME` | `granitec-erp-documents` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full service-account JSON, minified to one line |
| `ALLOWED_FIREBASE_UID` | Optional. If set, only this UID may use storage |
| `MAX_UPLOAD_BYTES` | Optional. Default `15728640` (15 MB) |

The existing `VITE_FIREBASE_*` browser variables are unchanged.

Minify the service-account JSON:

```bash
node -e "const fs=require('fs');console.log(JSON.stringify(JSON.parse(fs.readFileSync('service-account.json','utf8'))))"
```

## One-time Cloudflare setup

1. Activate R2, then create a **private** bucket named `granitec-erp-documents`
   (no public dev URL, no public custom domain).
2. Create a **bucket-scoped** R2 API token with **Object Read & Write** →
   copy the Access Key ID + Secret.
3. Add a **CORS policy** on the bucket allowing the browser origins that upload
   directly to R2:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://YOUR-DOMAIN.vercel.app"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   No trailing slash on origins. Don't use `"*"` in production.

## Firebase Admin setup

Firebase Console → Project settings → Service accounts → **Generate new private
key**. Keep the JSON private (it is gitignored via `service-account*.json` /
`firebase-adminsdk*.json`) and store it minified in `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Local testing

`npm run dev` runs Vite only — the `/api/r2/*` functions do **not** run. For a
full local test use the Vercel CLI:

```bash
vercel link          # once, connect to the Vercel project
vercel env pull .env.local
vercel dev           # serves app + /api functions (default http://localhost:3000)
```

After adding/changing Vercel env vars, **redeploy** — existing deployments do
not pick up new values automatically.

> Note: `vercel.json` has an SPA catch-all rewrite. Vercel matches serverless
> functions before applying rewrites, so `/api/*` is not swallowed by it —
> confirm on first deploy that `/api/r2/upload-url` returns JSON (405/401 when
> hit directly is expected), not the HTML app shell.

## What is migrated

- ✅ **Invoices** (Documents page) — upload, open, delete, and replace all use R2.

Still on Firebase Storage (legacy `documentUrl` values keep working everywhere):

- ⬜ Shipping BL receipts — `uploadReceiptDocument` in `shipping.service.ts`
- ⬜ Shipped-supply documents — `uploadShippedSupplyDocument` in `shippedSupply.service.ts`

### Migrating another flow (pattern)

1. Swap the service upload to `uploadFileToR2(file, { folder: '<name>' })`.
2. Persist `documentKey` + `storageProvider: 'r2'` (+ `documentName`) instead of
   a URL; strip `undefined` before writing to Firestore.
3. Change each read site to open via a signed URL when `documentKey` is present,
   falling back to the legacy `documentUrl`:

   ```ts
   documentKey ? openR2File(documentKey) : window.open(documentUrl, '_blank', 'noopener,noreferrer')
   ```

4. On delete/replace, call `deleteFileFromR2(oldKey)` for R2-backed attachments.

The print/preview views (`InventoryPage`, `ShippingPage`) embed `documentUrl`
directly into generated HTML; those need a rethink for signed URLs (e.g. resolve
a URL on click rather than baking it into the printed markup) before the
shipping flows can fully drop Firebase Storage.
