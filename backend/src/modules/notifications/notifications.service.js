import { getPool, query } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { ROLES } from "../../config/roles.js";

function mapUserRecipient(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email
  };
}

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

function buildRecipient(user, channel = "EMAIL") {
  return {
    userId: user.id,
    email: user.email ?? null,
    name: user.fullName ?? null,
    channel
  };
}

function dedupeRecipients(recipients) {
  const uniqueRecipients = new Map();

  for (const recipient of recipients) {
    if (!recipient?.userId) {
      continue;
    }

    uniqueRecipients.set(
      `${recipient.userId}:${recipient.channel ?? "EMAIL"}`,
      {
        ...recipient,
        channel: recipient.channel ?? "EMAIL"
      }
    );
  }

  return [...uniqueRecipients.values()];
}

async function listActiveUsersByIds(userIds) {
  const normalizedIds = [...new Set(userIds.filter((userId) => Number.isInteger(userId) && userId > 0))];

  if (!normalizedIds.length) {
    return [];
  }

  const placeholders = normalizedIds.map(() => "?").join(", ");
  const rows = await query(
    `
      SELECT
        id,
        full_name,
        email
      FROM users
      WHERE status = 'ACTIVE'
        AND id IN (${placeholders})
      ORDER BY full_name ASC
    `,
    normalizedIds
  );

  return rows.map(mapUserRecipient);
}

async function listActiveUsersByRole(roleCode) {
  const rows = await query(
    `
      SELECT
        id,
        full_name,
        email
      FROM users
      WHERE role_code = ?
        AND status = 'ACTIVE'
      ORDER BY full_name ASC
    `,
    [roleCode]
  );

  return rows.map(mapUserRecipient);
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
  const normalizedRecipients = dedupeRecipients(recipients ?? []);

  if (!normalizedRecipients.length) {
    return [];
  }

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

    for (const recipient of normalizedRecipients) {
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
  const requesterPreviews = await createNotification({
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

  if (String(decision).toUpperCase() === "APPROVED") {
    const inventoryUsers = await listActiveUsersByRole(ROLES.INVENTORY_OFFICER);

    await createNotification({
      eventType: "INVENTORY_ACTION_REQUIRED",
      entityType: "REQUISITION",
      entityId: requisitionId,
      template: "inventory-action-required",
      subject: `Inventory action needed for ${requisitionNumber}`,
      payload: {
        requisitionNumber,
        requesterName: recipientName,
        managerName,
        remarks
      },
      triggeredByUserId: managerUserId,
      recipients: inventoryUsers.map((user) => buildRecipient(user))
    });
  }

  return requesterPreviews[0] ?? null;
}

export async function sendRequisitionSubmittedNotification({
  requisitionId,
  requisitionNumber,
  title,
  requesterName,
  managerUserId,
  triggeredByUserId
}) {
  const managers = await listActiveUsersByIds([managerUserId]);
  const previews = await createNotification({
    eventType: "REQUISITION_SUBMITTED",
    entityType: "REQUISITION",
    entityId: requisitionId,
    template: "requisition-submitted",
    subject: `Approval needed for ${requisitionNumber}`,
    payload: {
      requisitionNumber,
      title,
      requesterName
    },
    triggeredByUserId,
    recipients: managers.map((manager) => buildRecipient(manager))
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
  const requesterPreviews = await createNotification({
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

  if (["PROCUREMENT_PENDING", "PARTIALLY_FULFILLED"].includes(String(status).toUpperCase())) {
    const procurementUsers = await listActiveUsersByRole(ROLES.PROCUREMENT_OFFICER);

    await createNotification({
      eventType: "PROCUREMENT_ACTION_REQUIRED",
      entityType: "REQUISITION",
      entityId: requisitionId,
      template: "procurement-action-required",
      subject: `Procurement action needed for ${requisitionNumber}`,
      payload: {
        requisitionNumber,
        requesterName: recipientName,
        inventoryOfficerName,
        remarks,
        status
      },
      triggeredByUserId: inventoryOfficerUserId,
      recipients: procurementUsers.map((user) => buildRecipient(user))
    });
  }

  return requesterPreviews[0] ?? null;
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
  const requesterPreviews = await createNotification({
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

  const receivingUsers = await listActiveUsersByRole(ROLES.INVENTORY_OFFICER);

  await createNotification({
    eventType: "GOODS_RECEIPT_REQUIRED",
    entityType: "PURCHASE_ORDER",
    entityId: poId ?? requisitionId,
    template: "goods-receipt-required",
    subject: `Goods receipt pending for ${poNumber}`,
    payload: {
      requisitionNumber,
      poNumber,
      requesterName: recipientName,
      vendorName,
      procurementOfficerName
    },
    triggeredByUserId: procurementOfficerUserId,
    recipients: receivingUsers.map((user) => buildRecipient(user))
  });

  return requesterPreviews[0] ?? null;
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
  const requesterPreviews = await createNotification({
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

  if (String(purchaseOrderStatus).toUpperCase() === "RECEIVED") {
    const financeUsers = await listActiveUsersByRole(ROLES.FINANCE);

    await createNotification({
      eventType: "FINANCE_ACTION_REQUIRED",
      entityType: "PURCHASE_ORDER",
      entityId: poId ?? requisitionId,
      template: "finance-action-required",
      subject: `Finance review needed for ${poNumber}`,
      payload: {
        requisitionNumber,
        poNumber,
        grnNumber,
        requesterName: recipientName,
        receiverName
      },
      triggeredByUserId: receiverUserId,
      recipients: financeUsers.map((user) => buildRecipient(user))
    });
  }

  return requesterPreviews[0] ?? null;
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
