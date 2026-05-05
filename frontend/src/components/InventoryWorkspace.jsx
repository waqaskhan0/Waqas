import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client.js";

const emptyFilters = {
  requestId: "",
  department: "",
  location: "",
  approvalStatus: "",
  issuanceStatus: "",
  date: "",
  requestedBy: ""
};

const locationOptions = ["I9 warehouse", "Secretariat", "NSR CC", "RWP CC"];

const departmentOptions = [
  "admin",
  "procurement",
  "communication",
  "programe",
  "HR",
  "IT",
  "AI",
  "data management",
  "monitoring",
  "project management",
  "finance",
  "Design & architect"
];

const approvalStatusOptions = ["Approved", "Pending", "Rejected"];

const issuanceStatusOptions = ["Issued", "Pending", "not issued"];

const sampleRequests = [
  {
    id: "sample-req-001-1",
    requisitionId: "sample-req-001",
    requisitionItemId: "sample-line-001",
    requestId: "REQ-20260505-1042",
    requestDate: "2026-05-05",
    submittedAt: "2026-05-05T09:20:00",
    department: "admin",
    location: "Secretariat",
    requestedBy: "Ayesha Khan",
    requesterEmail: "ayesha.khan@example.com",
    requesterEmployeeCode: "EMP-014",
    itemId: "STN-001",
    itemName: "A4 Printer Paper",
    itemType: "Stationery",
    itemCategory: "Stationary",
    itemSpecification: "Category: Stationary | Type: Paper | Item ID: STN-001 | Notes: For monthly office printing",
    quantityRequested: 12,
    unit: "reams",
    manager: {
      fullName: "Bilal Ahmed",
      email: "bilal.ahmed@example.com"
    },
    approvalStatus: "Pending",
    issuanceStatus: "not issued",
    notes: "For monthly office printing and file preparation.",
    decisionRemarks: "",
    inventoryRemarks: "",
    approvedAt: null,
    rejectedAt: null,
    fulfilledAt: null,
    issuedQuantity: 0,
    procurementQuantity: 0,
    stockItem: {
      id: "sample-stock-001",
      sku: "STN-001",
      itemName: "A4 Printer Paper",
      quantityOnHand: 36,
      unit: "reams"
    },
    isSample: true
  },
  {
    id: "sample-req-002-1",
    requisitionId: "sample-req-002",
    requisitionItemId: "sample-line-002",
    requestId: "REQ-20260504-3381",
    requestDate: "2026-05-04",
    submittedAt: "2026-05-04T14:05:00",
    department: "procurement",
    location: "I9 warehouse",
    requestedBy: "Usman Tariq",
    requesterEmail: "usman.tariq@example.com",
    requesterEmployeeCode: "EMP-027",
    itemId: "SAF-014",
    itemName: "Safety Gloves",
    itemType: "PPE",
    itemCategory: "Safety",
    itemSpecification: "Category: Safety | Type: PPE | Item ID: SAF-014 | Notes: Required for warehouse team",
    quantityRequested: 50,
    unit: "pairs",
    manager: {
      fullName: "Nadia Sheikh",
      email: "nadia.sheikh@example.com"
    },
    approvalStatus: "Approved",
    issuanceStatus: "Issued",
    notes: "Required for incoming warehouse staff rotation.",
    decisionRemarks: "Approved for immediate warehouse use.",
    inventoryRemarks: "Issued 20 pairs from stock; remaining quantity routed to procurement.",
    approvedAt: "2026-05-04T16:30:00",
    rejectedAt: null,
    fulfilledAt: null,
    issuedQuantity: 20,
    procurementQuantity: 30,
    stockItem: {
      id: "sample-stock-014",
      sku: "SAF-014",
      itemName: "Safety Gloves",
      quantityOnHand: 20,
      unit: "pairs"
    },
    isSample: true
  },
  {
    id: "sample-req-003-1",
    requisitionId: "sample-req-003",
    requisitionItemId: "sample-line-003",
    requestId: "REQ-20260503-7819",
    requestDate: "2026-05-03",
    submittedAt: "2026-05-03T11:10:00",
    department: "IT",
    location: "NSR CC",
    requestedBy: "Hamza Noor",
    requesterEmail: "hamza.noor@example.com",
    requesterEmployeeCode: "EMP-041",
    itemId: "IT-220",
    itemName: "Network Switch",
    itemType: "Hardware",
    itemCategory: "IT Equipment",
    itemSpecification: "Category: IT Equipment | Type: Hardware | Item ID: IT-220 | Notes: Replacement for access rack",
    quantityRequested: 2,
    unit: "units",
    manager: {
      fullName: "Sana Malik",
      email: "sana.malik@example.com"
    },
    approvalStatus: "Approved",
    issuanceStatus: "Pending",
    notes: "Replacement switches for access rack upgrade.",
    decisionRemarks: "Approved due to aging network equipment.",
    inventoryRemarks: "No matching stock available; sent to procurement.",
    approvedAt: "2026-05-03T13:45:00",
    rejectedAt: null,
    fulfilledAt: null,
    issuedQuantity: 0,
    procurementQuantity: 2,
    stockItem: null,
    isSample: true
  }
];

const sampleStockItems = [
  {
    id: "sample-stock-001",
    sku: "STN-001",
    itemName: "A4 Printer Paper",
    quantityOnHand: 36,
    unit: "reams"
  },
  {
    id: "sample-stock-014",
    sku: "SAF-014",
    itemName: "Safety Gloves",
    quantityOnHand: 20,
    unit: "pairs"
  }
];

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

function formatStatus(value) {
  return String(value ?? "Not set");
}

function getStatusClassName(status) {
  return String(status ?? "pending")
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("_", "-");
}

function normalizeApprovalStatus(status) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized.includes("reject")) {
    return "Rejected";
  }

  if (normalized.includes("pending") || normalized.includes("submitted")) {
    return "Pending";
  }

  return "Approved";
}

function normalizeIssuanceStatus(status) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "issued" || normalized.includes("fulfilled")) {
    return "Issued";
  }

  if (normalized.includes("pending") || normalized.includes("awaiting") || normalized.includes("procurement")) {
    return "Pending";
  }

  return "not issued";
}

function normalizeRequestOptions(request) {
  return {
    ...request,
    approvalStatus: normalizeApprovalStatus(request.approvalStatus),
    issuanceStatus: normalizeIssuanceStatus(request.issuanceStatus)
  };
}

function includesText(value, search) {
  return String(value ?? "").toLowerCase().includes(String(search ?? "").trim().toLowerCase());
}

function findStockAvailability(request, stockItems) {
  if (request.stockItem) {
    return {
      found: true,
      sku: request.stockItem.sku,
      itemName: request.stockItem.itemName,
      quantity: request.stockItem.quantityOnHand,
      unit: request.stockItem.unit
    };
  }

  const itemId = String(request.itemId ?? "").toLowerCase();
  const itemName = String(request.itemName ?? "").toLowerCase();
  const match = stockItems.find((stockItem) => {
    const sku = String(stockItem.sku ?? "").toLowerCase();
    const stockName = String(stockItem.itemName ?? "").toLowerCase();

    return (
      (itemId && sku === itemId) ||
      (itemName && stockName.includes(itemName)) ||
      (stockName && itemName.includes(stockName))
    );
  });

  if (!match) {
    return {
      found: false,
      quantity: 0,
      unit: request.unit
    };
  }

  return {
    found: true,
    sku: match.sku,
    itemName: match.itemName,
    quantity: match.quantityOnHand,
    unit: match.unit
  };
}

function filterRequests(requests, filters) {
  return requests.filter((request) => {
    const dateValue = request.requestDate || request.submittedAt;

    return (
      includesText(request.requestId, filters.requestId) &&
      includesText(request.department, filters.department) &&
      includesText(request.location, filters.location) &&
      includesText(request.approvalStatus, filters.approvalStatus) &&
      includesText(request.issuanceStatus, filters.issuanceStatus) &&
      includesText(request.requestedBy, filters.requestedBy) &&
      (!filters.date || String(dateValue ?? "").slice(0, 10) === filters.date)
    );
  });
}

function DetailBlock({ title, children }) {
  return (
    <section className="request-detail-block">
      <h3>{title}</h3>
      <div className="request-detail-grid">{children}</div>
    </section>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="request-detail-field">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

export function InventoryWorkspace({ token }) {
  const [requests, setRequests] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [stockCapsuleId, setStockCapsuleId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [error, setError] = useState("");
  const [stockError, setStockError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadRequests() {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiClient.listInventoryRequests(token);

        if (!ignore) {
          setRequests(response.requests);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
          setRequests([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
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
      } catch (loadError) {
        if (!ignore) {
          setStockError(loadError.message);
          setStockItems([]);
        }
      } finally {
        if (!ignore) {
          setIsLoadingStock(false);
        }
      }
    }

    loadRequests();
    loadStock();

    return () => {
      ignore = true;
    };
  }, [token]);

  const visibleRequests = (requests.length ? requests : sampleRequests).map(normalizeRequestOptions);
  const visibleStockItems = stockItems.length ? stockItems : sampleStockItems;
  const isShowingSamples = !requests.length && !isLoading && !error;
  const filteredRequests = useMemo(
    () => filterRequests(visibleRequests, filters),
    [visibleRequests, filters]
  );

  function updateFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value
    }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
  }

  return (
    <section className="inventory-requests-page">
      <article className="card inventory-request-toolbar">
        <div className="card-header">
          <div>
            <p className="section-label">Inventory requests</p>
            <h2 className="card-title">Requested items</h2>
            <p className="lead">
              Track what was requested, who requested it, and where each request currently
              stands in approval and issuance.
            </p>
          </div>
          <span className="badge badge-blue">{filteredRequests.length} shown</span>
        </div>
        {isShowingSamples ? (
          <p className="form-success">
            Showing sample request cards for preview. Live requests will replace these once
            requisitions exist.
          </p>
        ) : null}

        <div className="inventory-filter-grid">
          <label className="form-group">
            <span className="form-label">Request ID</span>
            <input
              className="form-input"
              value={filters.requestId}
              onChange={(event) => updateFilter("requestId", event.target.value)}
              placeholder="REQ-..."
            />
          </label>
          <label className="form-group">
            <span className="form-label">Requested by</span>
            <input
              className="form-input"
              value={filters.requestedBy}
              onChange={(event) => updateFilter("requestedBy", event.target.value)}
              placeholder="Requestor name"
            />
          </label>
          <label className="form-group">
            <span className="form-label">Department</span>
            <select
              className="form-select"
              value={filters.department}
              onChange={(event) => updateFilter("department", event.target.value)}
            >
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Location</span>
            <select
              className="form-select"
              value={filters.location}
              onChange={(event) => updateFilter("location", event.target.value)}
            >
              <option value="">All locations</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Approval status</span>
            <select
              className="form-select"
              value={filters.approvalStatus}
              onChange={(event) => updateFilter("approvalStatus", event.target.value)}
            >
              <option value="">All approval statuses</option>
              {approvalStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Issuance status</span>
            <select
              className="form-select"
              value={filters.issuanceStatus}
              onChange={(event) => updateFilter("issuanceStatus", event.target.value)}
            >
              <option value="">All issuance statuses</option>
              {issuanceStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Date</span>
            <input
              className="form-input"
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter("date", event.target.value)}
            />
          </label>
          <div className="inventory-filter-actions">
            <button type="button" className="btn btn-ghost" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </div>
      </article>

      {isLoading ? <p className="helper-text">Loading inventory requests...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {stockError ? <p className="form-error">{stockError}</p> : null}

      {!isLoading && !error && !filteredRequests.length ? (
        <article className="empty-state">
          <strong>No requests match these filters</strong>
          <p>Try clearing one or more filters to see more request cards.</p>
        </article>
      ) : null}

      <div className="inventory-request-grid">
        {filteredRequests.map((request) => {
          const stockAvailability = findStockAvailability(request, visibleStockItems);
          const isCapsuleOpen = stockCapsuleId === request.id;

          return (
            <article
              key={request.id}
              className="inventory-request-card"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedRequest(request)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setSelectedRequest(request);
                }
              }}
            >
              <div className="inventory-request-card-top">
                <div>
                  <span className="mono">{request.requestId}</span>
                  <h3>{request.itemName}</h3>
                  {request.isSample ? <small className="sample-chip">Sample data</small> : null}
                </div>
                <span
                  className={`status-pill status-${getStatusClassName(
                    request.approvalStatus
                  )}`}
                >
                  {request.approvalStatus}
                </span>
              </div>

              <div className="inventory-request-facts">
                <DetailField label="Request date" value={formatDate(request.requestDate)} />
                <DetailField label="Department" value={request.department} />
                <DetailField label="Location" value={request.location} />
                <DetailField label="Requested by" value={request.requestedBy} />
                <DetailField label="Item ID" value={request.itemId} />
                <DetailField label="Item type" value={request.itemType} />
                <DetailField
                  label="Quantity"
                  value={`${request.quantityRequested} ${request.unit}`}
                />
                <DetailField label="Issuance" value={request.issuanceStatus} />
              </div>

              <div className="inventory-request-manager">
                <span>Line manager</span>
                <strong>{request.manager.fullName}</strong>
                <small>{request.manager.email}</small>
              </div>

              <p className="inventory-request-notes">
                {request.notes || request.decisionRemarks || "No notes or remarks captured."}
              </p>

              <div className="inventory-request-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedRequest(request);
                  }}
                >
                  View details
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    setStockCapsuleId((current) => (current === request.id ? null : request.id));
                  }}
                >
                  View stock
                </button>
              </div>

              {isCapsuleOpen ? (
                <div className="stock-capsule" onClick={(event) => event.stopPropagation()}>
                  {isLoadingStock ? (
                    <span>Checking stock...</span>
                  ) : stockAvailability.found ? (
                    <>
                      <strong>
                        {stockAvailability.quantity} {stockAvailability.unit} available
                      </strong>
                      <span>
                        {stockAvailability.sku} | {stockAvailability.itemName}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>No matching stock found</strong>
                      <span>This item may need procurement or stock mapping.</span>
                    </>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {selectedRequest ? (
        <div className="request-detail-overlay" role="presentation" onClick={() => setSelectedRequest(null)}>
          <aside
            className="request-detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Request details for ${selectedRequest.requestId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="request-detail-header">
              <div>
                <p className="section-label">Request detail</p>
                <h2>{selectedRequest.requestId}</h2>
                <p>{selectedRequest.itemName}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedRequest(null)}>
                Close
              </button>
            </div>

            <DetailBlock title="Requestor info">
              <DetailField label="Name" value={selectedRequest.requestedBy} />
              <DetailField label="Email" value={selectedRequest.requesterEmail} />
              <DetailField label="Employee code" value={selectedRequest.requesterEmployeeCode} />
              <DetailField label="Department" value={selectedRequest.department} />
              <DetailField label="Location" value={selectedRequest.location} />
              <DetailField label="Request date" value={formatDate(selectedRequest.requestDate)} />
            </DetailBlock>

            <DetailBlock title="Complete item info">
              <DetailField label="Item ID" value={selectedRequest.itemId} />
              <DetailField label="Item name" value={selectedRequest.itemName} />
              <DetailField label="Item category" value={selectedRequest.itemCategory} />
              <DetailField label="Item type" value={selectedRequest.itemType} />
              <DetailField
                label="Quantity requested"
                value={`${selectedRequest.quantityRequested} ${selectedRequest.unit}`}
              />
              <DetailField label="Specification" value={selectedRequest.itemSpecification} />
              <DetailField label="Notes" value={selectedRequest.notes} />
            </DetailBlock>

            <DetailBlock title="Approval info">
              <DetailField label="Line manager" value={selectedRequest.manager.fullName} />
              <DetailField label="Manager email" value={selectedRequest.manager.email} />
              <DetailField label="Approval status" value={formatStatus(selectedRequest.approvalStatus)} />
              <DetailField label="Approved at" value={formatDate(selectedRequest.approvedAt)} />
              <DetailField label="Rejected at" value={formatDate(selectedRequest.rejectedAt)} />
              <DetailField label="Approval remarks" value={selectedRequest.decisionRemarks} />
            </DetailBlock>

            <DetailBlock title="Issuance info">
              <DetailField label="Issuance status" value={formatStatus(selectedRequest.issuanceStatus)} />
              <DetailField
                label="Issued quantity"
                value={`${selectedRequest.issuedQuantity} ${selectedRequest.unit}`}
              />
              <DetailField
                label="Procurement quantity"
                value={`${selectedRequest.procurementQuantity} ${selectedRequest.unit}`}
              />
              <DetailField label="Fulfilled at" value={formatDate(selectedRequest.fulfilledAt)} />
              <DetailField label="Inventory remarks" value={selectedRequest.inventoryRemarks} />
              <DetailField
                label="Mapped stock"
                value={
                  selectedRequest.stockItem
                    ? `${selectedRequest.stockItem.sku} | ${selectedRequest.stockItem.itemName}`
                    : "No stock item mapped"
                }
              />
            </DetailBlock>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
