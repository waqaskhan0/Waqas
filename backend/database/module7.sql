CREATE TABLE finance_matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  finance_user_id BIGINT UNSIGNED NOT NULL,
  invoice_number VARCHAR(60) NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_amount DECIMAL(14, 2) NOT NULL,
  po_amount DECIMAL(14, 2) NOT NULL,
  received_amount DECIMAL(14, 2) NOT NULL,
  variance_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status ENUM('MATCHED', 'MISMATCH') NOT NULL,
  remarks VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_finance_matches_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_finance_matches_user FOREIGN KEY (finance_user_id) REFERENCES users(id)
);

CREATE TABLE finance_match_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  finance_match_id BIGINT UNSIGNED NOT NULL,
  purchase_order_line_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  quantity_billed DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(14, 2) NOT NULL,
  expected_quantity DECIMAL(10, 2) NOT NULL,
  expected_unit_price DECIMAL(12, 2) NOT NULL,
  expected_line_total DECIMAL(14, 2) NOT NULL,
  status ENUM('MATCHED', 'MISMATCH') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_finance_match_lines_match FOREIGN KEY (finance_match_id) REFERENCES finance_matches(id),
  CONSTRAINT fk_finance_match_lines_po_line FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_lines(id),
  CONSTRAINT uq_finance_match_lines UNIQUE (finance_match_id, purchase_order_line_id)
);

CREATE INDEX idx_finance_matches_po ON finance_matches(purchase_order_id);
CREATE INDEX idx_finance_matches_status ON finance_matches(status);
CREATE INDEX idx_finance_match_lines_match ON finance_match_lines(finance_match_id);
