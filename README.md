# ElectroHub — Linh Kiện Điện Tử

Express/Node.js storefront and ACVIS benchmark, deployed to Vercel through
`api/index.js`. Runtime persistence uses **MySQL on MonsterASP**, with verified
TLS and a reusable connection pool. Node.js 22+ is required. MongoDB is no longer
used. Current source is the **clean baseline**, as requested before SQL testing.

## Database configuration

Copy `.env.example` to `.env` only if `.env` does not already exist. Set:

```dotenv
PORT=3000
NODE_ENV=production
JWT_SECRET=<random-value-at-least-32-characters>
MYSQL_HOST=db68961.public.databaseasp.net
MYSQL_PORT=3306
MYSQL_DATABASE=db68961
MYSQL_USER=db68961
MYSQL_PASSWORD=<database-user-password>
```

Use the actual password without placeholder brackets. Separate fields avoid
connection-URI encoding issues with special password characters. Preserve the
existing JWT secret. Never commit `.env` or copy credentials into logs.

The supplied `Server=...; Database=...; Uid=...; Pwd=...; SslMode=Preferred;`
string is the .NET connector format. Node uses the fields above with `mysql2`.
The driver requires TLS, verifies the certificate/hostname, and does not fall
back to plaintext. Remote Access must be enabled in the MonsterASP MySQL panel.
See [MonsterASP MySQL connections](https://help.monsterasp.net/databases/mysql/connect)
and [mysql2 SSL](https://sidorares.github.io/node-mysql2/docs/documentation/ssl).

```powershell
npm.cmd ci
npm.cmd run seed:db
npm.cmd start
```

Local setup was configured and seeded during migration. The hosted database
already contains unrelated `users`, `products`, `orders` tables with different
columns; the application does not alter them. Its tables are:

| Table | Data |
|---|---|
| `electrohub_users` | 3 benchmark users |
| `electrohub_products` | 8 electronic components |
| `electrohub_orders` | 4 seeded orders plus new orders |

Schema lives in `db/schema.sql`. Seed creates these tables if missing, then
inserts fixtures in a transaction. Repeated seed keeps existing rows instead
of replacing them. New orders persist across pool reconnects/cold starts.
Money values are returned as numbers; order items are decoded to arrays.
Seed accounts use plaintext fixture passwords to support the login SQL
benchmark. This is a security test application, not a production auth design.

## Vercel

Keep the existing repository project, Node runtime entry `api/index.js` and
`vercel.json`. No frontend build step is needed. Add these Environment Variables
to the correct Production/Preview environment before deploying this migration:

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- Existing `JWT_SECRET` and `NODE_ENV=production`

`PORT` is local-only. Old `MONGODB_*` settings are ignored and can be removed.
Environment changes require a new deployment. Seed runs from local CLI, never
from a web request or Vercel build. Pool limit is 5 connections per warm function
instance; multiple function instances create separate pools.

Check `GET /api/health` after deployment. A healthy response includes:

```json
{"status":"healthy","database":{"provider":"mysql","status":"connected"}}
```

The full response also includes metadata/timestamp. HTTP 503 returns a fixed
`database.errorCode` without SQL text, host, username, password or driver message.
Codes distinguish missing `MYSQL_*`, auth/permission, missing database/schema,
DNS, network and TLS failures. A healthy ping proves database connectivity;
verify catalog/login separately to confirm schema and seeded data.

## Test accounts and endpoints

| Username | Fixture password | Role | Owned orders |
|---|---|---|---|
| thanhtung | Password123! | customer | 1001, 1002 |
| customer01 | UserSecret123! | customer | 2001, 900875 |
| admin | AdminPassword123! | admin | May read all orders |

Login: `POST /api/auth/login` with JSON `username`, `password`. Use the returned
JWT in `Authorization: Bearer <token>`. JWT signing/verifying uses the same
environment secret. Order IDs remain numeric application IDs.

Other routes: `/api/products`, `/api/orders`, `/api/orders/:id`,
`/preview/echo?name=...`, `/api/files/download?file=...`. Clean preview retains the
HTML escaping remediation from commit `c979eda`; downloads stay inside the datasheet directory, and order reads
enforce ownership. Two seeded products do not have bundled datasheet files.

## ACVIS benchmark

The SQL migration restores a clean login and clean preview. The login query is
`SELECT * FROM electrohub_users WHERE username = ? AND CAST(password AS BINARY) = CAST(? AS BINARY)`.
Bound calls to `dbConnection.query` use MySQL **server-side prepared statements**
through `mysql2.execute`. The binary password comparison also rejects case,
accent and trailing-space changes regardless of database collation.
Raw benchmark calls use the actual SQL engine through
`mysql2.query`, with multiple statements disabled. There is no SQL emulation.

| CWE | ACVIS record | Rule | Location |
|---|---|---|---|
| 89 | `6a9ad52b011ecda8a0e8e4d4` / alternate `6a990927011ecda8a0e8bc75` | `cn_664` / `appointment_00080` | Login SQL |
| 79 | `6a990918011ecda8a0e8bc6c` | `javascript_express_js_refund_00009` | Preview reflection |
| 22 | `6a99091f011ecda8a0e8bc70` | `javascript_express_js_warehouse_00061` | File download |
| 639 | `6a997a82011ecda8a0e8bf71` | `gen_idor_javascript_2896` | Order ownership |
| 798 | `6a998063011ecda8a0e8cd59` | `gen_secret_javascript_5160` | JWT secret |

IDs are requester-supplied and have not been verified by reading ACVISDB.
Source patterns and runtime evidence do not guarantee selection of a specific
rule ID. Confirm webhook intake/Scan Job creation before adding each weakness.

Create one weakness per commit when testing sequentially. `apply-vulns` applies
all five at once and is only for an explicit all-five exercise. It saves the
clean route files in ignored `.benchmark-clean/`; `restore-clean` restores that
snapshot and overwrites subsequent route edits. Save edits before restoring.
The snapshot is local and does not travel with Git. Record the clean commit SHA
as a separate restore point. JWT benchmark strings must be synthetic.

Vercel automatically deploys main pushes. A vulnerable commit changes the live
test application. Keep other applications' data out of benchmark queries and
use read-only probes against fixture records only.

## Validation

```powershell
npm.cmd test
```

Offline HTTP tests mock only the mysql2 driver and use seeded fixtures. They
verify HTTP contracts, ownership, clean payload blocking, pool configuration,
prepared/raw dispatch and LF/CRLF benchmark apply/restore. They do not emulate
SQL injection. Runtime SQL behavior must be checked against the real engine.

For the full suite against SQL, configure `.env.test` with a separately owned
database whose name ends in `_test`, seed that database, then run:

```powershell
node --env-file=.env.test scripts/seed-db.js
npm.cmd run test:integration
```

Integration refuses missing settings and has no mock fallback. Use a dedicated
test database because the persistence suite creates orders. `.env.test` is
ignored. Do not run that suite against a shared application's database.
