const app = require("./app");

const PORT = process.env.PORT || 3000;

require('./db/database').health().then(() => app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ElectroHub - Cửa Hàng Linh Kiện Điện Tử & IoT`);
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log('MongoDB connected');
  console.log(`=======================================================`);
})).catch(() => {
  console.error('Startup failed. Check MongoDB configuration and Atlas network access.');
  process.exitCode = 1;
  require('./db/database').closeDatabase();
});
