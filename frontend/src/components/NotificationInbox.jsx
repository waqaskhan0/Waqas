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
            <p>
              {notification.template} | {notification.channel.toLowerCase()} |{" "}
              {formatDateTime(notification.createdAt)}
            </p>
            <small>
              Delivery: {notification.deliveryStatus}
              {notification.readAt ? ` | Read ${formatDateTime(notification.readAt)}` : ""}
            </small>
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
