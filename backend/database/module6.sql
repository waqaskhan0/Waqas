ALTER TABLE approval_logs
MODIFY action ENUM(
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'COMMENTED',
  'ISSUED',
  'PARTIAL_PROCUREMENT',
  'PROCUREMENT_REQUESTED',
  'PARTIAL_RECEIPT',
  'RECEIVED'
) NOT NULL;

ALTER TABLE inventory_transactions
MODIFY transaction_type ENUM(
  'ISSUE',
  'RECEIPT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT'
) NOT NULL;

ALTER TABLE purchase_order_lines
ADD COLUMN quantity_received DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER quantity_ordered;

CREATE TABLE goods_receipts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  grn_number VARCHAR(30) NOT NULL UNIQUE,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  received_by_user_id BIGINT UNSIGNED NOT NULL,
  delivery_note_number VARCHAR(60) NULL,
  remarks VARCHAR(500) NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_goods_receipts_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_goods_receipts_receiver FOREIGN KEY (received_by_user_id) REFERENCES users(id)
);

CREATE TABLE goods_receipt_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  goods_receipt_id BIGINT UNSIGNED NOT NULL,
  purchase_order_line_id BIGINT UNSIGNED NOT NULL,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  quantity_received DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_goods_receipt_lines_receipt FOREIGN KEY (goods_receipt_id) REFERENCES goods_receipts(id),
  CONSTRAINT fk_goods_receipt_lines_po_line FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_lines(id),
  CONSTRAINT fk_goods_receipt_lines_stock_item FOREIGN KEY (stock_item_id) REFERENCES inventory_stock(id)
);

CREATE INDEX idx_goods_receipts_po ON goods_receipts(purchase_order_id);
CREATE INDEX idx_goods_receipts_received_at ON goods_receipts(received_at);
CREATE INDEX idx_goods_receipt_lines_receipt ON goods_receipt_lines(goods_receipt_id);
CREATE INDEX idx_goods_receipt_lines_po_line ON goods_receipt_lines(purchase_order_line_id);
