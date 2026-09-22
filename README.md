<img src="app/public/favicon.svg" alt="CareerTailor logo" width="72" height="72" />

# CareerTailor

CareerTailor creates tailored résumés and cover letters from your profile and a job posting, then lets you edit and export them as polished PDFs.

## Setup

```bash
cd app
npm install
```

### Convex

Create or connect a Convex project:

```bash
npx convex dev
```

Follow the prompts to sign in and select a project. Convex will add `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `app/.env.local`. Keep this command running during development.

### API keys

Create a [Clerk](https://clerk.com/) application, then add its keys to `app/.env.local`:

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
```

Add your Clerk issuer URL to Convex:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://your-clerk-issuer.example.com"
```

Add a Gemini API key for the default AI model:

```bash
npx convex env set GEMINI_API_KEY "your-gemini-api-key"
```

OpenRouter models are also supported:

```bash
npx convex env set OPENROUTER_API_KEY "your-openrouter-api-key"
```

The AI keys are backend secrets and should only be stored in Convex, not in `app/.env.local` or a `VITE_` variable.

## Run locally

Leave `npx convex dev` running, then open another terminal from the repository root:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
