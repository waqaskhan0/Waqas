import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { financeRouter } from "../modules/finance/finance.routes.js";
import { inventoryRouter } from "../modules/inventory/inventory.routes.js";
import { notificationsRouter } from "../modules/notifications/notifications.routes.js";
import { procurementRouter } from "../modules/procurement/procurement.routes.js";
import { receivingRouter } from "../modules/receiving/receiving.routes.js";
import { requisitionsRouter } from "../modules/requisitions/requisitions.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/finance", financeRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/procurement", procurementRouter);
apiRouter.use("/receiving", receivingRouter);
apiRouter.use("/requisitions", requisitionsRouter);
apiRouter.use("/users", usersRouter);
