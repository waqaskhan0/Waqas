const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  "http://localhost:4000/api";

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      }
    });
  } catch (_error) {
    throw new Error(`Cannot reach IMS backend at ${API_BASE_URL}. Make sure the backend server is running.`);
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

export const apiClient = {
  login(credentials) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
  },
  getCurrentUser(token) {
    return request("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  logout(token) {
    return request("/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listManagers(token) {
    return request("/users/managers", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createRequisition(token, payload) {
    return request("/requisitions", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listMyRequisitions(token) {
    return request("/requisitions/my", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listManagerRequisitions(token) {
    return request("/requisitions/manager", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  getRequisitionById(token, requisitionId) {
    return request(`/requisitions/${requisitionId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  approveRequisition(token, requisitionId, payload) {
    return request(`/requisitions/${requisitionId}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  rejectRequisition(token, requisitionId, payload) {
    return request(`/requisitions/${requisitionId}/reject`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listMyNotifications(token) {
    return request("/notifications/my", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  markNotificationRead(token, notificationId) {
    return request(`/notifications/${notificationId}/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listInventoryQueue(token) {
    return request("/inventory/queue", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listInventoryStock(token) {
    return request("/inventory/stock", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  processInventoryDecision(token, requisitionId, payload) {
    return request(`/inventory/requisitions/${requisitionId}/process`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listProcurementQueue(token) {
    return request("/procurement/queue", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listVendors(token) {
    return request("/procurement/vendors", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createPurchaseOrder(token, requisitionId, payload) {
    return request(`/procurement/requisitions/${requisitionId}/purchase-orders`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listReceivingQueue(token) {
    return request("/receiving/queue", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  receivePurchaseOrder(token, purchaseOrderId, payload) {
    return request(`/receiving/purchase-orders/${purchaseOrderId}/receive`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  listFinanceQueue(token) {
    return request("/finance/queue", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createFinanceMatch(token, purchaseOrderId, payload) {
    return request(`/finance/purchase-orders/${purchaseOrderId}/match`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  getWorkspaceState(token) {
    return request("/dashboard/state", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createLeave(token, payload) {
    return request("/leave", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  decideLeaveAsManager(token, leaveId, payload) {
    return request(`/leave/${leaveId}/manager`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  decideLeaveAsHr(token, leaveId, payload) {
    return request(`/leave/${leaveId}/hr`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  signOutAttendance(token) {
    return request("/attendance/signout", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createTask(token, payload) {
    return request("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  updateTask(token, taskId, payload) {
    return request(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createAdvance(token, payload) {
    return request("/advance", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  decideAdvance(token, advanceId, payload) {
    return request(`/advance/${advanceId}/action`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createReimbursement(token, payload) {
    return request("/reimbursement", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  decideReimbursement(token, claimId, payload) {
    return request(`/reimbursement/${claimId}/action`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createAnnouncement(token, payload) {
    return request("/announcements", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createUser(token, payload) {
    return request("/users", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  deactivateUser(token, userId) {
    return request(`/users/${userId}/deactivate`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  activateUser(token, userId) {
    return request(`/users/${userId}/activate`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  releasePoPayment(token, purchaseOrderId, payload) {
    return request(`/finance/po/${purchaseOrderId}/pay`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  generatePayroll(token, payload) {
    return request("/finance/payroll/generate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }
};
