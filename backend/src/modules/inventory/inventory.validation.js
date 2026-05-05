import { ApiError } from "../../utils/apiError.js";

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeNumber(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError(400, `${fieldName} must be zero or greater.`);
  }

  return Number(parsed.toFixed(2));
}

export function parseInventoryProcessingPayload(payload) {
  const remarks = String(payload.remarks ?? "").trim();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];

  if (!remarks || remarks.length < 3 || remarks.length > 500) {
    throw new ApiError(400, "Inventory remarks must be between 3 and 500 characters long.");
  }

  if (!lines.length) {
    throw new ApiError(400, "At least one inventory decision line is required.");
  }

  return {
    remarks,
    lines: lines.map((line, index) => {
      const requisitionItemId = parsePositiveInteger(
        line.requisitionItemId,
        `Line ${index + 1} requisition item id`
      );
      const quantityIssued = parseNonNegativeNumber(
        line.quantityIssued,
        `Line ${index + 1} issued quantity`
      );
      const stockItemIdValue = line.stockItemId;
      const stockItemId =
        stockItemIdValue === null ||
        stockItemIdValue === undefined ||
        String(stockItemIdValue).trim() === ""
          ? null
          : parsePositiveInteger(stockItemIdValue, `Line ${index + 1} stock item id`);

      return {
        requisitionItemId,
        stockItemId,
        quantityIssued
      };
    })
  };
}

function parseRequiredText(value, fieldName, maxLength) {
  const parsed = String(value ?? "").trim();

  if (!parsed) {
    throw new ApiError(400, `${fieldName} is required.`);
  }

  if (parsed.length > maxLength) {
    throw new ApiError(400, `${fieldName} must be ${maxLength} characters or less.`);
  }

  return parsed;
}

export function parseCreateStockItemPayload(payload) {
  const itemName = parseRequiredText(payload.itemName, "Item name", 160);
  const itemType = parseRequiredText(payload.itemType, "Type", 80);
  const itemCategory = parseRequiredText(payload.itemCategory, "Category", 40);
  const itemId = parseRequiredText(payload.itemId, "Item ID", 40);

  if (!["RWHU", "PROGRESSIVE", "Stationary"].includes(itemCategory)) {
    throw new ApiError(400, "Category must be RWHU, PROGRESSIVE, or Stationary.");
  }

  return {
    itemName,
    itemType,
    itemCategory,
    itemId,
    defaultLocation: String(payload.defaultLocation ?? "Main store").trim() || "Main store"
  };
}
