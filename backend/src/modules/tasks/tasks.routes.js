import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  createTaskController,
  deleteTaskController,
  listMyTasksController,
  updateTaskController
} from "./tasks.controller.js";

export const tasksRouter = Router();

tasksRouter.use(authenticate);
tasksRouter.get("/my", listMyTasksController);
tasksRouter.post("/", createTaskController);
tasksRouter.put("/:id", updateTaskController);
tasksRouter.delete("/:id", deleteTaskController);
