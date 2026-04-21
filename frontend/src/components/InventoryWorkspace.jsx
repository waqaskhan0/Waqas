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
  return String(status ?? "APPROVED").toLowerCase().replaceAll("_", "-");
}

function buildQueueSummary(requisition) {
  return {
    id: requisition.id,
    requisitionNumber: requisition.requisitionNumber,
    title: requisition.title,
    status: requisition.status,
    approvedAt: requisition.approvedAt,
    fulfilledAt: requisition.fulfilledAt,
    itemCount: requisition.items.length,
    totalQuantity: requisition.items.reduce(
      (total, item) => total + Number(item.quantity ?? 0),
      0
    ),
    requester: requisition.requester
  };
}

function buildLineState(requisition) {
  if (!requisition) {
    return [];
  }

  const allocationMap = new Map(
    (requisition.inventoryAllocations ?? []).map((allocation) => [
      allocation.requisitionItemId,
      allocation
    ])
  );

  return requisition.items.map((item) => {
    const allocation = allocationMap.get(item.id);

    return {
      requisitionItemId: item.id,
      stockItemId: allocation?.stockItemId ? String(allocation.stockItemId) : "",
      quantityIssued:
        allocation?.quantityIssued !== undefined ? String(allocation.quantityIssued) : "0"
    };
  });
}

export function InventoryWorkspace({ token }) {
  const [queue, setQueue] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState(null);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [lineStates, setLineStates] = useState([]);
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
        const response = await apiClient.listInventoryQueue(token);

        if (ignore) {
          return;
        }

        setQueue(response.requisitions);
        setSelectedRequisitionId((current) => {
          if (!response.requisitions.length) {
            return null;
          }

          const nextId = current ?? response.requisitions[0].id;

          return response.requisitions.some((requisition) => requisition.id === nextId)
            ? nextId
            : response.requisitions[0].id;
        });
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
      if (!selectedRequisitionId) {
        setSelectedRequisition(null);
        setLineStates([]);
        return;
      }

      setIsLoadingDetail(true);
      setDetailError("");

      try {
        const response = await apiClient.getRequisitionById(token, selectedRequisitionId);

        if (!ignore) {
          setSelectedRequisition(response.requisition);
          setLineStates(buildLineState(response.requisition));
          setRemarks(response.requisition.inventoryAllocations?.[0]?.remarks ?? "");
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
  }, [selectedRequisitionId, token]);

  function updateLineState(requisitionItemId, field, value) {
    setLineStates((current) =>
      current.map((line) =>
        line.requisitionItemId === requisitionItemId ? { ...line, [field]: value } : line
      )
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedRequisition) {
      return;
    }

    setSubmitError("");
    setSubmitSuccess("");
    setNotificationPreview(null);
    setIsSubmitting(true);

    try {
      const response = await apiClient.processInventoryDecision(
        token,
        selectedRequisition.id,
        {
          remarks,
          lines: lineStates.map((line) => ({
            requisitionItemId: line.requisitionItemId,
            stockItemId: line.stockItemId ? Number(line.stockItemId) : null,
            quantityIssued: Number(line.quantityIssued)
          }))
        }
      );

      setSelectedRequisition(response.requisition);
      setLineStates(buildLineState(response.requisition));
      setNotificationPreview(response.notification);
      setSubmitSuccess(
        `Inventory decision saved for ${response.requisition.requisitionNumber}.`
      );
      setQueue((current) =>
        current
          .map((requisition) =>
            requisition.id === response.requisition.id
              ? buildQueueSummary(response.requisition)
              : requisition
          )
          .sort((left, right) => {
            const statusOrder = {
              APPROVED: 0,
              PARTIALLY_FULFILLED: 1,
              PROCUREMENT_PENDING: 2,
              FULFILLED: 3
            };

            return (
              (statusOrder[left.status] ?? 99) - (statusOrder[right.status] ?? 99) ||
              new Date(right.approvedAt ?? 0).getTime() -
                new Date(left.approvedAt ?? 0).getTime()
            );
          })
      );

      const stockResponse = await apiClient.listInventoryStock(token);
      setStockItems(stockResponse.stockItems);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const pendingCount = queue.filter((requisition) => requisition.status === "APPROVED").length;
  const isActionable = selectedRequisition?.status === "APPROVED";

  return (
    <section className="grid two-column requisition-grid">
      <article className="card">
        <p className="section-label">Inventory queue</p>
        <h2>Approved requisitions</h2>
        <p className="lead">
          Decide whether each approved request can be issued in full, partially
          issued with procurement balance, or sent fully to procurement.
        </p>

        <div className="summary-strip">
          <div className="summary-tile">
            <span>Awaiting stock decision</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className="summary-tile">
            <span>Total tracked</span>
            <strong>{queue.length}</strong>
          </div>
        </div>

        {isLoadingQueue ? <p className="helper-text">Loading inventory queue...</p> : null}
        {queueError ? <p className="form-error">{queueError}</p> : null}

        {!isLoadingQueue && !queueError && !queue.length ? (
          <div className="empty-state">
            <strong>No approved requisitions</strong>
            <p>Inventory work will appear here once managers approve requests.</p>
          </div>
        ) : null}

        <div className="requisition-list">
          {queue.map((requisition) => (
            <button
              key={requisition.id}
              type="button"
              className={
                requisition.id === selectedRequisitionId
                  ? "requisition-list-item active"
                  : "requisition-list-item"
              }
              onClick={() => {
                setSelectedRequisitionId(requisition.id);
                setSubmitError("");
                setSubmitSuccess("");
                setNotificationPreview(null);
              }}
            >
              <div className="requisition-list-top">
                <strong>{requisition.requisitionNumber}</strong>
                <span className={`status-pill status-${getStatusClassName(requisition.status)}`}>
                  {requisition.status.replaceAll("_", " ")}
                </span>
              </div>
              <p>{requisition.title}</p>
              <div className="meta-row">
                <span>{requisition.requester.fullName}</span>
                <span>{requisition.itemCount} items</span>
                <span>{formatDateTime(requisition.approvedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="card">
        <p className="section-label">Stock reference</p>
        <h2>Available inventory</h2>
        <p className="lead">
          Use these on-hand balances while setting issued quantities against the
          selected requisition.
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
        <p className="section-label">Inventory action</p>
        <h2>Process requisition</h2>

        {isLoadingDetail ? <p className="helper-text">Loading requisition detail...</p> : null}
        {detailError ? <p className="form-error">{detailError}</p> : null}

        {!isLoadingDetail && !detailError && !selectedRequisition ? (
          <div className="empty-state">
            <strong>No requisition selected</strong>
            <p>Select an approved requisition from the queue to process it.</p>
          </div>
        ) : null}

        {!isLoadingDetail && !detailError && selectedRequisition ? (
          <div className="detail-stack">
            <div className="detail-header">
              <div>
                <div className="detail-title-row">
                  <h3>{selectedRequisition.title}</h3>
                  <span
                    className={`status-pill status-${getStatusClassName(
                      selectedRequisition.status
                    )}`}
                  >
                    {selectedRequisition.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="detail-id">{selectedRequisition.requisitionNumber}</p>
              </div>

              <div className="detail-metadata">
                <div>
                  <span>Approved</span>
                  <strong>{formatDateTime(selectedRequisition.approvedAt)}</strong>
                </div>
                <div>
                  <span>Requester</span>
                  <strong>{selectedRequisition.requester.fullName}</strong>
                </div>
                <div>
                  <span>Needed by</span>
                  <strong>{formatDate(selectedRequisition.neededByDate)}</strong>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <p className="section-label">Business justification</p>
              <p className="detail-copy">{selectedRequisition.justification}</p>
            </div>

            <form className="inventory-form" onSubmit={handleSubmit}>
              <label className="decision-label">
                Inventory remarks
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={3}
                  placeholder="Summarize the stock decision and any procurement handoff needed."
                  disabled={!isActionable || isSubmitting}
                />
              </label>

              <div className="inventory-line-stack">
                {selectedRequisition.items.map((item) => {
                  const lineState =
                    lineStates.find((line) => line.requisitionItemId === item.id) ?? {
                      requisitionItemId: item.id,
                      stockItemId: "",
                      quantityIssued: "0"
                    };
                  const matchingAllocation =
                    selectedRequisition.inventoryAllocations?.find(
                      (allocation) => allocation.requisitionItemId === item.id
                    ) ?? null;

                  return (
                    <div key={item.id} className="item-card">
                      <div className="detail-item-top">
                        <strong>
                          {item.lineNumber}. {item.description}
                        </strong>
                        <span>
                          Requested {item.quantity} {item.unit}
                        </span>
                      </div>
                      <p>{item.specification || "No additional specification provided."}</p>

                      <div className="inventory-line-grid">
                        <label>
                          Stock item
                          <select
                            value={lineState.stockItemId}
                            onChange={(event) =>
                              updateLineState(item.id, "stockItemId", event.target.value)
                            }
                            disabled={!isActionable || isSubmitting}
                          >
                            <option value="">Send to procurement</option>
                            {stockItems.map((stockItem) => (
                              <option key={stockItem.id} value={stockItem.id}>
                                {stockItem.sku} - {stockItem.itemName} ({stockItem.quantityOnHand}{" "}
                                {stockItem.unit} on hand)
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Quantity issued
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={lineState.quantityIssued}
                            onChange={(event) =>
                              updateLineState(item.id, "quantityIssued", event.target.value)
                            }
                            disabled={!isActionable || isSubmitting}
                          />
                        </label>
                      </div>

                      {matchingAllocation ? (
                        <small className="allocation-note">
                          Resolution: {matchingAllocation.resolution.replaceAll("_", " ")} | Issued{" "}
                          {matchingAllocation.quantityIssued} | Procurement{" "}
                          {matchingAllocation.quantityForProcurement}
                        </small>
                      ) : null}
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
                  {isSubmitting ? "Saving..." : "Process inventory decision"}
                </button>
              </div>

              {!isActionable ? (
                <p className="helper-text">
                  This requisition has already completed its initial inventory decision.
                </p>
              ) : null}
            </form>

            {selectedRequisition.inventoryAllocations?.length ? (
              <div className="detail-section">
                <p className="section-label">Inventory allocations</p>
                <div className="detail-item-list">
                  {selectedRequisition.inventoryAllocations.map((allocation) => (
                    <div key={allocation.id} className="detail-item-card">
                      <div className="detail-item-top">
                        <strong>
                          {allocation.lineNumber}. {allocation.itemDescription}
                        </strong>
                        <span>{allocation.resolution.replaceAll("_", " ")}</span>
                      </div>
                      <p>
                        Issued {allocation.quantityIssued} | Procurement{" "}
                        {allocation.quantityForProcurement}
                      </p>
                      <small>
                        {allocation.stockSku
                          ? `${allocation.stockSku} | ${allocation.stockItemName}`
                          : "No stock issued"}{" "}
                        | {allocation.processor.fullName} |{" "}
                        {formatDateTime(allocation.processedAt)}
                      </small>
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
