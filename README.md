# ElectroHub - Cửa Hàng Linh Kiện Điện Tử & IoT ⚡
> Nền tảng thương mại điện tử chuyên cung cấp vi điều khiển, module truyền thông RF, cảm biến và linh kiện điện tử nhúng, đồng thời là bộ test benchmark chuẩn cho hệ thống phân tích bảo mật **ACVIS**.

---

## 📌 1. Giới thiệu dự án

**ElectroHub** được xây dựng bằng JavaScript trên nền tảng **Node.js** và **Express.js**, phục vụ khách hàng tìm kiếm, tra cứu datasheet kỹ thuật, đặt mua các linh kiện điện tử (Arduino, ESP32, STM32, cảm biến DHT22, HC-SR04, IC nguồn LM7805, NE555...) và theo dõi hóa đơn mua hàng.

Đồng thời, mã nguồn được thiết kế với kiến trúc mô-đun chuẩn để kiểm thử quy trình quét mã tĩnh (SAST), phân tích AST/Taint-Analysis và đối sánh cơ sở tri thức (RAG) của nền tảng **ACVIS**.

---

## 🛡️ 2. Danh mục 5 Lỗ hổng Benchmark theo ACVISDB

Bản phát hành đầu tiên (**Commit 1 - Clean Release**) tuân thủ nghiêm ngặt các khuyến nghị OWASP Top 10 và các chuẩn lập trình an toàn, **hoàn toàn không có lỗ hổng bảo mật**.

Trong lần commit tiếp theo (**Commit 2 - Vulnerable Diff**), các đoạn mã sẽ được cập nhật chứa đúng 5 mẫu lỗ hổng tương ứng với các Record ID trong cơ sở dữ liệu `ACVISDB`:

| STT | Loại lỗ hổng | Database _id (MongoDB) | Mã Rule (rule_id) | File & Endpoint | Trạng thái Bản Đầu (Commit 1) | Trạng thái Bản Sau (Commit 2) |
|---|---|---|---|---|---|---|
| **1** | **CWE-89**<br>(SQL Injection) | `6a9ad52b011ecda8a0e8e4d4`<br>*(hoặc 6a990927011ecda8a0e8bc75)* | `cn_664`<br>*(hoặc appointment_00080)* | `routes/auth.js`<br>`POST /api/auth/login` | **An toàn**: Sử dụng parameterized query `[?]` | **Lỗ hổng**: Nối chuỗi trực tiếp `${username}` `${password}` vào câu truy vấn SQL |
| **2** | **CWE-79**<br>(Reflected XSS) | `6a990918011ecda8a0e8bc6c` | `javascript_express_js_refund_00009` | `routes/products.js`<br>`GET /preview/echo` | **An toàn**: Sử dụng `escape-html` và trả lời JSON có cấu trúc | **Lỗ hổng**: Trả về trực tiếp HTML thô không qua escape `res.send(...)` |
| **3** | **CWE-22**<br>(Path Traversal) | `6a99091f011ecda8a0e8bc70` | `javascript_express_js_warehouse_00061` | `routes/files.js`<br>`GET /api/files/download` | **An toàn**: Lọc tên file qua `path.basename()` và kiểm tra giới hạn thư mục hợp lệ | **Lỗ hổng**: Nối trực tiếp query `file` vào đường dẫn file download |
| **4** | **CWE-639**<br>(IDOR) | `6a997a82011ecda8a0e8bf71` | `gen_idor_javascript_2896` | `routes/orders.js`<br>`GET /api/orders/:id` | **An toàn**: Xác thực quyền sở hữu giữa `req.user.id` và đơn hàng trước khi trả về | **Lỗ hổng**: Truy vấn trực tiếp đơn hàng theo `id` mà không kiểm tra quyền của người dùng |
| **5** | **CWE-798**<br>(Hardcoded Secret) | `6a998063011ecda8a0e8cd59` | `gen_secret_javascript_5160` | `routes/auth.js`<br>`HARDCODED_JWT_SECRET` | **An toàn**: Đọc khóa bí mật từ biến môi trường `process.env.JWT_SECRET` | **Lỗ hổng**: Hardcode trực tiếp chuỗi token bí mật trong mã nguồn |

---

## 📂 3. Cấu trúc thư mục

```text
Linh-Kien-Dien-Tu/
├── .env.example              # Mẫu biến môi trường an toàn
├── .gitignore                # Bỏ qua node_modules, .env, temp files
├── app.js                    # Khởi tạo Express, cấu hình middleware & routing
├── db/
│   └── database.js           # Lớp dữ liệu linh kiện, người dùng, đơn hàng & hỗ trợ SQL
├── middleware/
│   └── auth.js               # Xác thực JWT Bearer Token
├── package.json              # Khai báo dependencies & test scripts
├── public/                   # Giao diện web người dùng (HTML5/CSS3/Vanilla JS)
│   ├── css/
│   │   └── style.css         # Giao diện chủ đề công nghệ, linh kiện điện tử hiện đại
│   ├── datasheets/           # Thư mục lưu trữ tài liệu PDF kỹ thuật linh kiện
│   │   ├── arduino-uno-r3.pdf
│   │   ├── dht22-sensor.pdf
│   │   ├── esp32-wroom-32.pdf
│   │   ├── lm7805-datasheet.pdf
│   │   ├── ne555-datasheet.pdf
│   │   └── stm32f103c8t6.pdf
│   ├── index.html            # Trang chủ hiển thị danh mục, giỏ hàng, tra cứu & xem trước
│   └── js/
│       └── app.js            # Xử lý tương tác client-side, gọi API & quản lý phiên
├── routes/
│   ├── auth.js               # Đăng nhập & cấp phát token (CWE-89 & CWE-798 target)
│   ├── files.js              # Tải datasheet kỹ thuật (CWE-22 target)
│   ├── orders.js             # Quản lý & xem hóa đơn đơn hàng (CWE-639 target)
│   └── products.js           # Danh mục linh kiện & xem trước nhãn (CWE-79 target)
├── server.js                 # Điểm khởi chạy HTTP Server
└── tests/                    # Bộ kiểm thử tự động (Unit & Security tests)
    ├── auth.test.js
    ├── files.test.js
    ├── orders.test.js
    └── products.test.js
```

---

## 🚀 4. Hướng dẫn cài đặt & Chạy ứng dụng

### 4.1 Cài đặt dependencies
```bash
npm install
```

### 4.2 Thiết lập biến môi trường
Tạo file `.env` từ `.env.example`:
```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=electrohub_development_environment_jwt_secret_token_2026
```

### 4.3 Khởi chạy máy chủ
```bash
npm start
```
Truy cập ứng dụng tại: [http://localhost:3000](http://localhost:3000)

### 4.4 Chạy bộ kiểm thử tự động
```bash
npm test
```
Tất cả 18 test cases về chức năng và bảo mật đều vượt qua (100% Pass).

---

## 🔑 5. Tài khoản mẫu để kiểm thử

| Tên đăng nhập | Mật khẩu | Quyền hạn (Role) | Đơn hàng sở hữu |
|---|---|---|---|
| `thanhtung` | `Password123!` | Khách hàng (`customer`) | Đơn hàng `#1001`, `#1002` |
| `customer01`| `UserSecret123!` | Khách hàng (`customer`) | Đơn hàng `#2001`, `#900875` |
| `admin` | `AdminPassword123!` | Quản trị viên (`admin`) | Toàn quyền xem mọi đơn hàng |

---

## 🔄 6. Chuẩn bị cho Commit 2 (Vulnerable Diff Testing)

Để kiểm thử tính năng bắt lỗi tự động qua GitHub Webhook và diff commit của ACVIS:
1. Kết nối repository `https://github.com/thanhtungle1322/Linh-Kien-Dien-Tu.git` vào hệ thống ACVIS.
2. Bản `v1.0.0` (Commit 1) sẽ cho kết quả **0 lỗ hổng**.
3. Khi bạn kích hoạt commit thứ 2, các đoạn code chứa 5 lỗ hổng trên sẽ được đẩy lên, ACVIS sẽ bắt được chính xác 5 finding tương ứng với các Rule ID trên!
