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

export function parseReceivePurchaseOrderPayload(payload) {
  const deliveryNoteNumberValue = String(payload.deliveryNoteNumber ?? "").trim();
  const remarks = String(payload.remarks ?? "").trim();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];

  if (!remarks || remarks.length < 3 || remarks.length > 500) {
    throw new ApiError(400, "Receiving remarks must be between 3 and 500 characters long.");
  }

  if (!lines.length) {
    throw new ApiError(400, "At least one receipt line is required.");
  }

  return {
    deliveryNoteNumber: deliveryNoteNumberValue
      ? deliveryNoteNumberValue.slice(0, 60)
      : null,
    remarks,
    lines: lines.map((line, index) => ({
      purchaseOrderLineId: parsePositiveInteger(
        line.purchaseOrderLineId,
        `Line ${index + 1} purchase order line id`
      ),
      stockItemId: parsePositiveInteger(line.stockItemId, `Line ${index + 1} stock item id`),
      quantityReceived: parsePositiveNumber(
        line.quantityReceived,
        `Line ${index + 1} quantity received`
      )
    }))
  };
}
