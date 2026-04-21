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
  return String(status ?? "SUBMITTED").toLowerCase().replaceAll("_", "-");
}

function buildQueueSummary(requisition) {
  return {
    id: requisition.id,
    requisitionNumber: requisition.requisitionNumber,
    title: requisition.title,
    status: requisition.status,
    neededByDate: requisition.neededByDate,
    submittedAt: requisition.submittedAt,
    approvedAt: requisition.approvedAt,
    rejectedAt: requisition.rejectedAt,
    itemCount: requisition.items.length,
    totalQuantity: requisition.items.reduce(
      (total, item) => total + Number(item.quantity ?? 0),
      0
    ),
    requester: requisition.requester
  };
}

export function ManagerApprovalWorkspace({ token }) {
  const [requisitions, setRequisitions] = useState([]);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState(null);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [queueError, setQueueError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [decisionSuccess, setDecisionSuccess] = useState("");
  const [notificationPreview, setNotificationPreview] = useState(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadQueue() {
      setIsLoadingQueue(true);
      setQueueError("");

      try {
        const response = await apiClient.listManagerRequisitions(token);

        if (ignore) {
          return;
        }

        setRequisitions(response.requisitions);
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

    loadQueue();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    let ignore = false;

    async function loadDetail() {
      if (!selectedRequisitionId) {
        setSelectedRequisition(null);
        return;
      }

      setIsLoadingDetail(true);
      setDetailError("");

      try {
        const response = await apiClient.getRequisitionById(token, selectedRequisitionId);

        if (!ignore) {
          setSelectedRequisition(response.requisition);
          setDecisionRemarks(response.requisition.decisionRemarks ?? "");
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

  async function submitDecision(decision) {
    if (!selectedRequisition) {
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError("");
    setDecisionSuccess("");
    setNotificationPreview(null);

    try {
      const response =
        decision === "approve"
          ? await apiClient.approveRequisition(token, selectedRequisition.id, {
              remarks: decisionRemarks
            })
          : await apiClient.rejectRequisition(token, selectedRequisition.id, {
              remarks: decisionRemarks
            });

      setSelectedRequisition(response.requisition);
      setNotificationPreview(response.notification);
      setDecisionSuccess(
        `Requisition ${response.requisition.requisitionNumber} ${decision}d successfully.`
      );
      setRequisitions((current) =>
        current
          .map((requisition) =>
            requisition.id === response.requisition.id
              ? buildQueueSummary(response.requisition)
              : requisition
          )
          .sort((left, right) => {
            const statusOrder = {
              SUBMITTED: 0,
              APPROVED: 1,
              REJECTED: 2,
              PARTIALLY_FULFILLED: 3,
              FULFILLED: 4
            };

            return (
              (statusOrder[left.status] ?? 99) - (statusOrder[right.status] ?? 99) ||
              new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
            );
          })
      );
    } catch (error) {
      setDecisionError(error.message);
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  const pendingCount = requisitions.filter(
    (requisition) => requisition.status === "SUBMITTED"
  ).length;
  const isActionable = selectedRequisition?.status === "SUBMITTED";

  return (
    <section className="grid two-column requisition-grid">
      <article className="card">
        <p className="section-label">Approval queue</p>
        <h2>Assigned requisitions</h2>
        <p className="lead">
          Review employee submissions, capture decision remarks, and push the
          workflow into its next state.
        </p>

        <div className="summary-strip">
          <div className="summary-tile">
            <span>Pending</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className="summary-tile">
            <span>Total assigned</span>
            <strong>{requisitions.length}</strong>
          </div>
        </div>

        {isLoadingQueue ? <p className="helper-text">Loading manager queue...</p> : null}
        {queueError ? <p className="form-error">{queueError}</p> : null}

        {!isLoadingQueue && !queueError && !requisitions.length ? (
          <div className="empty-state">
            <strong>No requisitions assigned</strong>
            <p>New employee submissions routed to you will appear here automatically.</p>
          </div>
        ) : null}

        <div className="requisition-list">
          {requisitions.map((requisition) => (
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
                setDecisionError("");
                setDecisionSuccess("");
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
                <span>{formatDate(requisition.submittedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="card">
        <p className="section-label">Decision panel</p>
        <h2>Approval action</h2>

        {isLoadingDetail ? <p className="helper-text">Loading requisition detail...</p> : null}
        {detailError ? <p className="form-error">{detailError}</p> : null}

        {!isLoadingDetail && !detailError && !selectedRequisition ? (
          <div className="empty-state">
            <strong>No requisition selected</strong>
            <p>Choose an assigned requisition from the queue to review and decide.</p>
          </div>
        ) : null}

        {!isLoadingDetail && !detailError && selectedRequisition ? (
          <div className="detail-stack">
            <div className="decision-banner">
              <strong>{selectedRequisition.requester.fullName}</strong>
              <span>{selectedRequisition.requester.department}</span>
              <small>{selectedRequisition.requester.email}</small>
            </div>

            <label className="decision-label">
              Decision remarks
              <textarea
                value={decisionRemarks}
                onChange={(event) => setDecisionRemarks(event.target.value)}
                rows={4}
                placeholder="Explain why you are approving or rejecting this request."
                disabled={!isActionable || isSubmittingDecision}
              />
            </label>

            {decisionError ? <p className="form-error">{decisionError}</p> : null}
            {decisionSuccess ? <p className="form-success">{decisionSuccess}</p> : null}

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
                type="button"
                className="secondary-button"
                onClick={() => submitDecision("approve")}
                disabled={!isActionable || isSubmittingDecision}
              >
                {isSubmittingDecision ? "Submitting..." : "Approve"}
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => submitDecision("reject")}
                disabled={!isActionable || isSubmittingDecision}
              >
                {isSubmittingDecision ? "Submitting..." : "Reject"}
              </button>
            </div>

            {!isActionable ? (
              <p className="helper-text">
                This requisition already has a manager decision recorded.
              </p>
            ) : null}
          </div>
        ) : null}
      </article>

      <article className="card full-span">
        <p className="section-label">Approval detail</p>
        <h2>Requisition review</h2>

        {!selectedRequisition ? null : (
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
                  <span>Submitted</span>
                  <strong>{formatDateTime(selectedRequisition.submittedAt)}</strong>
                </div>
                <div>
                  <span>Needed by</span>
                  <strong>{formatDate(selectedRequisition.neededByDate)}</strong>
                </div>
                <div>
                  <span>Requester</span>
                  <strong>{selectedRequisition.requester.fullName}</strong>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <p className="section-label">Business justification</p>
              <p className="detail-copy">{selectedRequisition.justification}</p>
            </div>

            <div className="detail-section">
              <p className="section-label">Requested items</p>
              <div className="detail-item-list">
                {selectedRequisition.items.map((item) => (
                  <div key={item.id} className="detail-item-card">
                    <div className="detail-item-top">
                      <strong>
                        {item.lineNumber}. {item.description}
                      </strong>
                      <span>
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                    <p>{item.specification || "No additional specification provided."}</p>
                    <small>
                      Estimated unit cost:{" "}
                      {item.estimatedUnitCost === null
                        ? "Not provided"
                        : item.estimatedUnitCost.toFixed(2)}
                    </small>
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <p className="section-label">Approval history</p>
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
        )}
      </article>
    </section>
  );
}
