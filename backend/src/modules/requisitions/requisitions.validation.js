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
