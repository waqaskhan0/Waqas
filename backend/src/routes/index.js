import { Router } from "express";
import { ROLES } from "../config/roles.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { advanceRouter, reimbursementRouter } from "../modules/employeeFinance/employeeFinance.routes.js";
import { announcementsRouter } from "../modules/announcements/announcements.routes.js";
import { attendanceRouter } from "../modules/attendance/attendance.routes.js";
import { auditRouter, settingsRouter } from "../modules/admin/admin.routes.js";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import { financeRouter } from "../modules/finance/finance.routes.js";
import { inventoryRouter } from "../modules/inventory/inventory.routes.js";
import { leaveRouter } from "../modules/leave/leave.routes.js";
import { notificationsRouter } from "../modules/notifications/notifications.routes.js";
import {
  createVendorController,
  deactivateVendorController,
  listGoodsReceiptsController,
  listPurchaseOrdersController,
  listVendorsController,
  updatePurchaseOrderStatusController,
  updateVendorController
} from "../modules/procurement/procurement.controller.js";
import { procurementRouter } from "../modules/procurement/procurement.routes.js";
import { receivingRouter } from "../modules/receiving/receiving.routes.js";
import { requisitionsRouter } from "../modules/requisitions/requisitions.routes.js";
import { tasksRouter } from "../modules/tasks/tasks.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

export const apiRouter = Router();
const vendorAliasRouter = Router();
const purchaseOrderAliasRouter = Router();
const grnAliasRouter = Router();

vendorAliasRouter.use(authenticate, authorizeRoles(ROLES.PROCUREMENT_OFFICER, ROLES.SUPER_ADMIN));
vendorAliasRouter.get("/", listVendorsController);
vendorAliasRouter.post("/", createVendorController);
vendorAliasRouter.put("/:id", updateVendorController);
vendorAliasRouter.patch("/:id/deactivate", deactivateVendorController);

purchaseOrderAliasRouter.use(authenticate, authorizeRoles(ROLES.PROCUREMENT_OFFICER, ROLES.SUPER_ADMIN));
purchaseOrderAliasRouter.get("/", listPurchaseOrdersController);
purchaseOrderAliasRouter.patch("/:id/status", updatePurchaseOrderStatusController);

grnAliasRouter.use(authenticate, authorizeRoles(ROLES.PROCUREMENT_OFFICER, ROLES.SUPER_ADMIN));
grnAliasRouter.get("/", listGoodsReceiptsController);

apiRouter.use("/auth", authRouter);
apiRouter.use("/advance", advanceRouter);
apiRouter.use("/announcements", announcementsRouter);
apiRouter.use("/attendance", attendanceRouter);
apiRouter.use("/audit", auditRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/finance", financeRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/items", requisitionsRouter);
apiRouter.use("/leave", leaveRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/procurement", procurementRouter);
apiRouter.use("/po", purchaseOrderAliasRouter);
apiRouter.use("/receiving", receivingRouter);
apiRouter.use("/reimbursement", reimbursementRouter);
apiRouter.use("/requisitions", requisitionsRouter);
apiRouter.use("/grn", grnAliasRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/vendors", vendorAliasRouter);
