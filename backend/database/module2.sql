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
  action ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'COMMENTED') NOT NULL,
  remarks VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_approval_logs_requisition FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
  CONSTRAINT fk_approval_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX idx_requisitions_requester ON requisitions(requested_by_user_id);
CREATE INDEX idx_requisitions_manager ON requisitions(manager_id);
CREATE INDEX idx_requisitions_status ON requisitions(status);
CREATE INDEX idx_requisition_items_requisition ON requisition_items(requisition_id);
CREATE INDEX idx_approval_logs_requisition ON approval_logs(requisition_id);
