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

export function parseCreateFinanceMatchPayload(payload) {
  const invoiceNumber = String(payload.invoiceNumber ?? "").trim();
  const invoiceDateValue = String(payload.invoiceDate ?? "").trim();
  const remarks = String(payload.remarks ?? "").trim();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];

  if (!invoiceNumber || invoiceNumber.length < 3 || invoiceNumber.length > 60) {
    throw new ApiError(400, "Invoice number must be between 3 and 60 characters long.");
  }

  if (!invoiceDateValue) {
    throw new ApiError(400, "Invoice date is required.");
  }

  const parsedInvoiceDate = new Date(`${invoiceDateValue}T00:00:00`);

  if (Number.isNaN(parsedInvoiceDate.getTime())) {
    throw new ApiError(400, "Invoice date must be valid.");
  }

  if (!remarks || remarks.length < 3 || remarks.length > 500) {
    throw new ApiError(400, "Finance remarks must be between 3 and 500 characters long.");
  }

  if (!lines.length) {
    throw new ApiError(400, "At least one invoice line is required.");
  }

  return {
    invoiceNumber,
    invoiceDate: invoiceDateValue,
    remarks,
    lines: lines.map((line, index) => ({
      purchaseOrderLineId: parsePositiveInteger(
        line.purchaseOrderLineId,
        `Line ${index + 1} purchase order line id`
      ),
      quantityBilled: parsePositiveNumber(
        line.quantityBilled,
        `Line ${index + 1} quantity billed`
      ),
      unitPrice: parsePositiveNumber(line.unitPrice, `Line ${index + 1} unit price`)
    }))
  };
}
