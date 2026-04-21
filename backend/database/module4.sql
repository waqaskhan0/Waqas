ALTER TABLE requisitions
MODIFY status ENUM(
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'PROCUREMENT_PENDING',
  'PARTIALLY_FULFILLED',
  'FULFILLED'
) NOT NULL DEFAULT 'SUBMITTED';

ALTER TABLE approval_logs
MODIFY action ENUM(
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'COMMENTED',
  'ISSUED',
  'PARTIAL_PROCUREMENT',
  'PROCUREMENT_REQUESTED'
) NOT NULL;

CREATE TABLE inventory_stock (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  item_name VARCHAR(160) NOT NULL,
  specification VARCHAR(255) NULL,
  unit VARCHAR(30) NOT NULL,
  quantity_on_hand DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE inventory_allocations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_item_id BIGINT UNSIGNED NOT NULL UNIQUE,
  stock_item_id BIGINT UNSIGNED NULL,
  processed_by_user_id BIGINT UNSIGNED NOT NULL,
  quantity_requested DECIMAL(10, 2) NOT NULL,
  quantity_issued DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity_for_procurement DECIMAL(10, 2) NOT NULL DEFAULT 0,
  resolution ENUM('ISSUED', 'PARTIAL_PROCUREMENT', 'PROCUREMENT_ONLY') NOT NULL,
  remarks VARCHAR(500) NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_allocations_requisition_item FOREIGN KEY (requisition_item_id) REFERENCES requisition_items(id),
  CONSTRAINT fk_inventory_allocations_stock_item FOREIGN KEY (stock_item_id) REFERENCES inventory_stock(id),
  CONSTRAINT fk_inventory_allocations_user FOREIGN KEY (processed_by_user_id) REFERENCES users(id)
);

CREATE TABLE inventory_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NULL,
  requisition_item_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT') NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_transactions_stock_item FOREIGN KEY (stock_item_id) REFERENCES inventory_stock(id),
  CONSTRAINT fk_inventory_transactions_requisition FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  CONSTRAINT fk_inventory_transactions_requisition_item FOREIGN KEY (requisition_item_id) REFERENCES requisition_items(id),
  CONSTRAINT fk_inventory_transactions_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX idx_inventory_stock_name ON inventory_stock(item_name);
CREATE INDEX idx_inventory_allocations_stock_item ON inventory_allocations(stock_item_id);
CREATE INDEX idx_inventory_transactions_stock_item ON inventory_transactions(stock_item_id);
CREATE INDEX idx_inventory_transactions_requisition ON inventory_transactions(requisition_id);

INSERT INTO inventory_stock (
  sku,
  item_name,
  specification,
  unit,
  quantity_on_hand,
  reorder_level
) VALUES
  ('PVC-TANK-1000', 'watertank pvc', '1000 litre', 'pcs', 25, 10),
  ('WIRE-MOUSE-ERG', 'wireless mouse', 'Bluetooth ergonomic', 'pcs', 40, 8),
  ('KB-MECH-STD', 'mechanical keyboard', 'Standard office layout', 'pcs', 12, 4);
