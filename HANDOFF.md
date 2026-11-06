# MongoDB Atlas / Vercel handoff

## Sequential ACVIS benchmark — step 1

- Clean restore point: `2efa517`. This step introduces only CWE-89 in
  `routes/auth.js`, POST `/api/auth/login`, by interpolating request credentials
  into SQL and passing the SQL to `dbConnection.query` without bound parameters.
- Intended catalog record: `6a9ad52b011ecda8a0e8e4d4` / `cn_664` (alternative
  `6a990927011ecda8a0e8bc75` / `appointment_00080`). Exact scan matching is pending.
- JWT secret stays environment-backed; XSS, traversal and IDOR remain clean.
- This is a static-only SQL benchmark with MongoDB. Login now returns HTTP 500;
  MongoDB connectivity and the product catalog are expected to keep working.
- Clean-baseline tests depending on successful login are expected to fail. Do
  not weaken those tests to conceal the intentional benchmark regression.
- Do not apply the all-five script on this intermediate state; restore from
  the clean commit first. Wait for ACVIS scan evidence before the next weakness.
- Verification: `node --check routes/auth.js` and patch integrity passed.
  Clean suite: 15 passed / 11 failed (intentional login regression and all-five
  harness requires a clean baseline). No test assertions were disabled/changed.
  Local HTTP with real Atlas: health/catalog 200, raw SQL login 500, escaped echo
  JSON 200, traversal 404, own order 200 and cross-user order 403. Test customer
  JWT was minted locally with configured secret, never printed. Independent
  Standards and Spec review: 0 blockers. Exact ACVIS matching remains pending.

## Connection diagnosis follow-up

- Confirmed local root cause: URI password retained the template's outer angle
  brackets. Removing only those wrappers succeeded against real Atlas. Updated
  the ignored local `.env` without printing credentials. Production subsequently
  recovered after its configuration was updated/redeployed.
- Atlas authentication code 8000 is now recognized; safe driver name/code can
  accompany health errors. New assertions failed before the classifier update;
  all 26 offline tests pass afterward. Independent re-review: 0 blockers.
- Seed completed against the configured real storefront database, preserving
  existing records. Real Atlas HTTP verification (no mocks): health 200, catalog
  200 with 8 products, customer login 200, own order 200, cross-user order 403.
  These are local HTTP requests using Atlas, not Vercel production evidence.
- Production independently verified on `https://electroshopgood.vercel.app`:
  health 200/connected, catalog 200/eight products, customer login 200, own order
  200 and cross-user order 403. No mocked boundaries in these production probes.

- Initial production GET `/api/health` reproduced HTTP 503 and POST
  `/api/auth/login` HTTP 500, before the configuration correction above.
- Added allowlisted `database.errorCode` to health and safe code-only logging.
  Driver exception text, URI and credentials are not returned or logged here.
- `npm test`: 26 passed with driver mocked, including missing URI/database name,
  authentication, permission and network failures. New diagnostic assertions
  failed before implementation. Patch integrity passed.
- At initial diagnosis, credentials and Vercel log access were unavailable;
  deployed diagnostics plus the later local `.env` established the auth failure.

- Runtime storage: MongoDB only for users, products and orders. No RAM fallback.
- `npm run seed:db` upserts seed records without replacing existing documents.
- Shared JWT configuration requires a supplied secret (32+ characters).
- `/api/health` pings MongoDB and returns 503 on configuration/connection failure.
- Benchmark scripts support LF/CRLF, reject repeated apply, validate replacements
  before writes and restore exact saved clean route files.
- CWE-89 is a static-source benchmark only; MongoDB cannot run raw SQL. Vulnerable
  login deliberately returns 500 instead of simulating a successful exploit.
- README contains Atlas, Vercel, seed, integration test and benchmark instructions.

## Verification

- ElectroHub `npm test`: 24 passed. Tests cross Express HTTP with MongoDB driver
  mocked. Auth, ownership, persistence API behavior, category validation and
  benchmark apply/restore verified locally.
- Vulnerable HTTP probes: XSS reflection, read-only traversal to package.json,
  authenticated cross-user IDOR and raw-SQL rejection passed with mocked MongoDB.
- `npm run test:integration`: correctly refuses to run without `.env.test`.
  Actual Atlas connection, real persistence and Vercel deployment not performed.
- Independent Standards and Spec review: 0 unresolved blockers after category
  validation/collation and explicit integration configuration fixes.
- ACVIS mandatory checks attempted separately: backend unavailable (no .NET SDK),
  Python failed imports (missing pydantic/fastapi dependencies), frontend tests
  341 passed / 4 failed, frontend typecheck/production build passed with warnings.
  These checks exercise the separate ACVIS repository, not ElectroHub changes.
- Changes must remain draft until required unavailable/failing checks are resolved.
  No claim of production repair, exact rule-ID matches or five runtime exploit
  confirmations is made. No deployment is authorized by this handoff.

## Remaining environment steps

1. Create Atlas database user and configure network access for local/Vercel egress.
2. Set `MONGODB_URI`, `MONGODB_DB_NAME`, and random `JWT_SECRET` locally and Vercel.
3. Seed the target database and verify `/api/health`, login and order persistence.
4. Run `test:integration` on a separately seeded `_test` database.
5. Re-run missing ACVIS checks in its prepared development environment if required
   for publication; maintain Draft status until those checks pass.
6. Deploy clean application only after explicit deployment authorization; validate
   production independently. Test vulnerable commits in an isolated environment.
