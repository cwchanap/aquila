# Google OAuth Setup

Authentication is Google-only via Better Auth's `socialProviders.google`.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Web client secret |
| `BETTER_AUTH_URL` | Base URL Better Auth runs under (e.g. `http://localhost:5090`) |
| `PUBLIC_AUTH_URL` | SSR/build fallback base URL for the auth client (browser uses `window.location.origin`) |
| `BETTER_AUTH_SECRET` | Session encryption secret (required in production) |
| `TRUSTED_ORIGINS` | Comma-separated allowed origins (required in production) |

## Google Cloud Console steps

1. Create or select a Google Cloud project.
2. **APIs & Services → OAuth consent screen:** configure as *External*; set app
   name + support email; add scopes `email`, `profile`, `openid`.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   application type **Web application**.
4. **Authorized JavaScript origins:** `http://localhost:5090` (dev) and your
   production origin.
5. **Authorized redirect URIs:** `{BETTER_AUTH_URL}/api/auth/callback/google`
   for each environment — e.g. `http://localhost:5090/api/auth/callback/google`
   (dev) and the production equivalent.
6. Copy the generated **Client ID** / **Client Secret** into `GOOGLE_CLIENT_ID`
   and `GOOGLE_CLIENT_SECRET` for local dev, CI, and Vercel.

A redirect-URI mismatch between Google Cloud and `BETTER_AUTH_URL` is the most
common failure — they must match exactly per environment.
