CREATE TABLE IF NOT EXISTS electrohub_users (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  fullName VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS electrohub_products (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(80) NOT NULL,
  price DECIMAL(14,2) NOT NULL,
  stock INT NOT NULL,
  rating DECIMAL(3,2) NOT NULL,
  description TEXT NOT NULL,
  datasheet VARCHAR(255) NOT NULL,
  image TEXT NOT NULL,
  INDEX ix_electrohub_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS electrohub_orders (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  customerName VARCHAR(255) NOT NULL,
  items JSON NOT NULL,
  totalAmount DECIMAL(14,2) NOT NULL,
  shippingAddress TEXT NOT NULL,
  paymentMethod VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  createdAt VARCHAR(32) NOT NULL,
  INDEX ix_electrohub_order_user (userId),
  CONSTRAINT fk_electrohub_order_user FOREIGN KEY (userId) REFERENCES electrohub_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
