CREATE TABLE roles (
  code VARCHAR(32) PRIMARY KEY,
  label VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO roles (code, label) VALUES
  ('EMPLOYEE', 'Employee'),
  ('LINE_MANAGER', 'Line Manager'),
  ('INVENTORY_OFFICER', 'Inventory Officer'),
  ('PROCUREMENT_OFFICER', 'Procurement Officer'),
  ('FINANCE', 'Finance'),
  ('HR_OFFICER', 'HR Officer'),
  ('SUPER_ADMIN', 'Super Admin');

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_code VARCHAR(32) NOT NULL,
  department VARCHAR(100) NOT NULL,
  manager_id BIGINT UNSIGNED NULL,
  basic_salary DECIMAL(14, 2) NOT NULL DEFAULT 50000.00,
  joined_at DATE NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_code) REFERENCES roles(code),
  CONSTRAINT fk_users_manager FOREIGN KEY (manager_id) REFERENCES users(id)
);

CREATE TABLE user_sessions (
  session_id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_jti CHAR(36) NOT NULL UNIQUE,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_users_role ON users(role_code);
CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(180) NOT NULL,
  module VARCHAR(80) NOT NULL,
  ip_address VARCHAR(45) NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE system_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_system_settings_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('companyName', JSON_QUOTE('CompanyOS')),
  ('currency', JSON_QUOTE('PKR')),
  ('workingDays', JSON_ARRAY('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  ('annualLeaveDays', '20'),
  ('sickLeaveDays', '10'),
  ('casualLeaveDays', '5'),
  ('maxAdvanceMonths', '6'),
  ('maxReimbursementPerMonth', '10000');

CREATE TABLE leave_balances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  leave_type ENUM('Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity/Paternity') NOT NULL,
  total_days DECIMAL(6, 2) NOT NULL DEFAULT 0,
  used_days DECIMAL(6, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_balances_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_leave_balances_user_type UNIQUE (user_id, leave_type)
);

CREATE TABLE leave_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  manager_id BIGINT UNSIGNED NULL,
  leave_type ENUM('Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity/Paternity') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DECIMAL(6, 2) NOT NULL,
  handover_person VARCHAR(120) NULL,
  reason VARCHAR(1000) NOT NULL,
  status ENUM('PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_MANAGER',
  manager_note VARCHAR(500) NULL,
  hr_note VARCHAR(500) NULL,
  manager_action_by BIGINT UNSIGNED NULL,
  hr_action_by BIGINT UNSIGNED NULL,
  manager_action_at DATETIME NULL,
  hr_action_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_requests_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_leave_requests_manager FOREIGN KEY (manager_id) REFERENCES users(id),
  CONSTRAINT fk_leave_requests_manager_actor FOREIGN KEY (manager_action_by) REFERENCES users(id),
  CONSTRAINT fk_leave_requests_hr_actor FOREIGN KEY (hr_action_by) REFERENCES users(id)
);

CREATE TABLE attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  sign_in_at DATETIME NULL,
  sign_out_at DATETIME NULL,
  status ENUM('PRESENT', 'ABSENT', 'ON_LEAVE', 'WEEKEND') NOT NULL DEFAULT 'PRESENT',
  source VARCHAR(40) NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_attendance_user_date UNIQUE (user_id, attendance_date)
);

CREATE TABLE work_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  column_key ENUM('TODO', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'TODO',
  due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_work_tasks_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE advance_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  approved_amount DECIMAL(14, 2) NULL,
  reason VARCHAR(1000) NOT NULL,
  repayment_months INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  finance_note VARCHAR(500) NULL,
  processed_by_user_id BIGINT UNSIGNED NULL,
  processed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_advance_requests_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_advance_requests_processor FOREIGN KEY (processed_by_user_id) REFERENCES users(id)
);

CREATE TABLE reimbursement_claims (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  claim_type VARCHAR(80) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  expense_date DATE NULL,
  description VARCHAR(1200) NOT NULL,
  receipt_reference VARCHAR(255) NULL,
  receipt_file_path VARCHAR(255) NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  finance_note VARCHAR(500) NULL,
  processed_by_user_id BIGINT UNSIGNED NULL,
  processed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reimbursement_claims_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_reimbursement_claims_processor FOREIGN KEY (processed_by_user_id) REFERENCES users(id)
);

CREATE TABLE announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  audience VARCHAR(100) NOT NULL DEFAULT 'All staff',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_announcements_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE payroll_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  payroll_month TINYINT UNSIGNED NOT NULL,
  payroll_year SMALLINT UNSIGNED NOT NULL,
  basic DECIMAL(14, 2) NOT NULL DEFAULT 0,
  allowances DECIMAL(14, 2) NOT NULL DEFAULT 0,
  deductions DECIMAL(14, 2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status ENUM('DRAFT', 'PAID') NOT NULL DEFAULT 'DRAFT',
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payroll_entries_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_payroll_user_period UNIQUE (user_id, payroll_month, payroll_year)
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_manager ON leave_requests(manager_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_work_tasks_user ON work_tasks(user_id);
CREATE INDEX idx_advance_requests_status ON advance_requests(status);
CREATE INDEX idx_reimbursement_claims_status ON reimbursement_claims(status);
CREATE INDEX idx_announcements_active ON announcements(is_active, created_at);
CREATE INDEX idx_payroll_period ON payroll_entries(payroll_year, payroll_month);

CREATE TABLE requisitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_number VARCHAR(30) NOT NULL UNIQUE,
  requested_by_user_id BIGINT UNSIGNED NOT NULL,
  manager_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  justification TEXT NOT NULL,
  status ENUM(
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'PROCUREMENT_PENDING',
    'PARTIALLY_FULFILLED',
    'FULFILLED'
  ) NOT NULL DEFAULT 'SUBMITTED',
  needed_by_date DATE NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  rejected_at DATETIME NULL,
  fulfilled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_requisitions_requester FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_requisitions_manager FOREIGN KEY (manager_id) REFERENCES users(id)
);

CREATE TABLE requisition_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  item_description VARCHAR(160) NOT NULL,
  specification VARCHAR(255) NULL,
  quantity_requested DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  estimated_unit_cost DECIMAL(12, 2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_requisition_items_requisition FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  CONSTRAINT uq_requisition_items_line UNIQUE (requisition_id, line_number)
);

CREATE TABLE approval_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  action ENUM(
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'COMMENTED',
    'ISSUED',
    'PARTIAL_PROCUREMENT',
    'PROCUREMENT_REQUESTED',
    'PARTIAL_RECEIPT',
    'RECEIVED'
  ) NOT NULL,
  remarks VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_approval_logs_requisition FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  CONSTRAINT fk_approval_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

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
  transaction_type ENUM('ISSUE', 'RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT') NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_transactions_stock_item FOREIGN KEY (stock_item_id) REFERENCES inventory_stock(id),
  CONSTRAINT fk_inventory_transactions_requisition FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  CONSTRAINT fk_inventory_transactions_requisition_item FOREIGN KEY (requisition_item_id) REFERENCES requisition_items(id),
  CONSTRAINT fk_inventory_transactions_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE TABLE vendors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendor_code VARCHAR(30) NOT NULL UNIQUE,
  vendor_name VARCHAR(160) NOT NULL,
  category VARCHAR(100) NULL,
  contact_name VARCHAR(120) NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
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
  status ENUM('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'ISSUED',
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

CREATE TABLE vendor_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  paid_by_user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  payment_date DATE NOT NULL,
  reference VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vendor_payments_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_vendor_payments_user FOREIGN KEY (paid_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_vendor_payments_po ON vendor_payments(purchase_order_id);

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
  quantity_received DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(14, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_order_lines_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_purchase_order_lines_requisition_item FOREIGN KEY (requisition_item_id) REFERENCES requisition_items(id),
  CONSTRAINT fk_purchase_order_lines_allocation FOREIGN KEY (inventory_allocation_id) REFERENCES inventory_allocations(id),
  CONSTRAINT uq_purchase_order_lines_line UNIQUE (purchase_order_id, line_number)
);

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

CREATE INDEX idx_requisitions_requester ON requisitions(requested_by_user_id);
CREATE INDEX idx_requisitions_manager ON requisitions(manager_id);
CREATE INDEX idx_requisitions_status ON requisitions(status);
CREATE INDEX idx_requisition_items_requisition ON requisition_items(requisition_id);
CREATE INDEX idx_approval_logs_requisition ON approval_logs(requisition_id);
CREATE INDEX idx_inventory_stock_name ON inventory_stock(item_name);
CREATE INDEX idx_inventory_allocations_stock_item ON inventory_allocations(stock_item_id);
CREATE INDEX idx_inventory_transactions_stock_item ON inventory_transactions(stock_item_id);
CREATE INDEX idx_inventory_transactions_requisition ON inventory_transactions(requisition_id);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_order_lines_po ON purchase_order_lines(purchase_order_id);
CREATE INDEX idx_goods_receipts_po ON goods_receipts(purchase_order_id);
CREATE INDEX idx_goods_receipts_received_at ON goods_receipts(received_at);
CREATE INDEX idx_goods_receipt_lines_receipt ON goods_receipt_lines(goods_receipt_id);
CREATE INDEX idx_goods_receipt_lines_po_line ON goods_receipt_lines(purchase_order_line_id);
CREATE INDEX idx_finance_matches_po ON finance_matches(purchase_order_id);
CREATE INDEX idx_finance_matches_status ON finance_matches(status);
CREATE INDEX idx_finance_match_lines_match ON finance_match_lines(finance_match_id);

CREATE TABLE notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  template VARCHAR(80) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  payload_json JSON NOT NULL,
  triggered_by_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (triggered_by_user_id) REFERENCES users(id)
);

CREATE TABLE notification_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  notification_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  recipient_email VARCHAR(150) NULL,
  recipient_name VARCHAR(120) NULL,
  channel ENUM('EMAIL', 'IN_APP') NOT NULL DEFAULT 'EMAIL',
  delivery_status VARCHAR(40) NOT NULL DEFAULT 'queued-simulated',
  status ENUM('UNREAD', 'READ') NOT NULL DEFAULT 'UNREAD',
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_recipients_notification FOREIGN KEY (notification_id) REFERENCES notifications(id),
  CONSTRAINT fk_notification_recipients_user FOREIGN KEY (recipient_user_id) REFERENCES users(id)
);

CREATE INDEX idx_notifications_event_type ON notifications(event_type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notification_recipients_user ON notification_recipients(recipient_user_id);
CREATE INDEX idx_notification_recipients_status ON notification_recipients(status);

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
