import { useEffect, useId, useState } from "react";
import { apiClient } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  DEPARTMENT_OPTIONS,
  LOCATION_OPTIONS,
  TRANSPORT_REQUEST_TYPE_OPTIONS,
  TRANSPORT_VEHICLE_OPTIONS,
  getAllowedCategories,
  getCategoryInventory,
  isTransportationCategory
} from "./employeeRequisitionFormData.js";

function getDefaultRequestDate() {
  return new Date().toISOString().slice(0, 10);
}

function createBlankInventoryRow() {
  return {
    kind: "inventory",
    itemName: "",
    itemType: "",
    itemId: "",
    quantity: "1",
    itemDescription: ""
  };
}

function createBlankTransportRow() {
  return {
    kind: "transport",
    transportRequestType: "",
    vehicleType: "",
    transportDate: "",
    departureTime: "",
    pickupLocation: "",
    dropoffLocation: "",
    goodsDescription: "",
    goodsQuantity: "",
    purpose: "",
    returnDate: "",
    destination: "",
    duration: "",
    passengers: "",
    returnTime: ""
  };
}

function createRowForCategory(category) {
  return isTransportationCategory(category)
    ? createBlankTransportRow()
    : createBlankInventoryRow();
}

function createInitialFormState(user, preferredManagerEmail = "") {
  const department = user?.department ?? "";
  const initialCategory = getAllowedCategories(department)[0] ?? "Stationary";

  return {
    requesterName: user?.fullName ?? "",
    department,
    location: "",
    requestDate: getDefaultRequestDate(),
    lineManagerEmail: preferredManagerEmail,
    ccEmails: [],
    selectedCategory: initialCategory,
    items: [createRowForCategory(initialCategory)]
  };
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function truncateText(value, maxLength) {
  const normalized = String(value ?? "").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
}

function isPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
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

function getPreferredManagerEmail(user, managers) {
  if (!user?.managerId) {
    return "";
  }

  return managers.find((manager) => manager.id === user.managerId)?.email ?? "";
}

function validateInventoryRow(row) {
  return Boolean(
    row.itemName.trim() &&
      row.itemType.trim() &&
      row.itemId.trim() &&
      isPositiveNumber(row.quantity)
  );
}

function validateTransportRow(row) {
  if (
    !TRANSPORT_REQUEST_TYPE_OPTIONS.includes(row.transportRequestType.trim()) ||
    !TRANSPORT_VEHICLE_OPTIONS.includes(row.vehicleType.trim())
  ) {
    return false;
  }

  if (row.transportRequestType === "Goods Transport") {
    return Boolean(
      row.transportDate &&
        row.departureTime &&
        row.pickupLocation.trim() &&
        row.dropoffLocation.trim() &&
        row.goodsDescription.trim() &&
        row.goodsQuantity.trim() &&
        row.purpose.trim()
    );
  }

  if (row.transportRequestType === "Travel Request") {
    return Boolean(
      row.transportDate &&
        row.returnDate &&
        row.destination.trim() &&
        row.departureTime &&
        row.duration.trim() &&
        isPositiveNumber(row.passengers) &&
        row.purpose.trim()
    );
  }

  if (row.transportRequestType === "Local Visit / Meeting Transport") {
    return Boolean(
      row.transportDate &&
        row.destination.trim() &&
        row.departureTime &&
        row.returnTime &&
        isPositiveNumber(row.passengers) &&
        row.purpose.trim()
    );
  }

  return false;
}

function buildInventoryPayloadItem(row, category) {
  return {
    description: truncateText(row.itemName, 160),
    specification: truncateText(
      [
        `Category: ${category}`,
        `Type: ${row.itemType}`,
        `Item ID: ${row.itemId}`,
        row.itemDescription ? `Notes: ${row.itemDescription}` : ""
      ]
        .filter(Boolean)
        .join(" | "),
      255
    ),
    quantity: Number(row.quantity),
    unit: "pcs",
    estimatedUnitCost: ""
  };
}

function buildTransportPayloadItem(row) {
  const description = truncateText(
    `${row.transportRequestType} - ${row.destination || row.dropoffLocation || row.vehicleType}`,
    160
  );

  return {
    description,
    specification: truncateText(
      [
        `Vehicle: ${row.vehicleType}`,
        `Date: ${row.transportDate}`,
        row.departureTime ? `Departure: ${row.departureTime}` : "",
        row.returnDate ? `Return date: ${row.returnDate}` : "",
        row.returnTime ? `Return time: ${row.returnTime}` : "",
        row.pickupLocation ? `Pickup: ${row.pickupLocation}` : "",
        row.dropoffLocation ? `Drop-off: ${row.dropoffLocation}` : "",
        row.destination ? `Destination: ${row.destination}` : "",
        row.goodsDescription ? `Goods: ${row.goodsDescription}` : "",
        row.goodsQuantity ? `Goods quantity: ${row.goodsQuantity}` : "",
        row.duration ? `Duration: ${row.duration}` : "",
        row.passengers ? `Passengers: ${row.passengers}` : "",
        `Purpose: ${row.purpose}`
      ]
        .filter(Boolean)
        .join(" | "),
      255
    ),
    quantity: row.passengers && isPositiveNumber(row.passengers) ? Number(row.passengers) : 1,
    unit: "request",
    estimatedUnitCost: ""
  };
}

function buildRequisitionPayload(formValues) {
  const validRows = formValues.items.filter((row) =>
    isTransportationCategory(formValues.selectedCategory)
      ? validateTransportRow(row)
      : validateInventoryRow(row)
  );

  return {
    title: truncateText(
      `${formValues.selectedCategory} requisition for ${formValues.department || "team"}`,
      150
    ),
    justification: truncateText(
      [
        `Requester: ${formValues.requesterName || "Unknown"}`,
        `Department: ${formValues.department || "Not provided"}`,
        `Location: ${formValues.location || "Not provided"}`,
        `Request date: ${formValues.requestDate || "Not provided"}`,
        `Line manager email: ${formValues.lineManagerEmail || "Not provided"}`,
        formValues.ccEmails.length ? `CC: ${formValues.ccEmails.join(", ")}` : "",
        `Category: ${formValues.selectedCategory}`,
        "Submitted through the employee custom requisition form."
      ]
        .filter(Boolean)
        .join(" | "),
      2000
    ),
    neededByDate: formValues.requestDate || null,
    items: validRows.map((row) =>
      isTransportationCategory(formValues.selectedCategory)
        ? buildTransportPayloadItem(row)
        : buildInventoryPayloadItem(row, formValues.selectedCategory)
    )
  };
}

export function EmployeeRequisitionWorkspace({ token }) {
  const { user } = useAuth();
  const datalistBaseId = useId().replaceAll(":", "");

  const [formValues, setFormValues] = useState(() => createInitialFormState(user));
  const [activeStep, setActiveStep] = useState("details");
  const [detailsError, setDetailsError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingManagers, setIsLoadingManagers] = useState(true);
  const [managerOptions, setManagerOptions] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState(null);
  const [selectedRequisition, setSelectedRequisition] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadManagers() {
      setIsLoadingManagers(true);

      try {
        const response = await apiClient.listManagers(token);

        if (ignore) {
          return;
        }

        setManagerOptions(response.managers);
      } catch (_error) {
        if (!ignore) {
          setManagerOptions([]);
        }
      } finally {
        if (!ignore) {
          setIsLoadingManagers(false);
        }
      }
    }

    loadManagers();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    const preferredManagerEmail = getPreferredManagerEmail(user, managerOptions);

    setFormValues((current) => {
      const nextDepartment = current.department || user?.department || "";
      const allowedCategories = getAllowedCategories(nextDepartment);
      const nextCategory = allowedCategories.includes(current.selectedCategory)
        ? current.selectedCategory
        : (allowedCategories[0] ?? "Stationary");
      const nextItems =
        nextCategory === current.selectedCategory
          ? current.items
          : [createRowForCategory(nextCategory)];

      return {
        ...current,
        requesterName: current.requesterName || user?.fullName || "",
        department: nextDepartment,
        lineManagerEmail: current.lineManagerEmail || preferredManagerEmail,
        selectedCategory: nextCategory,
        items: nextItems
      };
    });
  }, [managerOptions, user]);

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

  const departmentOptions = uniqueValues([...DEPARTMENT_OPTIONS, formValues.department]);
  const lineManagerOptions = uniqueValues([
    ...managerOptions.map((manager) => manager.email),
    formValues.lineManagerEmail
  ]);
  const allowedCategories = getAllowedCategories(formValues.department);
  const categoryInventory = getCategoryInventory(formValues.selectedCategory);
  const itemOptions = Object.keys(categoryInventory);
  const itemsStepDescription = isTransportationCategory(formValues.selectedCategory)
    ? "Choose the correct transport request type based on your purpose. Please submit transportation requests at least 2 days in advance."
    : "Choose a category first, then select an item. Only the categories allowed for the selected department will appear, and the type list will update based on the item you choose.";

  function updateTopLevelField(field, value) {
    setFormValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleDepartmentChange(value) {
    setFormValues((current) => {
      const nextAllowedCategories = getAllowedCategories(value);
      const nextCategory = nextAllowedCategories.includes(current.selectedCategory)
        ? current.selectedCategory
        : (nextAllowedCategories[0] ?? "Stationary");

      return {
        ...current,
        department: value,
        selectedCategory: nextCategory,
        items:
          nextCategory === current.selectedCategory
            ? current.items
            : [createRowForCategory(nextCategory)]
      };
    });
  }

  function updateCcEmail(index, value) {
    setFormValues((current) => ({
      ...current,
      ccEmails: current.ccEmails.map((email, emailIndex) =>
        emailIndex === index ? value : email
      )
    }));
  }

  function addCcEmail() {
    setFormValues((current) => ({
      ...current,
      ccEmails: [...current.ccEmails, ""]
    }));
  }

  function removeCcEmail(index) {
    setFormValues((current) => ({
      ...current,
      ccEmails: current.ccEmails.filter((_, emailIndex) => emailIndex !== index)
    }));
  }

  function setCategory(category) {
    setFormError("");
    setFormValues((current) => ({
      ...current,
      selectedCategory: category,
      items: [createRowForCategory(category)]
    }));
  }

  function addItemRow() {
    setFormValues((current) => ({
      ...current,
      items: [...current.items, createRowForCategory(current.selectedCategory)]
    }));
  }

  function removeItemRow(index) {
    setFormValues((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function updateInventoryRow(index, field, value) {
    setFormValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === "itemName") {
          return {
            ...item,
            itemName: value,
            itemType: "",
            itemId: ""
          };
        }

        if (field === "itemType") {
          return {
            ...item,
            itemType: value,
            itemId: categoryInventory[item.itemName]?.[value] ?? ""
          };
        }

        return {
          ...item,
          [field]: value
        };
      })
    }));
  }

  function updateTransportRow(index, field, value) {
    setFormValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  }

  function goToItemsStep() {
    setDetailsError("");

    if (!formValues.department.trim()) {
      setDetailsError("Please select a department.");
      return;
    }

    if (!formValues.location.trim()) {
      setDetailsError("Please select a location.");
      return;
    }

    if (!isValidEmail(formValues.lineManagerEmail)) {
      setDetailsError("Please enter a valid line manager email address.");
      return;
    }

    const invalidCcEmail = formValues.ccEmails.find(
      (email) => email.trim() && !isValidEmail(email)
    );

    if (invalidCcEmail) {
      setDetailsError("Please correct the CC email addresses before continuing.");
      return;
    }

    setActiveStep("items");
  }

  function resetCustomForm() {
    const preferredManagerEmail = getPreferredManagerEmail(user, managerOptions);
    setFormValues(createInitialFormState(user, preferredManagerEmail));
    setDetailsError("");
    setFormError("");
    setSuccessMessage("");
    setActiveStep("details");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    const hasIncompleteRows = formValues.items.some((row) =>
      isTransportationCategory(formValues.selectedCategory)
        ? !validateTransportRow(row)
        : !validateInventoryRow(row)
    );

    if (hasIncompleteRows) {
      setFormError("Complete or remove any unfinished rows before submitting the request.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.createRequisition(
        token,
        buildRequisitionPayload(formValues)
      );
      const created = response.requisition;

      setSuccessMessage(`Requisition ${created.requisitionNumber} submitted successfully.`);
      setRequisitions((current) => [
        buildRequisitionSummary(created),
        ...current.filter((requisition) => requisition.id !== created.id)
      ]);
      setSelectedRequisition(created);
      setSelectedRequisitionId(created.id);
      setActiveStep("success");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid two-column requisition-grid">
      <article className="card">
        <div className="employee-request-shell">
          <div className="employee-request-logo">
            <img src="/assets/shehersaaz-logo.png" alt="Organization logo" />
          </div>

          {activeStep === "details" ? (
            <div className="employee-request-panel">
              <div className="employee-request-panel-header">
                <h2>Requester Details</h2>
                <p className="lead">
                  Start with your requester information, routing details, and request
                  context.
                </p>
              </div>

              <div className="employee-form-grid">
                <div className="employee-form-row">
                  <label className="employee-form-group">
                    <span>Requested by</span>
                    <input
                      type="text"
                      value={formValues.requesterName}
                      readOnly
                      placeholder="Enter your name"
                    />
                  </label>

                  <label className="employee-form-group">
                    <span>Department</span>
                    <select
                      value={formValues.department}
                      onChange={(event) => handleDepartmentChange(event.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select Department
                      </option>
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="employee-form-row">
                  <label className="employee-form-group">
                    <span>Location</span>
                    <select
                      value={formValues.location}
                      onChange={(event) => updateTopLevelField("location", event.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select Location
                      </option>
                      {LOCATION_OPTIONS.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="employee-form-group">
                    <span>Request Date</span>
                    <input
                      type="date"
                      value={formValues.requestDate}
                      onChange={(event) => updateTopLevelField("requestDate", event.target.value)}
                    />
                  </label>
                </div>

                <div className="employee-form-row employee-form-row-single">
                  <label className="employee-form-group">
                    <span>Line Manager's Email</span>
                    <select
                      value={formValues.lineManagerEmail}
                      onChange={(event) =>
                        updateTopLevelField("lineManagerEmail", event.target.value)
                      }
                      required
                    >
                      <option value="" disabled>
                        Select line manager email
                      </option>
                      {lineManagerOptions.map((email) => (
                        <option key={email} value={email}>
                          {email}
                        </option>
                      ))}
                    </select>
                    <small className="employee-form-helper">
                      The current backend still routes to the assigned manager in IMS. This
                      email is captured with the request summary.
                    </small>
                  </label>
                </div>

                <div className="employee-form-row employee-form-row-single">
                  <div className="employee-form-group">
                    <span>CC Emails</span>

                    <div className="employee-cc-list">
                      {formValues.ccEmails.map((email, index) => (
                        <div key={`cc-${index + 1}`} className="employee-cc-row">
                          <input
                            type="email"
                            value={email}
                            onChange={(event) => updateCcEmail(index, event.target.value)}
                            placeholder="Enter CC email"
                          />
                          <button
                            type="button"
                            className="employee-remove-button"
                            onClick={() => removeCcEmail(index)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="employee-add-button employee-add-cc-button"
                      onClick={addCcEmail}
                    >
                      + Add CC
                    </button>
                    <small className="employee-form-helper">
                      CC emails are stored in the submitted request notes for now.
                    </small>
                  </div>
                </div>
              </div>

              {detailsError ? <p className="form-error">{detailsError}</p> : null}

              <div className="employee-request-actions">
                <button type="button" className="employee-primary-button" onClick={goToItemsStep}>
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {activeStep === "items" ? (
            <form className="employee-request-panel" onSubmit={handleSubmit}>
              <div className="employee-request-panel-header">
                <h2>Items Requested</h2>
                <p className="employee-form-description">{itemsStepDescription}</p>
              </div>

              <div className="employee-category-toolbar">
                {allowedCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={
                      category === formValues.selectedCategory
                        ? "employee-category-button active"
                        : "employee-category-button"
                    }
                    onClick={() => setCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="employee-item-stack">
                {formValues.items.map((item, index) => {
                  const typeOptions = Object.keys(categoryInventory[item.itemName] ?? {});

                  return isTransportationCategory(formValues.selectedCategory) ? (
                    <div key={`transport-${index + 1}`} className="employee-item-row transport">
                      <div className="employee-transport-title">Transport Request Type</div>
                      <div className="employee-transport-hint">
                        Choose the request type first so the right fields appear below.
                      </div>

                      <input
                        type="text"
                        value={item.transportRequestType}
                        onChange={(event) =>
                          updateTransportRow(
                            index,
                            "transportRequestType",
                            event.target.value
                          )
                        }
                        placeholder="Select Transport Request Type"
                        list={`${datalistBaseId}-transport-request-type-options`}
                        autoComplete="off"
                      />

                      <input
                        type="text"
                        value={item.vehicleType}
                        onChange={(event) =>
                          updateTransportRow(index, "vehicleType", event.target.value)
                        }
                        placeholder="Select Vehicle Type"
                        list={`${datalistBaseId}-transport-vehicle-options`}
                        autoComplete="off"
                      />

                      {item.transportRequestType === "Goods Transport" ? (
                        <div className="employee-transport-fields">
                          <div className="employee-transport-section-title">
                            Goods Transport Details
                          </div>
                          <div className="employee-transport-hint">
                            Use this for moving materials, stock, or equipment between
                            locations.
                          </div>
                          <input
                            type="date"
                            value={item.transportDate}
                            onChange={(event) =>
                              updateTransportRow(index, "transportDate", event.target.value)
                            }
                          />
                          <input
                            type="time"
                            value={item.departureTime}
                            onChange={(event) =>
                              updateTransportRow(index, "departureTime", event.target.value)
                            }
                          />
                          <input
                            type="text"
                            value={item.pickupLocation}
                            onChange={(event) =>
                              updateTransportRow(index, "pickupLocation", event.target.value)
                            }
                            placeholder="Pickup Location"
                          />
                          <input
                            type="text"
                            value={item.dropoffLocation}
                            onChange={(event) =>
                              updateTransportRow(index, "dropoffLocation", event.target.value)
                            }
                            placeholder="Drop-off Location"
                          />
                          <input
                            type="text"
                            value={item.goodsDescription}
                            onChange={(event) =>
                              updateTransportRow(index, "goodsDescription", event.target.value)
                            }
                            placeholder="Goods / Items Description"
                          />
                          <input
                            type="text"
                            value={item.goodsQuantity}
                            onChange={(event) =>
                              updateTransportRow(index, "goodsQuantity", event.target.value)
                            }
                            placeholder="Quantity / Weight / Size"
                          />
                          <textarea
                            value={item.purpose}
                            onChange={(event) =>
                              updateTransportRow(index, "purpose", event.target.value)
                            }
                            placeholder="Purpose / Notes"
                            rows={2}
                          />
                        </div>
                      ) : null}

                      {item.transportRequestType === "Travel Request" ? (
                        <div className="employee-transport-fields">
                          <div className="employee-transport-section-title">
                            Travel Request Details
                          </div>
                          <div className="employee-transport-hint">
                            Use this for official inter-city or longer planned duty travel.
                          </div>
                          <input
                            type="date"
                            value={item.transportDate}
                            onChange={(event) =>
                              updateTransportRow(index, "transportDate", event.target.value)
                            }
                          />
                          <input
                            type="time"
                            value={item.departureTime}
                            onChange={(event) =>
                              updateTransportRow(index, "departureTime", event.target.value)
                            }
                          />
                          <input
                            type="date"
                            value={item.returnDate}
                            onChange={(event) =>
                              updateTransportRow(index, "returnDate", event.target.value)
                            }
                          />
                          <input
                            type="text"
                            value={item.destination}
                            onChange={(event) =>
                              updateTransportRow(index, "destination", event.target.value)
                            }
                            placeholder="Destination City / Area"
                          />
                          <input
                            type="text"
                            value={item.duration}
                            onChange={(event) =>
                              updateTransportRow(index, "duration", event.target.value)
                            }
                            placeholder="Trip Duration"
                          />
                          <input
                            type="number"
                            min="1"
                            value={item.passengers}
                            onChange={(event) =>
                              updateTransportRow(index, "passengers", event.target.value)
                            }
                            placeholder="No. of Travelers"
                          />
                          <textarea
                            value={item.purpose}
                            onChange={(event) =>
                              updateTransportRow(index, "purpose", event.target.value)
                            }
                            placeholder="Purpose / Notes"
                            rows={2}
                          />
                        </div>
                      ) : null}

                      {item.transportRequestType ===
                      "Local Visit / Meeting Transport" ? (
                        <div className="employee-transport-fields">
                          <div className="employee-transport-section-title">
                            Local Visit / Meeting Details
                          </div>
                          <div className="employee-transport-hint">
                            Use this for same-day city visits, meetings, errands, and short
                            official movements.
                          </div>
                          <input
                            type="date"
                            value={item.transportDate}
                            onChange={(event) =>
                              updateTransportRow(index, "transportDate", event.target.value)
                            }
                          />
                          <input
                            type="time"
                            value={item.departureTime}
                            onChange={(event) =>
                              updateTransportRow(index, "departureTime", event.target.value)
                            }
                          />
                          <input
                            type="time"
                            value={item.returnTime}
                            onChange={(event) =>
                              updateTransportRow(index, "returnTime", event.target.value)
                            }
                          />
                          <input
                            type="text"
                            value={item.destination}
                            onChange={(event) =>
                              updateTransportRow(index, "destination", event.target.value)
                            }
                            placeholder="Meeting / Visit Location"
                          />
                          <input
                            type="text"
                            value={item.duration}
                            onChange={(event) =>
                              updateTransportRow(index, "duration", event.target.value)
                            }
                            placeholder="Expected Duration"
                          />
                          <input
                            type="number"
                            min="1"
                            value={item.passengers}
                            onChange={(event) =>
                              updateTransportRow(index, "passengers", event.target.value)
                            }
                            placeholder="No. of Passengers"
                          />
                          <textarea
                            value={item.purpose}
                            onChange={(event) =>
                              updateTransportRow(index, "purpose", event.target.value)
                            }
                            placeholder="Purpose / Notes"
                            rows={2}
                          />
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className="employee-remove-button"
                        onClick={() => removeItemRow(index)}
                        disabled={formValues.items.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div key={`item-${index + 1}`} className="employee-item-row">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(event) =>
                          updateInventoryRow(index, "itemName", event.target.value)
                        }
                        placeholder="Select Item"
                        list={`${datalistBaseId}-item-options`}
                        autoComplete="off"
                      />
                      <input
                        type="text"
                        value={item.itemType}
                        onChange={(event) =>
                          updateInventoryRow(index, "itemType", event.target.value)
                        }
                        placeholder="Select Type"
                        list={`${datalistBaseId}-item-type-options-${index}`}
                        autoComplete="off"
                      />
                      <input
                        type="text"
                        value={item.itemId}
                        readOnly
                        placeholder="Item ID"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateInventoryRow(index, "quantity", event.target.value)
                        }
                        placeholder="Qty"
                      />
                      <textarea
                        className="employee-item-description"
                        value={item.itemDescription}
                        onChange={(event) =>
                          updateInventoryRow(index, "itemDescription", event.target.value)
                        }
                        placeholder="Add item description or notes"
                        maxLength={100}
                        rows={2}
                      />
                      <button
                        type="button"
                        className="employee-remove-button"
                        onClick={() => removeItemRow(index)}
                        disabled={formValues.items.length === 1}
                      >
                        Remove
                      </button>

                      <datalist id={`${datalistBaseId}-item-type-options-${index}`}>
                        {typeOptions.map((typeOption) => (
                          <option key={typeOption} value={typeOption} />
                        ))}
                      </datalist>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="employee-add-button"
                onClick={addItemRow}
              >
                {isTransportationCategory(formValues.selectedCategory)
                  ? "+ Add Transport Request"
                  : "+ Add Item"}
              </button>

              {formError ? <p className="form-error">{formError}</p> : null}

              <div className="employee-request-actions">
                <button
                  type="button"
                  className="employee-secondary-button"
                  onClick={() => setActiveStep("details")}
                >
                  Back
                </button>
                <button type="submit" className="employee-primary-button" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          ) : null}

          {activeStep === "success" ? (
            <div className="employee-request-panel employee-request-success">
              <div className="employee-request-panel-header">
                <h2>Request Submitted</h2>
                <p className="employee-form-description">
                  Your request has been submitted successfully.
                </p>
              </div>

              {successMessage ? <p className="form-success">{successMessage}</p> : null}

              <div className="employee-request-actions">
                <button
                  type="button"
                  className="employee-primary-button"
                  onClick={resetCustomForm}
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : null}

          <div className="employee-request-skyline" aria-hidden="true" />
        </div>

        <datalist id={`${datalistBaseId}-transport-vehicle-options`}>
          {TRANSPORT_VEHICLE_OPTIONS.map((vehicle) => (
            <option key={vehicle} value={vehicle} />
          ))}
        </datalist>

        <datalist id={`${datalistBaseId}-transport-request-type-options`}>
          {TRANSPORT_REQUEST_TYPE_OPTIONS.map((requestType) => (
            <option key={requestType} value={requestType} />
          ))}
        </datalist>

        <datalist id={`${datalistBaseId}-item-options`}>
          {itemOptions.map((itemName) => (
            <option key={itemName} value={itemName} />
          ))}
        </datalist>

        {isLoadingManagers ? (
          <p className="helper-text employee-manager-loading">
            Loading manager suggestions...
          </p>
        ) : null}
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
