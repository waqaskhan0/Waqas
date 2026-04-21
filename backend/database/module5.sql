CREATE TABLE vendors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendor_code VARCHAR(30) NOT NULL UNIQUE,
  vendor_name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120) NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(40) NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(30) NOT NULL UNIQUE,
  requisition_id BIGINT UNSIGNED NOT NULL UNIQUE,
  vendor_id BIGINT UNSIGNED NOT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'ISSUED',
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_delivery_date DATE NULL,
  subtotal_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_orders_requisition FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  CONSTRAINT fk_purchase_orders_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_purchase_orders_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE purchase_order_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  requisition_item_id BIGINT UNSIGNED NOT NULL UNIQUE,
  inventory_allocation_id BIGINT UNSIGNED NULL,
  line_number INT UNSIGNED NOT NULL,
  item_description VARCHAR(160) NOT NULL,
  specification VARCHAR(255) NULL,
  unit VARCHAR(30) NOT NULL,
  quantity_ordered DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(14, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_order_lines_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_purchase_order_lines_requisition_item FOREIGN KEY (requisition_item_id) REFERENCES requisition_items(id),
  CONSTRAINT fk_purchase_order_lines_allocation FOREIGN KEY (inventory_allocation_id) REFERENCES inventory_allocations(id),
  CONSTRAINT uq_purchase_order_lines_line UNIQUE (purchase_order_id, line_number)
);

CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_order_lines_po ON purchase_order_lines(purchase_order_id);

INSERT INTO vendors (
  vendor_code,
  vendor_name,
  contact_name,
  email,
  phone
) VALUES
  ('VND-001', 'Apex Industrial Supplies', 'Hassan Ali', 'orders@apex.local', '+92-300-1111111'),
  ('VND-002', 'Metro Procurement House', 'Sara Khan', 'sales@metroproc.local', '+92-300-2222222'),
  ('VND-003', 'Prime Storage Systems', 'Usman Tariq', 'support@primestorage.local', '+92-300-3333333');
