const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ElectroHub - Cửa Hàng Linh Kiện Điện Tử & IoT`);
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log(`🛡️  Security State: Initial Clean Release (0 Vulnerabilities)`);
  console.log(`=======================================================`);
});
