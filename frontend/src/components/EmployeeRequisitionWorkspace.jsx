import { useEffect, useState } from "react";
import { apiClient } from "../api/client.js";

function createBlankItem() {
  return {
    description: "",
    specification: "",
    quantity: "1",
    unit: "pcs",
    estimatedUnitCost: ""
  };
}

function createInitialFormState() {
  return {
    title: "",
    justification: "",
    neededByDate: "",
    items: [createBlankItem()]
  };
}

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

function buildRequisitionSummary(requisition) {
  return {
    id: requisition.id,
    requisitionNumber: requisition.requisitionNumber,
    title: requisition.title,
    status: requisition.status,
    neededByDate: requisition.neededByDate,
    submittedAt: requisition.submittedAt,
    itemCount: requisition.items.length,
    totalQuantity: requisition.items.reduce(
      (total, item) => total + Number(item.quantity ?? 0),
      0
    ),
    manager: requisition.manager
  };
}

function normalizePayload(formValues) {
  return {
    title: formValues.title,
    justification: formValues.justification,
    neededByDate: formValues.neededByDate || null,
    items: formValues.items.map((item) => ({
      description: item.description,
      specification: item.specification,
      quantity: Number(item.quantity),
      unit: item.unit,
      estimatedUnitCost: item.estimatedUnitCost
    }))
  };
}

export function EmployeeRequisitionWorkspace({ token }) {
  const [formValues, setFormValues] = useState(createInitialFormState);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState(null);
  const [selectedRequisition, setSelectedRequisition] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadRequisitions() {
      setIsLoadingList(true);
      setListError("");

      try {
        const response = await apiClient.listMyRequisitions(token);

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
          setListError(error.message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingList(false);
        }
      }
    }

    loadRequisitions();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    let ignore = false;

    async function loadRequisitionDetail() {
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

    loadRequisitionDetail();

    return () => {
      ignore = true;
    };
  }, [selectedRequisitionId, token]);

  function updateItem(index, field, value) {
    setFormValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  }

  function addItem() {
    setFormValues((current) => ({
      ...current,
      items: [...current.items, createBlankItem()]
    }));
  }

  function removeItem(index) {
    setFormValues((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await apiClient.createRequisition(token, normalizePayload(formValues));
      const created = response.requisition;

      setSuccessMessage(`Requisition ${created.requisitionNumber} submitted successfully.`);
      setFormValues(createInitialFormState());
      setRequisitions((current) => [
        buildRequisitionSummary(created),
        ...current.filter((requisition) => requisition.id !== created.id)
      ]);
      setSelectedRequisition(created);
      setSelectedRequisitionId(created.id);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid two-column requisition-grid">
      <article className="card">
        <p className="section-label">Module 2</p>
        <h2>Create requisition</h2>
        <p className="lead">
          Submit item requests with line details and send them straight to your assigned
          line manager.
        </p>

        <form className="requisition-form" onSubmit={handleSubmit}>
          <label>
            Request title
            <input
              type="text"
              value={formValues.title}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
              placeholder="Laptop accessories for onboarding"
              required
            />
          </label>

          <label>
            Business justification
            <textarea
              value={formValues.justification}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  justification: event.target.value
                }))
              }
              placeholder="Explain why this request is needed and the business impact."
              rows={4}
              required
            />
          </label>

          <label>
            Needed by
            <input
              type="date"
              value={formValues.neededByDate}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  neededByDate: event.target.value
                }))
              }
            />
          </label>

          <div className="items-header">
            <div>
              <p className="section-label">Requested items</p>
              <h3>Line items</h3>
            </div>
            <button type="button" className="secondary-button" onClick={addItem}>
              Add item
            </button>
          </div>

          <div className="item-stack">
            {formValues.items.map((item, index) => (
              <div key={`item-${index + 1}`} className="item-card">
                <div className="item-card-header">
                  <strong>Item {index + 1}</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => removeItem(index)}
                    disabled={formValues.items.length === 1}
                  >
                    Remove
                  </button>
                </div>

                <div className="item-fields">
                  <label>
                    Description
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) =>
                        updateItem(index, "description", event.target.value)
                      }
                      placeholder="Wireless mouse"
                      required
                    />
                  </label>

                  <label>
                    Specification
                    <input
                      type="text"
                      value={item.specification}
                      onChange={(event) =>
                        updateItem(index, "specification", event.target.value)
                      }
                      placeholder="Bluetooth, ergonomic"
                    />
                  </label>

                  <label>
                    Quantity
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, "quantity", event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Unit
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(event) => updateItem(index, "unit", event.target.value)}
                      placeholder="pcs"
                      required
                    />
                  </label>

                  <label>
                    Estimated unit cost
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.estimatedUnitCost}
                      onChange={(event) =>
                        updateItem(index, "estimatedUnitCost", event.target.value)
                      }
                      placeholder="Optional"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          {formError ? <p className="form-error">{formError}</p> : null}
          {successMessage ? <p className="form-success">{successMessage}</p> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit requisition"}
          </button>
        </form>
      </article>

      <article className="card">
        <p className="section-label">My queue</p>
        <h2>Submitted requisitions</h2>
        <p className="lead">
          Review what you have already sent, check status, and reopen details anytime.
        </p>

        {isLoadingList ? <p className="helper-text">Loading your requisitions...</p> : null}
        {listError ? <p className="form-error">{listError}</p> : null}

        {!isLoadingList && !listError && !requisitions.length ? (
          <div className="empty-state">
            <strong>No requisitions yet</strong>
            <p>Your submitted requests will appear here once Module 2 receives its first record.</p>
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
              onClick={() => setSelectedRequisitionId(requisition.id)}
            >
              <div className="requisition-list-top">
                <strong>{requisition.requisitionNumber}</strong>
                <span className={`status-pill status-${getStatusClassName(requisition.status)}`}>
                  {requisition.status.replaceAll("_", " ")}
                </span>
              </div>
              <p>{requisition.title}</p>
              <div className="meta-row">
                <span>{requisition.itemCount} items</span>
                <span>Qty {requisition.totalQuantity}</span>
                <span>{formatDate(requisition.submittedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="card full-span">
        <p className="section-label">Selected requisition</p>
        <h2>Request detail</h2>

        {isLoadingDetail ? <p className="helper-text">Loading requisition detail...</p> : null}
        {detailError ? <p className="form-error">{detailError}</p> : null}

        {!isLoadingDetail && !detailError && !selectedRequisition ? (
          <div className="empty-state">
            <strong>No requisition selected</strong>
            <p>Choose a request from the right-hand list to inspect its full detail.</p>
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
                  <span>Submitted</span>
                  <strong>{formatDateTime(selectedRequisition.submittedAt)}</strong>
                </div>
                <div>
                  <span>Needed by</span>
                  <strong>{formatDate(selectedRequisition.neededByDate)}</strong>
                </div>
                <div>
                  <span>Manager</span>
                  <strong>{selectedRequisition.manager.fullName}</strong>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <p className="section-label">Justification</p>
              <p className="detail-copy">{selectedRequisition.justification}</p>
            </div>

            <div className="detail-section">
              <p className="section-label">Items</p>
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
              <p className="section-label">Approval trail</p>
              <div className="timeline-list">
                {selectedRequisition.approvalLogs.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-marker" />
                    <div>
                      <strong>
                        {log.action.replaceAll("_", " ")} by {log.actor.fullName}
                      </strong>
                      <p>
                        {log.remarks || "No remarks captured for this step."}
                      </p>
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
