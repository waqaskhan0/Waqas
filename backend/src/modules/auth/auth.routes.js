import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { loginController, logoutController, meController } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", loginController);
authRouter.get("/me", authenticate, meController);
authRouter.post("/logout", authenticate, logoutController);
