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
