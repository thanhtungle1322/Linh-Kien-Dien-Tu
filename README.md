# ElectroHub — Linh Kiện Điện Tử

Express/Node.js storefront and ACVIS commit-scanning benchmark, deployed as a
Vercel Node.js function through `api/index.js`. Runtime storage is MongoDB Atlas
only. There is no in-memory database fallback. Requires Node.js 22 or newer.

## Cấu hình MongoDB Atlas

1. Tạo project và cluster trong MongoDB Atlas.
2. **Database Access**: tạo database user riêng cho ứng dụng, cấp quyền
   `readWrite` trên database `electrohub`. Đây là database user, khác tài khoản
   đăng nhập Atlas. Không dùng database `ACVISDB` làm nơi lưu dữ liệu cửa hàng.
3. **Network Access**: thêm IP public máy bạn để seed/test local. Khi chạy trên
   Vercel, phải cho phép cả IP outbound của môi trường triển khai. Nếu dùng
   outbound động, cấu hình giải pháp egress cố định hoặc IP access list phù hợp;
   chỉ thêm IP máy cá nhân sẽ không đủ cho Vercel.
4. **Connect → Drivers → Node.js**: sao chép connection string `mongodb+srv://...`.
   Thay username/password; percent-encode ký tự đặc biệt trong username/password
   (ví dụ `@` thành `%40`). Không encode toàn bộ URI.

Tham khảo: [Atlas connection setup](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/),
[connection strings](https://www.mongodb.com/docs/manual/reference/connection-string/).

Tạo `.env` từ `.env.example` rồi điền:

```dotenv
PORT=3000
NODE_ENV=production
JWT_SECRET=<random-secret-at-least-32-characters>
MONGODB_URI=mongodb+srv://<db-user>:<encoded-password>@<cluster-host>/?retryWrites=true&w=majority
MONGODB_DB_NAME=electrohub
```

Sinh JWT secret một lần bằng PowerShell, sau đó chép kết quả vào `.env` và Vercel:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Không commit `.env`, URI chứa mật khẩu hoặc JWT secret.

```powershell
npm.cmd ci
npm.cmd run seed:db
npm.cmd start
```

Seed tạo `users`, `products`, `orders`, unique index trên `id`, unique index
`users.username`, index `orders.userId`. Chạy lại không ghi đè record đã có và
không xóa dữ liệu. 3 user, 8 sản phẩm, 4 đơn mẫu được khai báo trong
`db/seed-data.js`; file này chỉ được dùng khi seed, không làm database runtime.
Seed dùng tài khoản/mật khẩu mẫu dạng plaintext phục vụ benchmark, không phải
thiết kế xác thực cho cửa hàng thật. Có 2 sản phẩm chưa có datasheet đi kèm.

## Triển khai Vercel

Import repository trên Vercel. Dùng **Other** framework preset, để Build Command
và Output Directory mặc định/không override; repository không cần bước build
frontend. `vercel.json` chuyển request vào `api/index.js` và kèm `public/**`.

Trong **Settings → Environment Variables**, đặt `MONGODB_URI`,
`MONGODB_DB_NAME`, `JWT_SECRET`, `NODE_ENV=production` cho môi trường bạn dùng
(Production/Preview). Không cần `PORT` trên Vercel. Redeploy sau khi đổi biến.
Seed từ máy local một lần trước khi sử dụng website; request không tự seed.
Nên dùng database riêng cho Preview để tách các lần thử nghiệm.

Kết nối được khởi tạo lazy, tái sử dụng trong mỗi warm function instance, pool
tối đa 5 connection mỗi instance. Lỗi kết nối không chuyển sang dữ liệu giả.

Sau deploy, kiểm tra `GET https://<your-domain>/api/health`:

```json
{"status":"healthy","database":{"provider":"mongodb","status":"connected"}}
```

Response thật còn có metadata/timestamp. Thiếu cấu hình hoặc ping DB lỗi trả
503 với `database.status=unavailable`. Sai/thiếu JWT secret làm ứng dụng không
khởi tạo được. Khi gặp timeout: kiểm tra IP access list, cluster, database user,
password encoding và biến môi trường đúng deployment; không đưa URI vào log.

Health lỗi có thêm `database.errorCode`, chỉ chứa mã cố định, không chứa URI,
password hoặc thông báo thô từ driver:

| Mã | Kiểm tra |
|---|---|
| `MONGODB_URI_MISSING` | Deployment chưa nhận biến `MONGODB_URI` |
| `MONGODB_DB_NAME_MISSING` | Deployment chưa nhận biến `MONGODB_DB_NAME` |
| `MONGODB_URI_INVALID` | Cú pháp URI hoặc tham số kết nối |
| `MONGODB_AUTH_FAILED` | Database username/password và authSource |
| `MONGODB_PERMISSION_DENIED` | Quyền của database user |
| `MONGODB_DNS_FAILED` | DNS/SRV của hostname trong URI |
| `MONGODB_NETWORK_FAILED` | IP access list, cluster, mạng/TLS hoặc server selection |
| `MONGODB_CONNECTION_FAILED` | Lỗi chưa phân loại; cần kiểm tra thêm |

Các mã chỉ phân nhóm lỗi, không chứng minh một nguyên nhân cụ thể. Đổi biến
Vercel cần deployment mới; đổi IP access list Atlas không cần build lại code.

## Tài khoản benchmark

| User | Password mẫu | Quyền | Đơn sở hữu |
|---|---|---|---|
| thanhtung | Password123! | customer | 1001, 1002 |
| customer01 | UserSecret123! | customer | 2001, 900875 |
| admin | AdminPassword123! | admin | Xem mọi đơn |

Đăng nhập `POST /api/auth/login` với JSON `username`, `password`; sử dụng token
trả về qua `Authorization: Bearer <token>`. Order ID vẫn là số trong field `id`,
không chuyển thành MongoDB ObjectId. Dữ liệu mới được lưu qua các lần cold start.

## 5 record ACVIS cần đối chiếu

| CWE | MongoDB record bên ACVIS | Rule | Endpoint/file |
|---|---|---|---|
| 89 | `6a9ad52b011ecda8a0e8e4d4` (hoặc `6a990927011ecda8a0e8bc75`) | `cn_664` / `appointment_00080` | `routes/auth.js`, POST `/api/auth/login` |
| 79 | `6a990918011ecda8a0e8bc6c` | `javascript_express_js_refund_00009` | `routes/products.js`, GET `/preview/echo?name=...` |
| 22 | `6a99091f011ecda8a0e8bc70` | `javascript_express_js_warehouse_00061` | `routes/files.js`, GET `/api/files/download?file=...` |
| 639 | `6a997a82011ecda8a0e8bf71` | `gen_idor_javascript_2896` | `routes/orders.js`, GET `/api/orders/:id` |
| 798 | `6a998063011ecda8a0e8cd59` | `gen_secret_javascript_5160` | JWT literal trong `routes/auth.js` |

Các ID do người dùng cung cấp, chưa được xác nhận bằng truy vấn ACVISDB. Không
cam kết scanner sẽ chọn chính xác rule hay luôn tạo đúng 5 finding.

MongoDB không thực thi SQL. Login clean dùng query object có kiểm tra string để
chặn operator injection. `dbConnection.query` giữ calling seam cho **mẫu mã tĩnh
CWE-89**, không phải SQL driver. Sau `apply-vulns`, raw SQL bị từ chối và login
trả 500; không có mô phỏng SQL hoặc xác nhận SQL Injection qua runtime. Muốn
kiểm chứng động CWE-89 phải bổ sung SQL engine thật.

## Quy trình commit benchmark

1. Cấu hình, seed, kiểm tra bản clean và commit baseline.
2. `npm.cmd run apply-vulns`: thay đủ 5 mẫu mã nguồn trong 4 route, kiểm tra
   các block trước khi ghi. Hỗ trợ LF/CRLF. Lưu nguyên bản clean trong
   `.benchmark-clean/` (Git ignore); không chạy đè khi backup đang tồn tại.
3. Review diff và commit bản vulnerable để ACVIS quét. Không tự động deploy
   bản vulnerable lên website dùng chung. Nếu Vercel tự deploy theo Git branch,
   kiểm soát deployment/branch test trước khi push.
4. `npm.cmd run restore-clean`: khôi phục từ backup đã lưu, kể cả khi đã commit
   bản vulnerable. Script này ghi đè 4 route; lưu riêng thay đổi mới trước khi
   restore. Backup chỉ tồn tại trên máy chạy apply, không đi theo Git clone.
   Mất backup thì lấy lại 4 route từ SHA baseline đã lưu.
5. Test và commit bản fixed để kiểm tra quét diff sau sửa.

Bản vulnerable IDOR vẫn yêu cầu token nhưng bỏ kiểm tra ownership. Đối chứng
ACVIS: chủ đơn `customer01`/900875 (marker `userId=3`), người thứ hai
`thanhtung`/1001 (marker `userId=2`); dùng token của hai customer, không dùng
admin. Lấy token **trước** khi deploy bản vulnerable do giới hạn SQL trên.
Khóa benchmark được thay có chủ đích; token cũ phải được tạo lại với khóa đó
trong môi trường test riêng nếu cần test IDOR sau đổi khóa. Có thể apply từng
mẫu thủ công để test runtime độc lập, không cần bật cả 5 đồng thời.

Path traversal dùng file có thật dưới `public/datasheets`; dùng file đối chứng
vô hại như `../../package.json`, không dùng dữ liệu riêng tư. Preview UI hiển
thị response HTML dạng text; kiểm tra phản chiếu XSS trực tiếp tại endpoint.
Secret benchmark là chuỗi giả; không dùng credential thật.

## Kiểm thử

```powershell
npm.cmd test
```

Test offline qua Express HTTP, mock **MongoDB driver**; không chứng minh Atlas,
Vercel hoặc ACVIS production hoạt động. Runtime không chứa provider RAM.

Để chạy HTTP tests qua MongoDB thật, tạo `.env.test` từ `.env.example`, điền
URI Atlas và đặt `MONGODB_DB_NAME=electrohub_test` (bắt buộc kết thúc `_test`).
Seed database test rồi chạy suite thật:

```powershell
node --env-file=.env.test scripts/seed-db.js
npm.cmd run test:integration
```

Lệnh integration nạp `.env.test` và báo lỗi nếu thiếu cấu hình, không tự chuyển
sang mock. Suite tạo thêm đơn hàng; chỉ dùng database test riêng. `.env.test`
được Git ignore. Không ghi mật khẩu vào command history hoặc gửi lên Git.
