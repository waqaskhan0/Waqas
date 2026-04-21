import { ApiError } from "../../utils/apiError.js";

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function parsePositiveNumber(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be greater than zero.`);
  }

  return Number(parsed.toFixed(2));
}

export function parseCreatePurchaseOrderPayload(payload) {
  const vendorId = parsePositiveInteger(payload.vendorId, "Vendor id");
  const notes = String(payload.notes ?? "").trim();
  const expectedDeliveryDateValue = String(payload.expectedDeliveryDate ?? "").trim();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];

  if (!lines.length) {
    throw new ApiError(400, "At least one purchase order line is required.");
  }

  let expectedDeliveryDate = null;
  if (expectedDeliveryDateValue) {
    const parsedDate = new Date(`${expectedDeliveryDateValue}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiError(400, "Expected delivery date must be a valid date.");
    }

    expectedDeliveryDate = expectedDeliveryDateValue;
  }

  return {
    vendorId,
    notes: notes ? notes.slice(0, 500) : null,
    expectedDeliveryDate,
    lines: lines.map((line, index) => ({
      requisitionItemId: parsePositiveInteger(
        line.requisitionItemId,
        `Line ${index + 1} requisition item id`
      ),
      quantityOrdered: parsePositiveNumber(
        line.quantityOrdered,
        `Line ${index + 1} quantity ordered`
      ),
      unitPrice: parsePositiveNumber(
        line.unitPrice,
        `Line ${index + 1} unit price`
      )
    }))
  };
}
