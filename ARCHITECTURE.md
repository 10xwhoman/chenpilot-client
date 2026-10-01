# Architecture notes

## Browser integrations and content security policy

The browser client talks to the configured API and Socket.IO services, Stellar Horizon, and Google OAuth. `src/security/securityHeaders.ts` builds the app-wide policy and `next.config.ts` applies it to all routes. Keep API and socket origins in `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SOCKET_URL` so deployments can configure their own endpoints without widening the policy.

CSP violations are reported to `POST /api/csp-report`; reports are size-limited and reduced to the fields needed for debugging. Production enables HSTS. The reporting endpoint and policy are described in [the API contract](docs/API_CONTRACT.md).
