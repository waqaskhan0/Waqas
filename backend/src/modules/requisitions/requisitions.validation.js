import { ApiError } from "../../utils/apiError.js";

function normalizeOptionalString(value, maxLength) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new ApiError(400, `Text must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function parsePositiveNumber(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be greater than zero.`);
  }

  return Number(parsed.toFixed(2));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function parseRequestContext(payload) {
  const context = payload.requestContext ?? {};
  const requesterName = String(context.requesterName ?? "").trim();
  const department = String(context.department ?? "").trim();
  const location = String(context.location ?? "").trim();
  const requestDate = String(context.requestDate ?? "").trim();
  const lineManagerEmail = String(context.lineManagerEmail ?? "").trim();
  const selectedCategory = String(context.selectedCategory ?? "").trim();
  const ccEmails = Array.isArray(context.ccEmails) ? context.ccEmails : [];

  if (!requesterName || requesterName.length > 120) {
    throw new ApiError(400, "Requester name is required and must be 120 characters or fewer.");
  }

  if (!department || department.length > 80) {
    throw new ApiError(400, "Department is required and must be 80 characters or fewer.");
  }

  if (!location || location.length > 80) {
    throw new ApiError(400, "Location is required and must be 80 characters or fewer.");
  }

  if (!lineManagerEmail || !isValidEmail(lineManagerEmail)) {
    throw new ApiError(400, "A valid line manager email is required.");
  }

  const parsedCcEmails = ccEmails
    .map((email) => String(email ?? "").trim())
    .filter(Boolean);

  if (parsedCcEmails.some((email) => !isValidEmail(email))) {
    throw new ApiError(400, "CC emails must be valid email addresses.");
  }

  if (parsedCcEmails.length > 10) {
    throw new ApiError(400, "A requisition can include up to 10 CC emails.");
  }

  if (!selectedCategory || selectedCategory.length > 80) {
    throw new ApiError(400, "A request category is required.");
  }

  let normalizedRequestDate = null;
  if (requestDate) {
    const parsedDate = new Date(`${requestDate}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiError(400, "Request date must be a valid date.");
    }

    normalizedRequestDate = requestDate;
  }

  return {
    requesterName,
    department,
    location,
    requestDate: normalizedRequestDate,
    lineManagerEmail,
    ccEmails: parsedCcEmails,
    selectedCategory
  };
}

export function parseCreateRequisitionPayload(payload) {
  const title = String(payload.title ?? "").trim();
  const justification = String(payload.justification ?? "").trim();
  const neededByDateValue = String(payload.neededByDate ?? "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!title || title.length < 3 || title.length > 150) {
    throw new ApiError(400, "Title must be between 3 and 150 characters long.");
  }

  if (!justification || justification.length < 10 || justification.length > 2000) {
    throw new ApiError(400, "Justification must be between 10 and 2000 characters long.");
  }

  let neededByDate = null;
  if (neededByDateValue) {
    const parsedDate = new Date(`${neededByDateValue}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiError(400, "Needed-by date must be a valid date.");
    }

    neededByDate = neededByDateValue;
  }

  if (!items.length) {
    throw new ApiError(400, "At least one requisition item is required.");
  }

  if (items.length > 25) {
    throw new ApiError(400, "A requisition can include up to 25 items.");
  }

  return {
    title,
    justification,
    neededByDate,
    items: items.map((item, index) => {
      const description = String(item.description ?? "").trim();
      const unit = String(item.unit ?? "").trim();

      if (!description || description.length < 3 || description.length > 160) {
        throw new ApiError(
          400,
          `Item ${index + 1} description must be between 3 and 160 characters long.`
        );
      }

      if (!unit || unit.length > 30) {
        throw new ApiError(
          400,
          `Item ${index + 1} unit is required and must be 30 characters or fewer.`
        );
      }

      const estimatedUnitCostValue = String(item.estimatedUnitCost ?? "").trim();

      return {
        description,
        specification: normalizeOptionalString(item.specification, 255),
        quantity: parsePositiveNumber(item.quantity, `Item ${index + 1} quantity`),
        unit,
        estimatedUnitCost: estimatedUnitCostValue
          ? parsePositiveNumber(
              estimatedUnitCostValue,
              `Item ${index + 1} estimated unit cost`
            )
          : null
      };
    })
  };
}

export function parseCreateDraftRequisitionPayload(payload) {
  return {
    ...parseCreateRequisitionPayload(payload),
    requestContext: parseRequestContext(payload)
  };
}

export function parseApprovalDecisionPayload(payload, actionLabel) {
  const remarks = String(payload.remarks ?? "").trim();

  if (!remarks || remarks.length < 3 || remarks.length > 500) {
    throw new ApiError(
      400,
      `${actionLabel} remarks must be between 3 and 500 characters long.`
    );
  }

  return { remarks };
}
