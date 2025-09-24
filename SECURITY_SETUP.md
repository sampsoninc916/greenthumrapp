# Security and Authentication Setup

## Overview
This document describes the current security posture of the Thumr application with an emphasis on session
management, secure token handling, and operational controls that protect Cognito user data. The frontend now
supports two hardened strategies for persisting authentication: Amplify-managed secure cookies or a backend-driven
HTTP-only session model. Both approaches avoid direct browser storage (`localStorage` / `sessionStorage`) and
integrate tightly with idle-session controls and global sign-out.

## Session Management Strategies
The active strategy is configured through `SECURITY_CONFIG.SESSION_STRATEGY` (`src/config/amplify.ts`) which
accepts either `"amplify-cookie"` or `"token-exchange"`.

### 1. Amplify Managed Cookie Storage (`amplify-cookie`)
* `configureAmplify` wires Cognito to `CookieStorage` so Amplify persists tokens in secure, same-site cookies
  instead of `sessionStorage`.
* Cookie attributes (domain, path, `SameSite`, `Secure`, expiry) are derived from
  `SECURITY_CONFIG.COOKIE_STORAGE` and can be tuned via environment variables:
  - `VITE_AUTH_COOKIE_DOMAIN`
  - `VITE_AUTH_COOKIE_PATH`
  - `VITE_AUTH_COOKIE_SAME_SITE`
  - `VITE_AUTH_COOKIE_SECURE`
  - `VITE_AUTH_COOKIE_EXPIRES_DAYS`
* Amplify remains responsible for token rotation; the frontend never writes tokens to web storage.

### 2. Backend Token Exchange (`token-exchange`)
* After sign-in or refresh, `AuthContext` posts Cognito tokens to
  `SECURITY_CONFIG.TOKEN_EXCHANGE_ENDPOINT`. The backend must exchange them for short-lived HTTP-only session
  cookies (and may rotate refresh tokens server-side).
* When APIs require a bearer token, `authService` calls `SECURITY_CONFIG.SESSION_TOKEN_ENDPOINT` with
  `credentials: 'include'` to mint an ephemeral token/role pair. Requests automatically retry with a forced refresh by
  appending `?forceRefresh=true` when a 401 is returned.
* Sign-out and idle-time cleanup call `SECURITY_CONFIG.SESSION_LOGOUT_ENDPOINT` so the backend can clear the
  cookie-based session.
* Required environment variables for this strategy:
  - `VITE_AUTH_TOKEN_EXCHANGE_ENDPOINT`
  - `VITE_AUTH_SESSION_TOKEN_ENDPOINT`
  - `VITE_AUTH_SESSION_LOGOUT_ENDPOINT`

> **Important:** If `token-exchange` is selected but any endpoint is missing or returns a non-2xx response, the
> session is invalidated immediately to prevent falling back to insecure client-side storage.

## Frontend Controls
### AuthContext (`src/contexts/AuthContext.tsx`)
* Maintains authenticated state entirely in memory and schedules refreshes using
  `SECURITY_CONFIG.TOKEN_REFRESH_BUFFER`.
* Ensures global sign-out via `signOut({ global: true })` and clears backend cookies through `clearSecureSession`.
* Provides configurable idle timeout (`SECURITY_CONFIG.IDLE_TIMEOUT_MS`, default 15 minutes). User activity resets the
  timer; inactivity triggers global logout and cookie invalidation.
* Coordinates secure token exchange on every successful session load or refresh; failure to establish the secure
  session causes a full sign-out.

### AuthService (`src/services/auth.ts`)
* `getToken()` and `authenticatedFetch()` rely on the selected strategy. Tokens are fetched on-demand through
  `getTokenAndRole()` instead of reading from browser storage.
* Adds `Authorization` and `X-User-Role` headers while ensuring `credentials: 'include'` is sent when the backend
  cookie flow is active.
* Retries failed requests after forcing a secure token refresh; persistent failures redirect the user to the login page.

## Configuration Summary
| Setting | Description |
| --- | --- |
| `VITE_AUTH_SESSION_STRATEGY` | Optional override (`amplify-cookie` / `token-exchange`). Defaults to `amplify-cookie`. |
| `VITE_AUTH_COOKIE_*` | Tune cookie storage (domain, path, SameSite, Secure flag, expiry days). |
| `VITE_AUTH_IDLE_TIMEOUT_MINUTES` | Idle timeout length. Values ≤ 0 disable the idle timer. |
| `VITE_AUTH_TOKEN_EXCHANGE_ENDPOINT` | Backend endpoint that swaps Cognito tokens for secure cookies. |
| `VITE_AUTH_SESSION_TOKEN_ENDPOINT` | Endpoint that returns a short-lived bearer token + optional role using the secure cookie. |
| `VITE_AUTH_SESSION_LOGOUT_ENDPOINT` | Endpoint to invalidate secure sessions during logout/idle. |

Standard Cognito variables (`VITE_AWS_USER_POOL_ID`, `VITE_AWS_USER_POOL_CLIENT_ID`, `VITE_AWS_REGION`) remain
unchanged and are still required.

## Testing Notes
1. **Amplify cookie flow**
   - Log in and inspect browser cookies for the configured domain/path. Tokens should be absent from `localStorage` and
     `sessionStorage`.
   - Wait for the idle timer or force a refresh: the refresh timer should rotate tokens ~5 minutes before expiry.
2. **Token exchange flow**
   - Validate that `/token-exchange` (or configured URL) returns 200 and sets HTTP-only cookies.
   - Trigger an authenticated API call and confirm the frontend hits `SESSION_TOKEN_ENDPOINT` before attaching the
     Authorization header.
   - Simulate a 401 response; the client should append `forceRefresh=true`, retry once, and redirect to `/login` if the
     backend still rejects the request.

## Deployment Checklist
- [ ] Provide all Cognito environment variables and API endpoint URLs in production `.env` files.
- [ ] Choose and verify the desired session strategy. For `token-exchange`, ensure backend routes exist and enforce HTTPS.
- [ ] Confirm cookie domain/path align with the deployed hostname and that `Secure` remains enabled in production.
- [ ] Exercise idle timeout and global sign-out flows to ensure backend cookies are cleared.
- [ ] Keep password strength checks, rate-limiting, and HTTPS enforcement enabled across services.

## Security Best Practices
1. Never commit environment files or tokens to version control.
2. Monitor backend token-exchange endpoints for abuse and enforce rate limits.
3. Rotate Cognito client secrets and invalidate refresh tokens when suspicious activity is detected.
4. Keep Amplify and AWS SDK dependencies up to date to receive the latest security fixes.
5. Review CloudWatch/monitoring logs for anomalous sign-in or sign-out activity.
