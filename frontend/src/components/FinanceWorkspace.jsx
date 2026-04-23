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

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function getStatusClassName(status) {
  return String(status ?? "MATCHED").toLowerCase().replaceAll("_", "-");
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function getLatestFinanceMatch(requisition, purchaseOrderId) {
  return (
    requisition?.financeMatches?.find((match) => match.purchaseOrderId === purchaseOrderId) ?? null
  );
}

function getGoodsReceiptsForPurchaseOrder(requisition, purchaseOrderId) {
  return (requisition?.goodsReceipts ?? []).filter(
    (receipt) => receipt.purchaseOrderId === purchaseOrderId
  );
}

function buildQueueSummary(requisition, purchaseOrder) {
  const latestFinanceMatch = getLatestFinanceMatch(requisition, purchaseOrder.id);

  return {
    id: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    requisitionId: requisition.id,
    requisitionNumber: requisition.requisitionNumber,
    title: requisition.title,
    purchaseOrderStatus: purchaseOrder.status,
    orderDate: purchaseOrder.orderDate,
    expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
    receiptCount: requisition.goodsReceipts.filter(
      (receipt) => receipt.purchaseOrderId === purchaseOrder.id
    ).length,
    poAmount: purchaseOrder.subtotalAmount,
    receivedAmount: purchaseOrder.lines.reduce(
      (total, line) => total + Number(line.quantityReceived ?? 0) * Number(line.unitPrice ?? 0),
      0
    ),
    latestFinanceStatus: latestFinanceMatch?.status ?? null,
    latestInvoiceNumber: latestFinanceMatch?.invoiceNumber ?? null,
    latestReviewedAt: latestFinanceMatch?.createdAt ?? null,
    vendor: purchaseOrder.vendor,
    requester: requisition.requester
  };
}

function buildLineState(requisition, purchaseOrder) {
  if (!requisition || !purchaseOrder) {
    return [];
  }

  const latestFinanceMatch = getLatestFinanceMatch(requisition, purchaseOrder.id);
  const latestFinanceLineMap = new Map(
    (latestFinanceMatch?.lines ?? []).map((line) => [line.purchaseOrderLineId, line])
  );

  return purchaseOrder.lines.map((line) => {
    const latestFinanceLine = latestFinanceLineMap.get(line.id);

    return {
      purchaseOrderLineId: line.id,
      lineNumber: line.lineNumber,
      itemDescription: line.itemDescription,
      quantityReceived: String(line.quantityReceived),
      expectedUnitPrice: String(line.unitPrice),
      quantityBilled: latestFinanceLine
        ? String(latestFinanceLine.quantityBilled)
        : String(line.quantityReceived),
      unitPrice: latestFinanceLine
        ? String(latestFinanceLine.unitPrice)
        : String(line.unitPrice)
    };
  });
}

export function FinanceWorkspace({ token }) {
  const [queue, setQueue] = useState([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState(null);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null);
  const [lineStates, setLineStates] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateValue());
  const [remarks, setRemarks] = useState("");
  const [queueError, setQueueError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submittedMatch, setSubmittedMatch] = useState(null);
  const [notificationPreview, setNotificationPreview] = useState(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadQueue() {
      setIsLoadingQueue(true);
      setQueueError("");

      try {
        const response = await apiClient.listFinanceQueue(token);

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

    loadQueue();

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
            response.requisition.purchaseOrders.find((item) => item.id === queueItem.id) ?? null;
          const latestFinanceMatch = getLatestFinanceMatch(response.requisition, queueItem.id);

          setSelectedRequisition(response.requisition);
          setSelectedPurchaseOrder(purchaseOrder);
          setLineStates(buildLineState(response.requisition, purchaseOrder));
          setInvoiceNumber(latestFinanceMatch?.invoiceNumber ?? "");
          setInvoiceDate(
            latestFinanceMatch?.invoiceDate
              ? String(latestFinanceMatch.invoiceDate).slice(0, 10)
              : getTodayDateValue()
          );
          setRemarks(latestFinanceMatch?.remarks ?? "");
          setSubmittedMatch(latestFinanceMatch);
          setNotificationPreview(null);
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
      const response = await apiClient.createFinanceMatch(token, selectedPurchaseOrder.id, {
        invoiceNumber,
        invoiceDate,
        remarks,
        lines: lineStates.map((line) => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          quantityBilled: Number(line.quantityBilled),
          unitPrice: Number(line.unitPrice)
        }))
      });

      const purchaseOrder = response.requisition.purchaseOrders.find(
        (item) => item.id === selectedPurchaseOrder.id
      );
      const nextQueue =
        response.financeMatch?.status === "MATCHED"
          ? queue.filter((item) => item.id !== selectedPurchaseOrder.id)
          : queue.map((item) =>
              item.id === selectedPurchaseOrder.id
                ? buildQueueSummary(response.requisition, purchaseOrder)
                : item
            );

      setSelectedRequisition(response.requisition);
      setSelectedPurchaseOrder(purchaseOrder);
      setLineStates(buildLineState(response.requisition, purchaseOrder));
      setSubmittedMatch(response.financeMatch);
      setNotificationPreview(response.notification);
      setSubmitSuccess(
        `Invoice ${response.financeMatch?.invoiceNumber ?? invoiceNumber} recorded as ${String(
          response.financeMatch?.status ?? "MISMATCH"
        ).toLowerCase()}.`
      );
      setQueue(nextQueue);
      setSelectedPurchaseOrderId((current) => {
        if (response.financeMatch?.status !== "MATCHED") {
          return current;
        }

        return nextQueue[0]?.id ?? null;
      });
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const relatedGoodsReceipts = getGoodsReceiptsForPurchaseOrder(
    selectedRequisition,
    selectedPurchaseOrder?.id
  );
  const actionableCount = queue.length;
  const mismatchCount = queue.filter(
    (purchaseOrder) => purchaseOrder.latestFinanceStatus === "MISMATCH"
  ).length;

  return (
    <section className="grid two-column requisition-grid">
      <article className="card">
        <p className="section-label">Module 7 queue</p>
        <h2>Finance 3-way match</h2>
        <p className="lead">
          Review fully received purchase orders, capture invoice data, and compare
          invoice, PO, and GRN-backed receipt values.
        </p>

        <div className="summary-strip">
          <div className="summary-tile">
            <span>Ready for review</span>
            <strong>{actionableCount}</strong>
          </div>
          <div className="summary-tile">
            <span>Mismatches to revisit</span>
            <strong>{mismatchCount}</strong>
          </div>
        </div>

        {isLoadingQueue ? <p className="helper-text">Loading finance queue...</p> : null}
        {queueError ? <p className="form-error">{queueError}</p> : null}

        {!isLoadingQueue && !queueError && !queue.length ? (
          <div className="empty-state">
            <strong>No finance reviews pending</strong>
            <p>Fully received purchase orders will appear here until a successful match is recorded.</p>
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
                {purchaseOrder.latestFinanceStatus ? (
                  <span
                    className={`status-pill status-${getStatusClassName(
                      purchaseOrder.latestFinanceStatus
                    )}`}
                  >
                    {purchaseOrder.latestFinanceStatus}
                  </span>
                ) : null}
              </div>
              <p>{purchaseOrder.title}</p>
              <div className="meta-row">
                <span>{purchaseOrder.requisitionNumber}</span>
                <span>{purchaseOrder.vendor.vendorName}</span>
                <span>{formatCurrency(purchaseOrder.poAmount)}</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="card">
        <p className="section-label">Selected PO</p>
        <h2>Finance review</h2>
        <p className="lead">
          Capture the vendor invoice and compare it line by line against received and ordered values.
        </p>

        {isLoadingDetail ? <p className="helper-text">Loading finance detail...</p> : null}
        {detailError ? <p className="form-error">{detailError}</p> : null}

        {!isLoadingDetail && !detailError && !selectedPurchaseOrder ? (
          <div className="empty-state">
            <strong>No purchase order selected</strong>
            <p>Select an item from the finance queue to start its review.</p>
          </div>
        ) : null}

        {!isLoadingDetail && !detailError && selectedPurchaseOrder && selectedRequisition ? (
          <form className="inventory-form" onSubmit={handleSubmit}>
              <div className="summary-strip">
              <div className="summary-tile">
                <span>PO amount</span>
                <strong>{formatCurrency(selectedPurchaseOrder.subtotalAmount)}</strong>
              </div>
              <div className="summary-tile">
                <span>Received amount</span>
                <strong>
                  {formatCurrency(
                    selectedPurchaseOrder.lines.reduce(
                      (total, line) =>
                        total +
                        Number(line.quantityReceived ?? 0) * Number(line.unitPrice ?? 0),
                      0
                    )
                  )}
                </strong>
              </div>
            </div>

            <div className="detail-section">
              <p className="section-label">PO and GRN evidence</p>
              <div className="detail-item-list">
                <div className="detail-item-card">
                  <div className="detail-item-top">
                    <strong>Purchase order notes</strong>
                    <span>{selectedPurchaseOrder.poNumber}</span>
                  </div>
                  <p>{selectedPurchaseOrder.vendor.vendorName}</p>
                  <small>{selectedPurchaseOrder.notes || "No purchase order notes recorded."}</small>
                </div>

                {relatedGoodsReceipts.length ? (
                  relatedGoodsReceipts.map((receipt) => (
                    <div key={receipt.id} className="detail-item-card">
                      <div className="detail-item-top">
                        <strong>{receipt.grnNumber}</strong>
                        <span>{formatDateTime(receipt.receivedAt)}</span>
                      </div>
                      <p>
                        {receipt.deliveryNoteNumber || "No delivery note"} |{" "}
                        {receipt.receiver.fullName}
                      </p>
                      <small>{receipt.remarks || "No GRN remarks recorded."}</small>
                    </div>
                  ))
                ) : (
                  <div className="detail-item-card">
                    <div className="detail-item-top">
                      <strong>No GRN records</strong>
                      <span>Pending</span>
                    </div>
                    <small>Goods receipt remarks will appear here once receiving is recorded.</small>
                  </div>
                )}
              </div>
            </div>

            {submittedMatch ? (
              <div className="decision-banner">
                <strong>
                  Latest review:{" "}
                  <span className={`status-pill status-${getStatusClassName(submittedMatch.status)}`}>
                    {submittedMatch.status}
                  </span>
                </strong>
                <span>
                  Invoice {submittedMatch.invoiceNumber} on {formatDate(submittedMatch.invoiceDate)}
                </span>
                <span>Variance: {formatCurrency(submittedMatch.varianceAmount)}</span>
              </div>
            ) : null}

            <div className="inventory-line-grid">
              <label>
                Invoice number
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  placeholder="INV-2026-001"
                  required
                />
              </label>

              <label>
                Invoice date
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="compact-stack">
              {lineStates.map((line) => {
                const billedLineTotal = Number(line.quantityBilled || 0) * Number(line.unitPrice || 0);
                const expectedLineTotal =
                  Number(line.quantityReceived || 0) * Number(line.expectedUnitPrice || 0);

                return (
                  <div key={line.purchaseOrderLineId} className="stock-card">
                    <div className="mini-line">
                      <strong>
                        {line.lineNumber}. {line.itemDescription}
                      </strong>
                      <span>
                        Expected {line.quantityReceived} @ {line.expectedUnitPrice}
                      </span>
                    </div>

                    <div className="inventory-line-grid">
                      <label>
                        Billed quantity
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantityBilled}
                          onChange={(event) =>
                            updateLineState(
                              line.purchaseOrderLineId,
                              "quantityBilled",
                              event.target.value
                            )
                          }
                          required
                        />
                      </label>

                      <label>
                        Billed unit price
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLineState(
                              line.purchaseOrderLineId,
                              "unitPrice",
                              event.target.value
                            )
                          }
                          required
                        />
                      </label>
                    </div>

                    <p>
                      Invoice line total: {formatCurrency(billedLineTotal)} | Expected line total:{" "}
                      {formatCurrency(expectedLineTotal)}
                    </p>
                  </div>
                );
              })}
            </div>

            <label className="decision-label">
              Finance remarks
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                rows={4}
                placeholder="Capture invoice notes, discrepancies, or matching rationale."
                required
              />
            </label>

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
              <button type="submit" className="primary-action-button" disabled={isSubmitting}>
                {isSubmitting ? "Recording..." : "Record finance match"}
              </button>
            </div>
          </form>
        ) : null}
      </article>

      <article className="card full-span">
        <p className="section-label">Finance history</p>
        <h2>Recorded reviews</h2>

        {!selectedRequisition?.financeMatches?.length ? (
          <div className="empty-state">
            <strong>No finance records yet</strong>
            <p>Finance review history for the selected requisition will appear here.</p>
          </div>
        ) : (
          <div className="detail-item-list">
            {selectedRequisition.financeMatches.map((match) => (
              <div key={match.id} className="detail-item-card">
                <div className="detail-item-top">
                  <strong>{match.invoiceNumber}</strong>
                  <span className={`status-pill status-${getStatusClassName(match.status)}`}>
                    {match.status}
                  </span>
                </div>
                <p>
                  Invoice date {formatDate(match.invoiceDate)} | Reviewed by{" "}
                  {match.financeUser.fullName} on {formatDateTime(match.createdAt)}
                </p>
                <small>
                  Invoice {formatCurrency(match.invoiceAmount)} | PO {formatCurrency(match.poAmount)} |
                  Received {formatCurrency(match.receivedAmount)} | Variance{" "}
                  {formatCurrency(match.varianceAmount)}
                </small>
                <small>{match.remarks || "No finance remarks recorded."}</small>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
