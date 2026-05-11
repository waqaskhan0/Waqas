-- Run this once on an existing IMS database before using the new CompanyOS modules.
-- Fresh installs can run backend/database/schema.sql directly.

ALTER TABLE users
  ADD COLUMN basic_salary DECIMAL(14, 2) NOT NULL DEFAULT 50000.00,
  ADD COLUMN joined_at DATE NULL;

ALTER TABLE vendors
  ADD COLUMN category VARCHAR(100) NULL,
  ADD COLUMN address VARCHAR(255) NULL;

ALTER TABLE purchase_orders
  MODIFY status ENUM('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'ISSUED';

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(180) NOT NULL,
  module VARCHAR(80) NOT NULL,
  ip_address VARCHAR(45) NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_companyos_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_companyos_system_settings_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('companyName', JSON_QUOTE('CompanyOS')),
  ('currency', JSON_QUOTE('PKR')),
  ('workingDays', JSON_ARRAY('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  ('annualLeaveDays', '20'),
  ('sickLeaveDays', '10'),
  ('casualLeaveDays', '5'),
  ('maxAdvanceMonths', '6'),
  ('maxReimbursementPerMonth', '10000')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

CREATE TABLE IF NOT EXISTS leave_balances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  leave_type ENUM('Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity/Paternity') NOT NULL,
  total_days DECIMAL(6, 2) NOT NULL DEFAULT 0,
  used_days DECIMAL(6, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_companyos_leave_balances_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_companyos_leave_balances_user_type UNIQUE (user_id, leave_type)
);

CREATE TABLE IF NOT EXISTS leave_requests (
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
  CONSTRAINT fk_companyos_leave_requests_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_companyos_leave_requests_manager FOREIGN KEY (manager_id) REFERENCES users(id),
  CONSTRAINT fk_companyos_leave_requests_manager_actor FOREIGN KEY (manager_action_by) REFERENCES users(id),
  CONSTRAINT fk_companyos_leave_requests_hr_actor FOREIGN KEY (hr_action_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  sign_in_at DATETIME NULL,
  sign_out_at DATETIME NULL,
  status ENUM('PRESENT', 'ABSENT', 'ON_LEAVE', 'WEEKEND') NOT NULL DEFAULT 'PRESENT',
  source VARCHAR(40) NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_companyos_attendance_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_companyos_attendance_user_date UNIQUE (user_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS work_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  column_key ENUM('TODO', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'TODO',
  due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_companyos_work_tasks_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS advance_requests (
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
  CONSTRAINT fk_companyos_advance_requests_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_companyos_advance_requests_processor FOREIGN KEY (processed_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reimbursement_claims (
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
  CONSTRAINT fk_companyos_reimbursement_claims_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_companyos_reimbursement_claims_processor FOREIGN KEY (processed_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  audience VARCHAR(100) NOT NULL DEFAULT 'All staff',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_companyos_announcements_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payroll_entries (
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
  CONSTRAINT fk_companyos_payroll_entries_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_companyos_payroll_user_period UNIQUE (user_id, payroll_month, payroll_year)
);

CREATE TABLE IF NOT EXISTS vendor_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  paid_by_user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  payment_date DATE NOT NULL,
  reference VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_companyos_vendor_payments_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_companyos_vendor_payments_user FOREIGN KEY (paid_by_user_id) REFERENCES users(id)
);
