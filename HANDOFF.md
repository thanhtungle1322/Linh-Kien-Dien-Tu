# MySQL migration handoff

- Requester asked to replace MongoDB with the supplied MonsterASP MySQL database.
  Requester explicitly selected **clean baseline first** after newer commits
  had introduced both CWE-89 and CWE-79. Login is restored clean here; concurrent
  commit `c979eda` already fixed preview via HTML escaping, and is preserved.
- mysql2 replaces the MongoDB driver. Verified TLS is required. A lazy pool is
  reused per warm instance, limited to 5 connections, with statement/connect
  timeouts and multiple statements disabled. No in-memory runtime fallback.
- The target database already had four tables, including unrelated users,
  products and orders. New tables use `electrohub_` prefix; old tables/data are
  untouched. Schema is in `db/schema.sql`; seed uses fixed prepared statements
  in a transaction and preserves existing rows on repeat.
- The provided credentials are only in ignored local `.env`. They are not in
  source, tests, commit messages or verification output. JWT secret is retained.
- Clean login uses real server-side prepared statements and binary password
  comparison (case, accent and trailing-space exact). TLS explicitly enables
  mysql2 hostname identity verification as well as chain validation.
  The raw query overload
  remains available for future intentional CWE-89 testing against real SQL.
- Offline SQL tests were red before implementation. Full clean suite passes
  31 tests using a mocked mysql2 driver; benchmark LF/CRLF apply/restore passes.
- Real MonsterASP connection and TLS verified; seed completed. Real SQL data
  checks: eight products, decoded order item arrays, ownership filtering and
  prepared login succeed. Earlier raw benchmark probe against seeded fixture
  accounts confirmed SQL injection; the same payload with bound parameters
  returned no match. That vulnerable route has since been restored clean.
- Review found and fixed a real MySQL collation regression: wrong-case passwords
  initially authenticated. Binary comparison now rejects case, accent and
  trailing-space variants. Real SQL HTTP: valid login 200, each wrong variant
  and injection 401, health 200, preview escaped. TLS hostname verification
  remained enabled during these checks. Independent Standards/Spec re-review:
  0 unresolved blockers. New TLS and auth assertions were red before fixes.
- Local real-SQL HTTP verification and production verification are separate.
  Vercel still needs MYSQL_HOST/PORT/DATABASE/USER/PASSWORD before migration can
  work there. Keep existing JWT_SECRET/NODE_ENV; MongoDB variables are unused.
- No ACVIS webhook behavior is changed. Prior clean pushes on Linh-Kien-Dien-Tu
  and StudyRandomPRJ did not show new GitHub Check Runs at inspection time; this
  migration does not establish webhook receipt or exact rule-ID matching.
- Separate ACVIS repository checks retain prior environment limitations (no
  .NET SDK, missing Python dependencies, frontend test failures); no ACVIS code
  changes are part of this migration.
