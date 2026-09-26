# Global Vocabulary Learning Platform

Angular + Supabase MVP for multilingual vocabulary learning.

## Local setup

1. Install Node.js 20+ and npm.
2. Run `npm install`.
3. Copy the values from `.env.example` into `src/environments/environment.ts`.
4. Enable **Authentication → Providers → Anonymous Sign-Ins** in Supabase.
5. Apply `infra/supabase.sql` in the Supabase SQL Editor, or deploy the matching migration with `supabase db push`.
6. Set the Gemini secret for Edge Functions:

   ```bash
   supabase secrets set GEMINI_API_KEY="..."
   supabase secrets set GEMINI_MODEL="gemini-2.5-flash"
   ```

7. Deploy the Edge Functions in `supabase/functions/`.
8. Run `npm start`.

The browser only uses the Supabase URL and publishable key. Provider and server secrets belong in Supabase Edge Function secrets.

The app does not show a login screen. On first load it creates a Supabase anonymous session and keeps data private through RLS. The session is tied to the current browser/device; clearing site storage or changing devices starts a new workspace.

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml` for a project site at:

```text
https://<username>.github.io/<repository>/
```

Configure the repository as follows:

1. Set **Settings → Pages → Source** to **GitHub Actions**.
2. Add these Repository Secrets under **Settings → Secrets and variables → Actions**:

   ```text
   SUPABASE_URL
   SUPABASE_PUBLISHABLE_KEY
   ```

3. Push to `main`, or start the workflow manually from the Actions tab.

The workflow injects the public Supabase configuration, builds with the repository base path, creates `404.html` for Angular route fallback, and deploys `dist/global-vocabulary-platform/browser`. The app uses hash routing so direct links and refreshes work reliably on GitHub Pages.

Never add `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` to GitHub Pages secrets used by the frontend build. Those secrets belong only in Supabase Edge Function secrets.

In Supabase Authentication settings, set the Site URL and redirect URL to the deployed project site:

```text
Site URL:       https://<username>.github.io/<repository>/
Redirect URL:   https://<username>.github.io/<repository>/**
```

## Supabase deployment

With the Supabase CLI installed and linked to your project:

```bash
supabase db push
supabase functions deploy lexicon-api --no-verify-jwt
supabase functions deploy learning-api --no-verify-jwt
```

The Edge Functions use the project-provided `SUPABASE_URL`, publishable key and secret key secrets. Do not copy the secret/service-role key into Angular or commit it to the repository.

AI practice uses `GEMINI_API_KEY` only inside `learning-api`. The browser never receives this key. Each anonymous session can generate up to five AI practice sets per hour; deterministic quick practice remains available when Gemini is unavailable.

The Edge Functions also support the current Supabase key maps automatically provided by hosted projects:

```text
SUPABASE_PUBLISHABLE_KEYS.default
SUPABASE_SECRET_KEYS.default
```

For local development, copy `supabase/functions/.env.example` to `supabase/functions/.env`. The local file is ignored and must never be committed. `SUPABASE_JWKS_URL` is not required by the current `auth.getUser` verification flow and is never sent to the browser.

## MVP routes

The routes are available after the hash fragment, for example:

- `/#/dashboard`
- `/#/decks`
- `/#/decks/:deckId/add`
- `/#/decks/:deckId/vocabulary`
- `/#/decks/:deckId/practice`

## Tests

Run `npm run test:unit` for the pure TypeScript unit tests. The build command is `npm run build`.
# vogiaVocabulary
