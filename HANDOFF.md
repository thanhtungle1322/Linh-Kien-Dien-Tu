# MongoDB Atlas / Vercel handoff

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
