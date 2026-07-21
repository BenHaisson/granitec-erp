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

All document attachments now use Cloudflare R2. **Firebase Storage is no longer
used anywhere** — the `storage` export was removed from `src/firebase/config.ts`.

- ✅ **Invoices** (Documents page)
- ✅ **Shipping BL receipts** — partial receipts, full receipts, and legacy
  received-order documents (`shipping.service.ts`)
- ✅ **Shipped-supply documents** (`shippedSupply.service.ts`)
- ✅ **Print / preview views** — the "Bon de réception" documents in
  `InventoryPage` and `ShippingPage` resolve a fresh short-lived signed URL at
  open time (`resolveAttachmentHref`) and embed it, rather than baking a
  permanent URL into the generated HTML.

### Backward compatibility

Documents uploaded before the migration still carry a Firebase Storage
`documentUrl`. Every open path prefers the R2 `documentKey` when present and
falls back to the legacy `documentUrl` (`openAttachment` / `resolveAttachmentHref`
in `src/lib/r2Storage.ts`), so old attachments keep opening. New uploads and
replacements write `documentKey` + `storageProvider: 'r2'`; deleting or replacing
an R2-backed attachment removes the R2 object (best-effort via
`deleteAttachmentObject`).

Old Firebase Storage objects are **not** deleted or back-filled — historical
files stay in Firebase Storage and keep working through the fallback. Migrate
them later or leave them as-is.

### The `documentKey` shape

Attachments are stored on their Firestore record as flat fields:

```ts
documentKey?: string        // R2 object key, e.g. "invoice-documents/2026-07-21/<uuid>-file.pdf"
storageProvider?: 'r2'      // present for R2-backed attachments
documentName?: string       // original file name, for display
documentUrl?: string        // legacy Firebase URL (old records only)
```
