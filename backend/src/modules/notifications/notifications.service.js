export async function sendRequisitionDecisionNotification({
  requisitionNumber,
  decision,
  recipientEmail,
  recipientName,
  managerName,
  remarks
}) {
  const notification = {
    channel: "email",
    status: "queued-simulated",
    template: `requisition-${String(decision).toLowerCase()}`,
    recipientEmail,
    recipientName,
    subject: `Requisition ${requisitionNumber} ${String(decision).toLowerCase()}`,
    payload: {
      requisitionNumber,
      decision,
      recipientName,
      managerName,
      remarks
    }
  };

  console.info("[notification-hook]", notification);

  return notification;
}

export async function sendInventoryProcessingNotification({
  requisitionNumber,
  status,
  recipientEmail,
  recipientName,
  inventoryOfficerName,
  remarks
}) {
  const notification = {
    channel: "email",
    status: "queued-simulated",
    template: `inventory-${String(status).toLowerCase()}`,
    recipientEmail,
    recipientName,
    subject: `Inventory update for ${requisitionNumber}`,
    payload: {
      requisitionNumber,
      status,
      recipientName,
      inventoryOfficerName,
      remarks
    }
  };

  console.info("[notification-hook]", notification);

  return notification;
}

export async function sendPurchaseOrderCreatedNotification({
  requisitionNumber,
  poNumber,
  recipientEmail,
  recipientName,
  vendorName,
  procurementOfficerName
}) {
  const notification = {
    channel: "email",
    status: "queued-simulated",
    template: "purchase-order-created",
    recipientEmail,
    recipientName,
    subject: `Purchase order ${poNumber} created for ${requisitionNumber}`,
    payload: {
      requisitionNumber,
      poNumber,
      recipientName,
      vendorName,
      procurementOfficerName
    }
  };

  console.info("[notification-hook]", notification);

  return notification;
}

export async function sendGoodsReceivedNotification({
  requisitionNumber,
  poNumber,
  grnNumber,
  recipientEmail,
  recipientName,
  receiverName,
  purchaseOrderStatus
}) {
  const notification = {
    channel: "email",
    status: "queued-simulated",
    template: "goods-received",
    recipientEmail,
    recipientName,
    subject: `Goods received for ${poNumber} (${requisitionNumber})`,
    payload: {
      requisitionNumber,
      poNumber,
      grnNumber,
      recipientName,
      receiverName,
      purchaseOrderStatus
    }
  };

  console.info("[notification-hook]", notification);

  return notification;
}
