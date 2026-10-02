# API contract notes

## Browser security headers

Next.js applies the security headers defined in `src/security/securityHeaders.ts` to every route. The content security policy allows the Google OAuth and font endpoints, Stellar Horizon, and the API/socket origins configured by `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SOCKET_URL`. Those variables should contain the deployed service URLs; their origins are added to `connect-src`.

Browsers can submit CSP violation reports to `POST /api/csp-report`. The endpoint accepts legacy `csp-report` and Reporting API `body` JSON, caps input at 16 KiB, and logs only the document URL, blocked URL, and violated directive. It does not require authentication because browsers send reports automatically.

Production responses include HSTS. Development responses omit HSTS and allow `unsafe-eval` for the development bundler. Review CSP reports when adding a new browser integration, then add only its required origin to the policy.
