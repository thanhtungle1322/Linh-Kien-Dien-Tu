/**
 * ElectroHub Database Layer
 * Provides data access models for Users, Electronic Component Products, Orders, and Datasheets.
 * Supports both parameterized queries and standard ORM findOne methods.
 */

// Initial seed products for electronic components store
const initialProducts = [
  {
    id: 1,
    name: "Arduino Uno R3 (ATmega328P)",
    category: "Microcontroller",
    price: 185000,
    stock: 45,
    rating: 4.9,
    description: "Bo mạch vi điều khiển ATmega328P, 16MHz, 14 chân I/O số, 6 chân PWM, 6 chân Analog. Chuẩn cắm USB Type-B.",
    datasheet: "arduino-uno-r3.pdf",
    image: "https://images.unsplash.com/photo-1608555855762-2b657eb1c348?w=500&auto=format&fit=crop&q=60"
  },
  {
    id: 2,
    name: "Module WiFi & Bluetooth ESP32-WROOM-32",
    category: "Wireless & IoT",
    price: 95000,
    stock: 120,
    rating: 4.8,
    description: "Module SoC WiFi 802.11 b/g/n + Bluetooth 4.2 BR/EDR & BLE. Dual-Core Tensilica Xtensa 32-bit LX6 240MHz.",
    datasheet: "esp32-wroom-32.pdf",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=60"
  },
  {
    id: 3,
    name: "Kit Phát Triển STM32F103C8T6 Blue Pill",
    category: "Microcontroller",
    price: 65000,
    stock: 80,
    rating: 4.7,
    description: "Lõi ARM Cortex-M3 32-bit, tần số hoạt động 72MHz, 64KB Flash, 20KB SRAM. Hỗ trợ giao tiếp SWD nạp code tốc độ cao.",
    datasheet: "stm32f103c8t6.pdf",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=500&auto=format&fit=crop&q=60"
  },
  {
    id: 4,
    name: "Cảm Biến Nhiệt Độ & Độ Ẩm DHT22 (AM2302)",
    category: "Sensors",
    price: 75000,
    stock: 60,
    rating: 4.8,
    description: "Cảm biến số độ chính xác cao: nhiệt độ -40 đến 80°C (sai số ±0.5°C), độ ẩm 0-100% RH (sai số ±2%).",
    datasheet: "dht22-sensor.pdf",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60"
  },
  {
    id: 5,
    name: "Cảm Biến Siêu Âm Đo Khoảng Cách HC-SR04",
    category: "Sensors",
    price: 25000,
    stock: 150,
    rating: 4.6,
    description: "Khoảng cách đo 2cm - 400cm, góc quét 15 độ, độ chính xác 3mm. Tín hiệu xung kích hoạt TTL 10us.",
    datasheet: "hc-sr04.pdf",
    image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=60"
  },
  {
    id: 6,
    name: "IC Ổn Áp Tuyến Tính LM7805 5V 1.5A TO-220",
    category: "Power & IC",
    price: 8000,
    stock: 500,
    rating: 4.9,
    description: "IC hạ áp tuyến tính điện áp ngõ ra cố định 5VDC, dòng điện tải tối đa 1.5A, tích hợp bảo vệ quá nhiệt và quá dòng.",
    datasheet: "lm7805-datasheet.pdf",
    image: "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=500&auto=format&fit=crop&q=60"
  },
  {
    id: 7,
    name: "IC Định Thời Gian Đa Năng NE555P DIP-8",
    category: "Power & IC",
    price: 5000,
    stock: 800,
    rating: 4.9,
    description: "IC tạo xung dao động, trễ thời gian đơn ổn hoặc đa ổn (Astable/Monostable multivibrator), dải nguồn 4.5V - 16V.",
    datasheet: "ne555-datasheet.pdf",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=60"
  },
  {
    id: 8,
    name: "Module Relay 5V 4 Kênh Cách Ly Quang",
    category: "Modules",
    price: 52000,
    stock: 75,
    rating: 4.8,
    description: "Đóng cắt dòng tải AC 250V/10A hoặc DC 30V/10A. Cách ly quang Optocoupler chống nhiễu ngược về vi điều khiển.",
    datasheet: "relay-4ch.pdf",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60"
  }
];

// Initial seed users
const usersTable = [
  {
    id: 1,
    username: "admin",
    password: "AdminPassword123!",
    email: "admin@electrohub.vn",
    role: "admin",
    fullName: "Quản Trị Viên Hệ Thống"
  },
  {
    id: 2,
    username: "thanhtung",
    password: "Password123!",
    email: "tungthanhle1322004@gmail.com",
    role: "customer",
    fullName: "Lê Thanh Tùng"
  },
  {
    id: 3,
    username: "customer01",
    password: "UserSecret123!",
    email: "customer01@electrohub.vn",
    role: "customer",
    fullName: "Nguyễn Văn An"
  }
];

// Initial seed orders
const ordersTable = [
  {
    id: 1001,
    userId: 2,
    customerName: "Lê Thanh Tùng",
    items: [
      { productId: 1, name: "Arduino Uno R3 (ATmega328P)", quantity: 1, price: 185000 },
      { productId: 2, name: "Module WiFi & Bluetooth ESP32-WROOM-32", quantity: 2, price: 95000 }
    ],
    totalAmount: 375000,
    shippingAddress: "Số 12 Đường Điện Biên Phủ, Quận Bình Thạnh, TP.HCM",
    status: "Đã giao hàng",
    paymentMethod: "COD",
    createdAt: "2026-11-01T08:30:00.000Z"
  },
  {
    id: 1002,
    userId: 2,
    customerName: "Lê Thanh Tùng",
    items: [
      { productId: 4, name: "Cảm Biến Nhiệt Độ & Độ Ẩm DHT22 (AM2302)", quantity: 1, price: 75000 },
      { productId: 8, name: "Module Relay 5V 4 Kênh Cách Ly Quang", quantity: 1, price: 52000 }
    ],
    totalAmount: 127000,
    shippingAddress: "Số 12 Đường Điện Biên Phủ, Quận Bình Thạnh, TP.HCM",
    status: "Đang xử lý",
    paymentMethod: "Chuyển khoản",
    createdAt: "2026-11-04T14:15:00.000Z"
  },
  {
    id: 2001,
    userId: 3,
    customerName: "Nguyễn Văn An",
    items: [
      { productId: 3, name: "Kit Phát Triển STM32F103C8T6 Blue Pill", quantity: 2, price: 65000 },
      { productId: 5, name: "Cảm Biến Siêu Âm Đo Khoảng Cách HC-SR04", quantity: 4, price: 25000 }
    ],
    totalAmount: 230000,
    shippingAddress: "Toà nhà FPT, Cầu Giấy, Hà Nội",
    status: "Đã thanh toán",
    paymentMethod: "Ví điện tử",
    createdAt: "2026-11-02T10:00:00.000Z"
  },
  {
    id: 900875,
    userId: 3,
    customerName: "Nguyễn Văn An (Doanh Nghiệp IoT)",
    items: [
      { productId: 2, name: "Module WiFi & Bluetooth ESP32-WROOM-32", quantity: 10, price: 95000 },
      { productId: 6, name: "IC Ổn Áp Tuyến Tính LM7805 5V 1.5A TO-220", quantity: 50, price: 8000 }
    ],
    totalAmount: 1350000,
    shippingAddress: "Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM",
    status: "Đã xác nhận",
    paymentMethod: "Hợp đồng thương mại",
    createdAt: "2026-11-03T16:45:00.000Z"
  }
];


module.exports = { initialProducts, usersTable, ordersTable };
