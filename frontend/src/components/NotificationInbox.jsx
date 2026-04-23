import { useEffect, useState } from "react";
import { apiClient } from "../api/client.js";

function formatDateTime(value) {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getStatusClassName(status) {
  return String(status ?? "UNREAD").toLowerCase().replaceAll("_", "-");
}

function formatWorkflowLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("_", " ");
}

function getNotificationSummary(notification) {
  const payload = notification.payload ?? {};

  switch (notification.eventType) {
    case "REQUISITION_SUBMITTED":
      return `${payload.requesterName ?? "A requester"} submitted ${payload.requisitionNumber ?? "a requisition"}${payload.title ? `: ${payload.title}` : ""}.`;
    case "REQUISITION_APPROVED":
    case "REQUISITION_REJECTED":
      return `${payload.managerName ?? "Manager"} ${String(payload.decision ?? "").toLowerCase()} ${payload.requisitionNumber ?? "this requisition"}.`;
    case "INVENTORY_ACTION_REQUIRED":
      return `${payload.requisitionNumber ?? "This requisition"} is ready for inventory review.`;
    case "INVENTORY_PROCESSED":
      return `${payload.inventoryOfficerName ?? "Inventory"} marked ${payload.requisitionNumber ?? "this requisition"} as ${formatWorkflowLabel(payload.status)}.`;
    case "PROCUREMENT_ACTION_REQUIRED":
      return `${payload.requisitionNumber ?? "This requisition"} needs procurement action.`;
    case "PURCHASE_ORDER_CREATED":
      return `PO ${payload.poNumber ?? ""} was created${payload.vendorName ? ` with ${payload.vendorName}` : ""}.`;
    case "GOODS_RECEIPT_REQUIRED":
      return `PO ${payload.poNumber ?? ""} is ready for goods receipt.`;
    case "GOODS_RECEIVED":
      return `${payload.grnNumber ?? "A GRN"} was recorded for PO ${payload.poNumber ?? ""}.`;
    case "FINANCE_ACTION_REQUIRED":
      return `PO ${payload.poNumber ?? ""} is ready for finance review.`;
    case "FINANCE_MATCHED":
    case "FINANCE_MISMATCH":
      return `Invoice ${payload.invoiceNumber ?? ""} was ${formatWorkflowLabel(payload.status)} for PO ${payload.poNumber ?? ""}.`;
    default:
      return notification.subject;
  }
}

function getNotificationContext(notification) {
  const payload = notification.payload ?? {};
  const values = [
    payload.requisitionNumber,
    payload.poNumber,
    payload.grnNumber,
    payload.invoiceNumber
  ].filter(Boolean);

  return values.length ? values.join(" | ") : null;
}

export function NotificationInbox({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadNotifications() {
      if (!ignore) {
        setError("");
      }

      try {
        const response = await apiClient.listMyNotifications(token);

        if (!ignore) {
          setNotifications(response.notifications);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadNotifications();
    const intervalId = setInterval(loadNotifications, 30000);

    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, [token]);

  async function handleMarkRead(notificationId) {
    setMarkingId(notificationId);
    setError("");

    try {
      const response = await apiClient.markNotificationRead(token, notificationId);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? response.notification : notification
        )
      );
    } catch (markError) {
      setError(markError.message);
    } finally {
      setMarkingId(null);
    }
  }

  const unreadCount = notifications.filter((notification) => notification.status === "UNREAD").length;

  return (
    <section className="card">
      <div className="items-header">
        <div>
          <p className="section-label">Module 8</p>
          <h2>Notification center</h2>
        </div>
        <span className={`status-pill status-${getStatusClassName(unreadCount ? "UNREAD" : "READ")}`}>
          {unreadCount} unread
        </span>
      </div>

      {isLoading ? <p className="helper-text">Loading notifications...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!isLoading && !error && !notifications.length ? (
        <div className="empty-state">
          <strong>No notifications yet</strong>
          <p>Centralized updates from approvals, inventory, procurement, receiving, and finance will appear here.</p>
        </div>
      ) : null}

      <div className="compact-stack">
        {notifications.map((notification) => (
          <div key={notification.id} className="notification-card">
            <div className="requisition-list-top">
              <strong>{notification.subject}</strong>
              <span className={`status-pill status-${getStatusClassName(notification.status)}`}>
                {notification.status}
              </span>
            </div>
            <p>{getNotificationSummary(notification)}</p>
            {getNotificationContext(notification) ? (
              <small>{getNotificationContext(notification)}</small>
            ) : null}
            <small>
              {notification.template} | {notification.channel.toLowerCase()} |{" "}
              {formatDateTime(notification.createdAt)} | Delivery: {notification.deliveryStatus}
              {notification.readAt ? ` | Read ${formatDateTime(notification.readAt)}` : ""}
            </small>
            {notification.payload?.remarks ? <small>{notification.payload.remarks}</small> : null}
            {notification.status === "UNREAD" ? (
              <div className="decision-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleMarkRead(notification.id)}
                  disabled={markingId === notification.id}
                >
                  {markingId === notification.id ? "Updating..." : "Mark read"}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
