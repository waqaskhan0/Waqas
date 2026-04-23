import { getPool, query } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

function mapNotificationRecipient(row) {
  return {
    id: row.recipient_id,
    notificationId: row.notification_id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    template: row.template,
    subject: row.subject,
    payload: row.payload_json,
    channel: row.channel,
    deliveryStatus: row.delivery_status,
    status: row.status,
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

function buildPreview(recipient) {
  return {
    id: recipient.id,
    channel: recipient.channel.toLowerCase(),
    status: recipient.deliveryStatus,
    template: recipient.template,
    recipientEmail: recipient.recipientEmail,
    recipientName: recipient.recipientName,
    subject: recipient.subject,
    payload: recipient.payload
  };
}

async function createNotification({
  eventType,
  entityType,
  entityId = null,
  template,
  subject,
  payload,
  triggeredByUserId = null,
  recipients
}) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [notificationResult] = await connection.execute(
      `
        INSERT INTO notifications (
          event_type,
          entity_type,
          entity_id,
          template,
          subject,
          payload_json,
          triggered_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        eventType,
        entityType,
        entityId,
        template,
        subject,
        JSON.stringify(payload),
        triggeredByUserId
      ]
    );

    const notificationId = notificationResult.insertId;
    const previews = [];

    for (const recipient of recipients) {
      const [recipientResult] = await connection.execute(
        `
          INSERT INTO notification_recipients (
            notification_id,
            recipient_user_id,
            recipient_email,
            recipient_name,
            channel
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          notificationId,
          recipient.userId,
          recipient.email ?? null,
          recipient.name ?? null,
          recipient.channel ?? "EMAIL"
        ]
      );

      const preview = buildPreview({
        id: recipientResult.insertId,
        recipientEmail: recipient.email ?? null,
        recipientName: recipient.name ?? null,
        channel: recipient.channel ?? "EMAIL",
        deliveryStatus: "queued-simulated",
        template,
        subject,
        payload
      });

      console.info("[notification-hook]", preview);
      previews.push(preview);
    }

    await connection.commit();

    return previews;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listMyNotifications(userId) {
  const rows = await query(
    `
      SELECT
        nr.id AS recipient_id,
        nr.notification_id,
        nr.recipient_email,
        nr.recipient_name,
        nr.channel,
        nr.delivery_status,
        nr.status,
        nr.read_at,
        nr.created_at,
        n.event_type,
        n.entity_type,
        n.entity_id,
        n.template,
        n.subject,
        n.payload_json
      FROM notification_recipients nr
      INNER JOIN notifications n ON n.id = nr.notification_id
      WHERE nr.recipient_user_id = ?
      ORDER BY nr.created_at DESC, nr.id DESC
      LIMIT 50
    `,
    [userId]
  );

  return rows.map((row) => ({
    ...mapNotificationRecipient({
      ...row,
      payload_json:
        typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json
    }),
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name
  }));
}

export async function markNotificationRead(userId, recipientId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          nr.id AS recipient_id,
          nr.notification_id,
          nr.recipient_email,
          nr.recipient_name,
          nr.channel,
          nr.delivery_status,
          nr.status,
          nr.read_at,
          nr.created_at,
          n.event_type,
          n.entity_type,
          n.entity_id,
          n.template,
          n.subject,
          n.payload_json
        FROM notification_recipients nr
        INNER JOIN notifications n ON n.id = nr.notification_id
        WHERE nr.id = ?
          AND nr.recipient_user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [recipientId, userId]
    );

    const row = rows[0] ?? null;

    if (!row) {
      throw new ApiError(404, "Notification was not found.");
    }

    if (row.status === "UNREAD") {
      await connection.execute(
        `
          UPDATE notification_recipients
          SET status = 'READ',
              read_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [recipientId]
      );
      row.status = "READ";
      row.read_at = new Date();
    }

    await connection.commit();

    return {
      ...mapNotificationRecipient({
        ...row,
        payload_json:
          typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json
      }),
      recipientEmail: row.recipient_email,
      recipientName: row.recipient_name
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function sendRequisitionDecisionNotification({
  requisitionId,
  requisitionNumber,
  decision,
  recipientUserId,
  recipientEmail,
  recipientName,
  managerName,
  managerUserId,
  remarks
}) {
  const previews = await createNotification({
    eventType: `REQUISITION_${String(decision).toUpperCase()}`,
    entityType: "REQUISITION",
    entityId: requisitionId,
    template: `requisition-${String(decision).toLowerCase()}`,
    subject: `Requisition ${requisitionNumber} ${String(decision).toLowerCase()}`,
    payload: {
      requisitionNumber,
      decision,
      recipientName,
      managerName,
      remarks
    },
    triggeredByUserId: managerUserId,
    recipients: [
      {
        userId: recipientUserId,
        email: recipientEmail,
        name: recipientName,
        channel: "EMAIL"
      }
    ]
  });

  return previews[0] ?? null;
}

export async function sendInventoryProcessingNotification({
  requisitionId,
  requisitionNumber,
  status,
  recipientUserId,
  recipientEmail,
  recipientName,
  inventoryOfficerName,
  inventoryOfficerUserId,
  remarks
}) {
  const previews = await createNotification({
    eventType: "INVENTORY_PROCESSED",
    entityType: "REQUISITION",
    entityId: requisitionId,
    template: `inventory-${String(status).toLowerCase()}`,
    subject: `Inventory update for ${requisitionNumber}`,
    payload: {
      requisitionNumber,
      status,
      recipientName,
      inventoryOfficerName,
      remarks
    },
    triggeredByUserId: inventoryOfficerUserId,
    recipients: [
      {
        userId: recipientUserId,
        email: recipientEmail,
        name: recipientName,
        channel: "EMAIL"
      }
    ]
  });

  return previews[0] ?? null;
}

export async function sendPurchaseOrderCreatedNotification({
  requisitionId,
  requisitionNumber,
  poId,
  poNumber,
  recipientUserId,
  recipientEmail,
  recipientName,
  vendorName,
  procurementOfficerName,
  procurementOfficerUserId
}) {
  const previews = await createNotification({
    eventType: "PURCHASE_ORDER_CREATED",
    entityType: "PURCHASE_ORDER",
    entityId: poId ?? requisitionId,
    template: "purchase-order-created",
    subject: `Purchase order ${poNumber} created for ${requisitionNumber}`,
    payload: {
      requisitionNumber,
      poNumber,
      recipientName,
      vendorName,
      procurementOfficerName
    },
    triggeredByUserId: procurementOfficerUserId,
    recipients: [
      {
        userId: recipientUserId,
        email: recipientEmail,
        name: recipientName,
        channel: "EMAIL"
      }
    ]
  });

  return previews[0] ?? null;
}

export async function sendGoodsReceivedNotification({
  requisitionId,
  requisitionNumber,
  poId,
  poNumber,
  grnNumber,
  recipientUserId,
  recipientEmail,
  recipientName,
  receiverName,
  receiverUserId,
  purchaseOrderStatus
}) {
  const previews = await createNotification({
    eventType: "GOODS_RECEIVED",
    entityType: "PURCHASE_ORDER",
    entityId: poId ?? requisitionId,
    template: "goods-received",
    subject: `Goods received for ${poNumber} (${requisitionNumber})`,
    payload: {
      requisitionNumber,
      poNumber,
      grnNumber,
      recipientName,
      receiverName,
      purchaseOrderStatus
    },
    triggeredByUserId: receiverUserId,
    recipients: [
      {
        userId: recipientUserId,
        email: recipientEmail,
        name: recipientName,
        channel: "EMAIL"
      }
    ]
  });

  return previews[0] ?? null;
}

export async function sendFinanceMatchNotification({
  requisitionId,
  requisitionNumber,
  poId,
  poNumber,
  invoiceNumber,
  status,
  recipientUserId,
  recipientEmail,
  recipientName,
  financeUserId,
  financeUserName,
  varianceAmount
}) {
  const previews = await createNotification({
    eventType: `FINANCE_${String(status).toUpperCase()}`,
    entityType: "PURCHASE_ORDER",
    entityId: poId ?? requisitionId,
    template: `finance-${String(status).toLowerCase()}`,
    subject: `Finance ${String(status).toLowerCase()} for ${poNumber}`,
    payload: {
      requisitionNumber,
      poNumber,
      invoiceNumber,
      status,
      recipientName,
      financeUserName,
      varianceAmount
    },
    triggeredByUserId: financeUserId,
    recipients: [
      {
        userId: recipientUserId,
        email: recipientEmail,
        name: recipientName,
        channel: "EMAIL"
      }
    ]
  });

  return previews[0] ?? null;
}
