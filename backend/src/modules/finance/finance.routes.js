import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createFinanceMatchController,
  listFinanceQueueController
} from "./finance.controller.js";

export const financeRouter = Router();

financeRouter.use(authenticate, authorizeRoles(ROLES.FINANCE));
financeRouter.get("/queue", listFinanceQueueController);
financeRouter.post("/purchase-orders/:id/match", createFinanceMatchController);
