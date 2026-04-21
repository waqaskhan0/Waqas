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
  return String(status ?? "PROCUREMENT_PENDING").toLowerCase().replaceAll("_", "-");
}

function buildQueueSummary(requisition) {
  return {
    id: requisition.id,
    requisitionNumber: requisition.requisitionNumber,
    title: requisition.title,
    status: requisition.status,
    approvedAt: requisition.approvedAt,
    requester: requisition.requester,
    procurementItemCount: requisition.inventoryAllocations.filter(
      (allocation) => allocation.quantityForProcurement > 0
    ).length,
    procurementQuantity: requisition.inventoryAllocations.reduce(
      (total, allocation) => total + Number(allocation.quantityForProcurement ?? 0),
      0
    ),
    purchaseOrderNumber: requisition.purchaseOrders[0]?.poNumber ?? null,
    purchaseOrderStatus: requisition.purchaseOrders[0]?.status ?? null
  };
}

function buildLineState(requisition) {
  if (!requisition) {
    return [];
  }

  const poLines = new Map(
    (requisition.purchaseOrders[0]?.lines ?? []).map((line) => [
      line.requisitionItemId,
      line
    ])
  );

  return requisition.inventoryAllocations
    .filter((allocation) => allocation.quantityForProcurement > 0)
    .map((allocation) => {
      const poLine = poLines.get(allocation.requisitionItemId);

      return {
        requisitionItemId: allocation.requisitionItemId,
        quantityOrdered: poLine
          ? String(poLine.quantityOrdered)
          : String(allocation.quantityForProcurement),
        unitPrice: poLine ? String(poLine.unitPrice) : ""
      };
    });
}

export function ProcurementWorkspace({ token }) {
  const [queue, setQueue] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState(null);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineStates, setLineStates] = useState([]);
  const [queueError, setQueueError] = useState("");
  const [vendorsError, setVendorsError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [notificationPreview, setNotificationPreview] = useState(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadQueue() {
      setIsLoadingQueue(true);
      setQueueError("");

      try {
        const response = await apiClient.listProcurementQueue(token);

        if (!ignore) {
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

    async function loadVendors() {
      setIsLoadingVendors(true);
      setVendorsError("");

      try {
        const response = await apiClient.listVendors(token);

        if (!ignore) {
          setVendors(response.vendors);
          setSelectedVendorId((current) =>
            current || (response.vendors[0] ? String(response.vendors[0].id) : "")
          );
        }
      } catch (error) {
        if (!ignore) {
          setVendorsError(error.message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingVendors(false);
        }
      }
    }

    loadQueue();
    loadVendors();

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
          setNotes(response.requisition.purchaseOrders[0]?.notes ?? "");
          setExpectedDeliveryDate(
            response.requisition.purchaseOrders[0]?.expectedDeliveryDate
              ? String(response.requisition.purchaseOrders[0].expectedDeliveryDate).slice(0, 10)
              : ""
          );
          const vendorId = response.requisition.purchaseOrders[0]?.vendor?.id;
          if (vendorId) {
            setSelectedVendorId(String(vendorId));
          }
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
      const response = await apiClient.createPurchaseOrder(token, selectedRequisition.id, {
        vendorId: Number(selectedVendorId),
        expectedDeliveryDate: expectedDeliveryDate || null,
        notes,
        lines: lineStates.map((line) => ({
          requisitionItemId: line.requisitionItemId,
          quantityOrdered: Number(line.quantityOrdered),
          unitPrice: Number(line.unitPrice)
        }))
      });

      setSelectedRequisition(response.requisition);
      setLineStates(buildLineState(response.requisition));
      setNotificationPreview(response.notification);
      setSubmitSuccess(
        `Purchase order ${response.requisition.purchaseOrders[0]?.poNumber ?? ""} created successfully.`
      );
      setQueue((current) =>
        current.map((requisition) =>
          requisition.id === response.requisition.id
            ? buildQueueSummary(response.requisition)
            : requisition
        )
      );
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const openProcurementCount = queue.filter(
    (requisition) => !requisition.purchaseOrderNumber
  ).length;
  const isActionable =
    selectedRequisition &&
    ["PROCUREMENT_PENDING", "PARTIALLY_FULFILLED"].includes(selectedRequisition.status) &&
    !selectedRequisition.purchaseOrders.length;

  const procurementAllocations =
    selectedRequisition?.inventoryAllocations.filter(
      (allocation) => allocation.quantityForProcurement > 0
    ) ?? [];

  return (
    <section className="grid two-column requisition-grid">
      <article className="card">
        <p className="section-label">Procurement queue</p>
        <h2>Purchase order candidates</h2>
        <p className="lead">
          Convert procurement balances into purchase orders without losing the
          requisition and inventory context.
        </p>

        <div className="summary-strip">
          <div className="summary-tile">
            <span>Waiting for PO</span>
            <strong>{openProcurementCount}</strong>
          </div>
          <div className="summary-tile">
            <span>Total tracked</span>
            <strong>{queue.length}</strong>
          </div>
        </div>

        {isLoadingQueue ? <p className="helper-text">Loading procurement queue...</p> : null}
        {queueError ? <p className="form-error">{queueError}</p> : null}

        {!isLoadingQueue && !queueError && !queue.length ? (
          <div className="empty-state">
            <strong>No procurement balances</strong>
            <p>Requests with procurement demand will appear here after inventory review.</p>
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
                <span>{requisition.procurementItemCount} items</span>
                <span>Qty {requisition.procurementQuantity}</span>
                <span>{requisition.purchaseOrderNumber ?? "No PO yet"}</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="card">
        <p className="section-label">Vendor panel</p>
        <h2>Approved vendors</h2>
        <p className="lead">
          Choose a vendor and capture order details for the selected requisition.
        </p>

        {isLoadingVendors ? <p className="helper-text">Loading vendors...</p> : null}
        {vendorsError ? <p className="form-error">{vendorsError}</p> : null}

        <div className="stock-list">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="stock-card">
              <strong>{vendor.vendorName}</strong>
              <p>{vendor.contactName || "No contact recorded."}</p>
              <small>
                {vendor.vendorCode} | {vendor.email || "No email"} | {vendor.phone || "No phone"}
              </small>
            </div>
          ))}
        </div>
      </article>

      <article className="card full-span">
        <p className="section-label">Purchase order</p>
        <h2>Procurement detail</h2>

        {isLoadingDetail ? <p className="helper-text">Loading requisition detail...</p> : null}
        {detailError ? <p className="form-error">{detailError}</p> : null}

        {!isLoadingDetail && !detailError && !selectedRequisition ? (
          <div className="empty-state">
            <strong>No requisition selected</strong>
            <p>Select a procurement candidate to prepare its purchase order.</p>
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
                  <span>Inventory decision</span>
                  <strong>
                    {selectedRequisition.inventoryDecision
                      ? selectedRequisition.inventoryDecision.replaceAll("_", " ")
                      : "Pending"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <p className="section-label">Procurement balance</p>
              <div className="detail-item-list">
                {procurementAllocations.map((allocation) => (
                  <div key={allocation.id} className="detail-item-card">
                    <div className="detail-item-top">
                      <strong>
                        {allocation.lineNumber}. {allocation.itemDescription}
                      </strong>
                      <span>Need {allocation.quantityForProcurement}</span>
                    </div>
                    <p>
                      Issued {allocation.quantityIssued} | Remaining procurement{" "}
                      {allocation.quantityForProcurement}
                    </p>
                    <small>{allocation.remarks || "No inventory remark recorded."}</small>
                  </div>
                ))}
              </div>
            </div>

            <form className="inventory-form" onSubmit={handleSubmit}>
              <div className="inventory-line-grid">
                <label>
                  Vendor
                  <select
                    value={selectedVendorId}
                    onChange={(event) => setSelectedVendorId(event.target.value)}
                    disabled={!isActionable || isSubmitting}
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.vendorCode} - {vendor.vendorName}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Expected delivery
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(event) => setExpectedDeliveryDate(event.target.value)}
                    disabled={!isActionable || isSubmitting}
                  />
                </label>
              </div>

              <label className="decision-label">
                Order notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Capture vendor notes, commercial context, or urgency."
                  disabled={!isActionable || isSubmitting}
                />
              </label>

              <div className="inventory-line-stack">
                {procurementAllocations.map((allocation) => {
                  const lineState =
                    lineStates.find(
                      (line) => line.requisitionItemId === allocation.requisitionItemId
                    ) ?? {
                      requisitionItemId: allocation.requisitionItemId,
                      quantityOrdered: String(allocation.quantityForProcurement),
                      unitPrice: ""
                    };

                  return (
                    <div key={allocation.id} className="item-card">
                      <div className="detail-item-top">
                        <strong>
                          {allocation.lineNumber}. {allocation.itemDescription}
                        </strong>
                        <span>Need {allocation.quantityForProcurement}</span>
                      </div>
                      <p>{allocation.requisitionSpecification || "No specification provided."}</p>

                      <div className="inventory-line-grid">
                        <label>
                          Quantity ordered
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={lineState.quantityOrdered}
                            onChange={(event) =>
                              updateLineState(
                                allocation.requisitionItemId,
                                "quantityOrdered",
                                event.target.value
                              )
                            }
                            disabled={!isActionable || isSubmitting}
                          />
                        </label>

                        <label>
                          Unit price
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={lineState.unitPrice}
                            onChange={(event) =>
                              updateLineState(
                                allocation.requisitionItemId,
                                "unitPrice",
                                event.target.value
                              )
                            }
                            disabled={!isActionable || isSubmitting}
                          />
                        </label>
                      </div>
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
                  {isSubmitting ? "Creating..." : "Create purchase order"}
                </button>
              </div>

              {!isActionable ? (
                <p className="helper-text">
                  This requisition already has a purchase order recorded.
                </p>
              ) : null}
            </form>

            {selectedRequisition.purchaseOrders.length ? (
              <div className="detail-section">
                <p className="section-label">Purchase orders</p>
                <div className="detail-item-list">
                  {selectedRequisition.purchaseOrders.map((purchaseOrder) => (
                    <div key={purchaseOrder.id} className="detail-item-card">
                      <div className="detail-item-top">
                        <strong>{purchaseOrder.poNumber}</strong>
                        <span>{purchaseOrder.status.replaceAll("_", " ")}</span>
                      </div>
                      <p>
                        {purchaseOrder.vendor.vendorName} | Subtotal{" "}
                        {purchaseOrder.subtotalAmount.toFixed(2)}
                      </p>
                      <small>
                        Expected delivery: {formatDate(purchaseOrder.expectedDeliveryDate)} |{" "}
                        {formatDateTime(purchaseOrder.orderDate)}
                      </small>
                      <div className="detail-item-list compact-stack">
                        {purchaseOrder.lines.map((line) => (
                          <div key={line.id} className="mini-line">
                            <strong>
                              {line.lineNumber}. {line.itemDescription}
                            </strong>
                            <small>
                              {line.quantityOrdered} x {line.unitPrice.toFixed(2)} ={" "}
                              {line.lineTotal.toFixed(2)}
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
