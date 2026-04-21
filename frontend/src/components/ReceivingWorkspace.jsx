import { useEffect, useState } from "react";
import { apiClient } from "../api/client.js";

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

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
  return String(status ?? "ISSUED").toLowerCase().replaceAll("_", "-");
}

function buildQueueSummary(requisition, purchaseOrder) {
  return {
    id: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    requisitionId: requisition.id,
    requisitionNumber: requisition.requisitionNumber,
    title: requisition.title,
    purchaseOrderStatus: purchaseOrder.status,
    requisitionStatus: requisition.status,
    orderDate: purchaseOrder.orderDate,
    expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
    lineCount: purchaseOrder.lines.length,
    quantityOrdered: purchaseOrder.lines.reduce(
      (total, line) => total + Number(line.quantityOrdered ?? 0),
      0
    ),
    quantityReceived: purchaseOrder.lines.reduce(
      (total, line) => total + Number(line.quantityReceived ?? 0),
      0
    ),
    quantityOutstanding: purchaseOrder.lines.reduce(
      (total, line) => total + Number(line.quantityOutstanding ?? 0),
      0
    ),
    vendor: purchaseOrder.vendor,
    requester: requisition.requester
  };
}

function buildLineState(requisition, purchaseOrder) {
  if (!requisition || !purchaseOrder) {
    return [];
  }

  const allocationMap = new Map(
    (requisition.inventoryAllocations ?? []).map((allocation) => [
      allocation.requisitionItemId,
      allocation
    ])
  );

  return purchaseOrder.lines.map((line) => ({
    purchaseOrderLineId: line.id,
    stockItemId: allocationMap.get(line.requisitionItemId)?.stockItemId
      ? String(allocationMap.get(line.requisitionItemId).stockItemId)
      : "",
    quantityReceived:
      Number(line.quantityOutstanding ?? 0) > 0 ? String(line.quantityOutstanding) : "0"
  }));
}

export function ReceivingWorkspace({ token }) {
  const [queue, setQueue] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState(null);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null);
  const [lineStates, setLineStates] = useState([]);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [queueError, setQueueError] = useState("");
  const [stockError, setStockError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [notificationPreview, setNotificationPreview] = useState(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadQueue() {
      setIsLoadingQueue(true);
      setQueueError("");

      try {
        const response = await apiClient.listReceivingQueue(token);

        if (!ignore) {
          setQueue(response.purchaseOrders);
          setSelectedPurchaseOrderId((current) => {
            if (!response.purchaseOrders.length) {
              return null;
            }

            const nextId = current ?? response.purchaseOrders[0].id;

            return response.purchaseOrders.some((purchaseOrder) => purchaseOrder.id === nextId)
              ? nextId
              : response.purchaseOrders[0].id;
          });
        }
      } catch (error) {
        if (!ignore) {
          setQueueError(error.message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingQueue(false);
        }
      }
    }

    async function loadStock() {
      setIsLoadingStock(true);
      setStockError("");

      try {
        const response = await apiClient.listInventoryStock(token);

        if (!ignore) {
          setStockItems(response.stockItems);
        }
      } catch (error) {
        if (!ignore) {
          setStockError(error.message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingStock(false);
        }
      }
    }

    loadQueue();
    loadStock();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    let ignore = false;

    async function loadDetail() {
      const queueItem = queue.find((purchaseOrder) => purchaseOrder.id === selectedPurchaseOrderId);

      if (!queueItem) {
        setSelectedRequisition(null);
        setSelectedPurchaseOrder(null);
        setLineStates([]);
        return;
      }

      setIsLoadingDetail(true);
      setDetailError("");

      try {
        const response = await apiClient.getRequisitionById(token, queueItem.requisitionId);

        if (!ignore) {
          const purchaseOrder =
            response.requisition.purchaseOrders.find((item) => item.id === queueItem.id) ??
            response.requisition.purchaseOrders[0] ??
            null;

          setSelectedRequisition(response.requisition);
          setSelectedPurchaseOrder(purchaseOrder);
          setLineStates(buildLineState(response.requisition, purchaseOrder));
          setRemarks(response.requisition.goodsReceipts?.[0]?.remarks ?? "");
          setDeliveryNoteNumber(
            response.requisition.goodsReceipts?.[0]?.deliveryNoteNumber ?? ""
          );
        }
      } catch (error) {
        if (!ignore) {
          setDetailError(error.message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingDetail(false);
        }
      }
    }

    loadDetail();

    return () => {
      ignore = true;
    };
  }, [queue, selectedPurchaseOrderId, token]);

  function updateLineState(purchaseOrderLineId, field, value) {
    setLineStates((current) =>
      current.map((line) =>
        line.purchaseOrderLineId === purchaseOrderLineId ? { ...line, [field]: value } : line
      )
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedPurchaseOrder || !selectedRequisition) {
      return;
    }

    setSubmitError("");
    setSubmitSuccess("");
    setNotificationPreview(null);
    setIsSubmitting(true);

    try {
      const response = await apiClient.receivePurchaseOrder(token, selectedPurchaseOrder.id, {
        deliveryNoteNumber: deliveryNoteNumber || null,
        remarks,
        lines: lineStates
          .filter((line) => Number(line.quantityReceived) > 0)
          .map((line) => ({
            purchaseOrderLineId: line.purchaseOrderLineId,
            stockItemId: Number(line.stockItemId),
            quantityReceived: Number(line.quantityReceived)
          }))
      });

      const purchaseOrder = response.requisition.purchaseOrders.find(
        (item) => item.id === selectedPurchaseOrder.id
      );

      setSelectedRequisition(response.requisition);
      setSelectedPurchaseOrder(purchaseOrder);
      setLineStates(buildLineState(response.requisition, purchaseOrder));
      setNotificationPreview(response.notification);
      setSubmitSuccess(
        `Goods receipt recorded for ${purchaseOrder?.poNumber ?? selectedPurchaseOrder.poNumber}.`
      );
      setQueue((current) =>
        current
          .map((item) =>
            item.id === selectedPurchaseOrder.id
              ? buildQueueSummary(response.requisition, purchaseOrder)
              : item
          )
          .filter((item) => item.purchaseOrderStatus !== "RECEIVED")
      );

      const stockResponse = await apiClient.listInventoryStock(token);
      setStockItems(stockResponse.stockItems);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const receiptPendingCount = queue.filter(
    (purchaseOrder) => purchaseOrder.purchaseOrderStatus === "ISSUED"
  ).length;
  const isActionable =
    selectedPurchaseOrder &&
    ["ISSUED", "PARTIALLY_RECEIVED"].includes(selectedPurchaseOrder.status);

  return (
    <section className="grid two-column requisition-grid">
      <article className="card">
        <p className="section-label">Module 6 queue</p>
        <h2>Goods receiving</h2>
        <p className="lead">
          Receive vendor deliveries against purchase orders, update stock balances,
          and record GRNs for downstream matching.
        </p>

        <div className="summary-strip">
          <div className="summary-tile">
            <span>Fresh receipts due</span>
            <strong>{receiptPendingCount}</strong>
          </div>
          <div className="summary-tile">
            <span>Total open POs</span>
            <strong>{queue.length}</strong>
          </div>
        </div>

        {isLoadingQueue ? <p className="helper-text">Loading receiving queue...</p> : null}
        {queueError ? <p className="form-error">{queueError}</p> : null}

        {!isLoadingQueue && !queueError && !queue.length ? (
          <div className="empty-state">
            <strong>No purchase orders awaiting receipt</strong>
            <p>Issued purchase orders will appear here until their deliveries are received.</p>
          </div>
        ) : null}

        <div className="requisition-list">
          {queue.map((purchaseOrder) => (
            <button
              key={purchaseOrder.id}
              type="button"
              className={
                purchaseOrder.id === selectedPurchaseOrderId
                  ? "requisition-list-item active"
                  : "requisition-list-item"
              }
              onClick={() => {
                setSelectedPurchaseOrderId(purchaseOrder.id);
                setSubmitError("");
                setSubmitSuccess("");
                setNotificationPreview(null);
              }}
            >
              <div className="requisition-list-top">
                <strong>{purchaseOrder.poNumber}</strong>
                <span
                  className={`status-pill status-${getStatusClassName(
                    purchaseOrder.purchaseOrderStatus
                  )}`}
                >
                  {purchaseOrder.purchaseOrderStatus.replaceAll("_", " ")}
                </span>
              </div>
              <p>{purchaseOrder.title}</p>
              <div className="meta-row">
                <span>{purchaseOrder.vendor.vendorName}</span>
                <span>Outstanding {purchaseOrder.quantityOutstanding}</span>
                <span>{formatDate(purchaseOrder.expectedDeliveryDate)}</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="card">
        <p className="section-label">Stock destination</p>
        <h2>Available stock items</h2>
        <p className="lead">
          Route each receipt into the right stock item so inventory balances stay usable.
        </p>

        {isLoadingStock ? <p className="helper-text">Loading stock list...</p> : null}
        {stockError ? <p className="form-error">{stockError}</p> : null}

        <div className="stock-list">
          {stockItems.map((stockItem) => (
            <div key={stockItem.id} className="stock-card">
              <strong>{stockItem.itemName}</strong>
              <p>{stockItem.specification || "No specification recorded."}</p>
              <small>
                {stockItem.sku} | On hand {stockItem.quantityOnHand} {stockItem.unit}
              </small>
            </div>
          ))}
        </div>
      </article>

      <article className="card full-span">
        <p className="section-label">GRN detail</p>
        <h2>Receive purchase order</h2>

        {isLoadingDetail ? <p className="helper-text">Loading purchase order detail...</p> : null}
        {detailError ? <p className="form-error">{detailError}</p> : null}

        {!isLoadingDetail && !detailError && (!selectedRequisition || !selectedPurchaseOrder) ? (
          <div className="empty-state">
            <strong>No purchase order selected</strong>
            <p>Select an open PO from the queue to capture its receipt.</p>
          </div>
        ) : null}

        {!isLoadingDetail && !detailError && selectedRequisition && selectedPurchaseOrder ? (
          <div className="detail-stack">
            <div className="detail-header">
              <div>
                <div className="detail-title-row">
                  <h3>{selectedPurchaseOrder.poNumber}</h3>
                  <span
                    className={`status-pill status-${getStatusClassName(
                      selectedPurchaseOrder.status
                    )}`}
                  >
                    {selectedPurchaseOrder.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="detail-id">
                  {selectedRequisition.requisitionNumber} | {selectedRequisition.title}
                </p>
              </div>

              <div className="detail-metadata">
                <div>
                  <span>Vendor</span>
                  <strong>{selectedPurchaseOrder.vendor.vendorName}</strong>
                </div>
                <div>
                  <span>Order date</span>
                  <strong>{formatDateTime(selectedPurchaseOrder.orderDate)}</strong>
                </div>
                <div>
                  <span>Expected delivery</span>
                  <strong>{formatDate(selectedPurchaseOrder.expectedDeliveryDate)}</strong>
                </div>
              </div>
            </div>

            <form className="inventory-form" onSubmit={handleSubmit}>
              <div className="inventory-line-grid">
                <label>
                  Delivery note
                  <input
                    type="text"
                    value={deliveryNoteNumber}
                    onChange={(event) => setDeliveryNoteNumber(event.target.value)}
                    placeholder="Supplier challan or delivery note number"
                    disabled={!isActionable || isSubmitting}
                  />
                </label>

                <label>
                  Requester
                  <input
                    type="text"
                    value={selectedRequisition.requester.fullName}
                    disabled
                  />
                </label>
              </div>

              <label className="decision-label">
                Receiving remarks
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={3}
                  placeholder="Capture receiving notes, quality checks, or delivery exceptions."
                  disabled={!isActionable || isSubmitting}
                />
              </label>

              <div className="inventory-line-stack">
                {selectedPurchaseOrder.lines.map((line) => {
                  const lineState =
                    lineStates.find((item) => item.purchaseOrderLineId === line.id) ?? {
                      purchaseOrderLineId: line.id,
                      stockItemId: "",
                      quantityReceived: "0"
                    };

                  return (
                    <div key={line.id} className="item-card">
                      <div className="detail-item-top">
                        <strong>
                          {line.lineNumber}. {line.itemDescription}
                        </strong>
                        <span>Outstanding {line.quantityOutstanding}</span>
                      </div>
                      <p>{line.specification || "No specification provided."}</p>

                      <div className="inventory-line-grid">
                        <label>
                          Stock item
                          <select
                            value={lineState.stockItemId}
                            onChange={(event) =>
                              updateLineState(line.id, "stockItemId", event.target.value)
                            }
                            disabled={!isActionable || isSubmitting}
                          >
                            <option value="">Select stock item</option>
                            {stockItems.map((stockItem) => (
                              <option key={stockItem.id} value={stockItem.id}>
                                {stockItem.sku} - {stockItem.itemName}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Quantity received
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={lineState.quantityReceived}
                            onChange={(event) =>
                              updateLineState(line.id, "quantityReceived", event.target.value)
                            }
                            disabled={!isActionable || isSubmitting}
                          />
                        </label>
                      </div>

                      <small className="allocation-note">
                        Ordered {line.quantityOrdered} | Previously received {line.quantityReceived} |{" "}
                        Remaining {line.quantityOutstanding}
                      </small>
                    </div>
                  );
                })}
              </div>

              {submitError ? <p className="form-error">{submitError}</p> : null}
              {submitSuccess ? <p className="form-success">{submitSuccess}</p> : null}

              {notificationPreview ? (
                <div className="notification-preview">
                  <strong>Notification hook</strong>
                  <p>
                    {notificationPreview.status} email prepared for{" "}
                    {notificationPreview.recipientEmail}.
                  </p>
                  <small>{notificationPreview.subject}</small>
                </div>
              ) : null}

              <div className="decision-actions">
                <button
                  type="submit"
                  className="secondary-button"
                  disabled={!isActionable || isSubmitting}
                >
                  {isSubmitting ? "Recording..." : "Record goods receipt"}
                </button>
              </div>

              {!isActionable ? (
                <p className="helper-text">This purchase order has already been fully received.</p>
              ) : null}
            </form>

            {selectedRequisition.goodsReceipts?.length ? (
              <div className="detail-section">
                <p className="section-label">Recorded GRNs</p>
                <div className="detail-item-list">
                  {selectedRequisition.goodsReceipts.map((goodsReceipt) => (
                    <div key={goodsReceipt.id} className="detail-item-card">
                      <div className="detail-item-top">
                        <strong>{goodsReceipt.grnNumber}</strong>
                        <span>{formatDateTime(goodsReceipt.receivedAt)}</span>
                      </div>
                      <p>
                        {goodsReceipt.deliveryNoteNumber || "No delivery note"} |{" "}
                        {goodsReceipt.receiver.fullName}
                      </p>
                      <small>{goodsReceipt.remarks || "No remarks recorded."}</small>
                      <div className="detail-item-list compact-stack">
                        {goodsReceipt.lines.map((line) => (
                          <div key={line.id} className="mini-line">
                            <strong>
                              {line.lineNumber}. {line.itemDescription}
                            </strong>
                            <small>
                              {line.quantityReceived} {line.unit} into {line.stockSku || "stock"}
                            </small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="detail-section">
              <p className="section-label">Workflow history</p>
              <div className="timeline-list">
                {selectedRequisition.approvalLogs.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-marker" />
                    <div>
                      <strong>
                        {log.action.replaceAll("_", " ")} by {log.actor.fullName}
                      </strong>
                      <p>{log.remarks || "No remarks captured for this step."}</p>
                      <small>
                        {log.actor.role} | {formatDateTime(log.createdAt)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}
