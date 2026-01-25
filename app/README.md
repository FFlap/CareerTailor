# CareerTailor (Web App)

The web app handles authentication (Clerk), data + syncing (Convex), document generation (OpenRouter), and Typst editing/rendering. The Chrome extension only scrapes job details from the current tab and redirects here for generation.

## Local dev

```bash
npm install
npm run dev
```

## Environment variables

Set these in `app/.env.local` (ignored by git):

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_EXTENSION_IDS` (comma-separated Chrome extension IDs allowed to receive tokens)
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`

Set this in your Convex environment:

- `OPENROUTER_API_KEY`

## Typst rendering

`POST /api/render/typst` compiles Typst to PDF server-side using `@myriaddreamin/typst.ts` (WASM). This works on Vercel without requiring a system `typst` binary.

## Extension connect flow

- Web: `/extension/connect` mints a Clerk token and redirects back to the extension callback page.
- Extension: stores the token, syncs jobs to Convex, then opens `/generate` with the scraped job details.
