import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { createTask, deleteTask, listMyTasks, updateTask } from "./tasks.service.js";

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "A valid task id is required.");
  }

  return id;
}

export const listMyTasksController = asyncHandler(async (req, res) => {
  const tasks = await listMyTasks(req.user.id);
  res.json({ tasks });
});

export const createTaskController = asyncHandler(async (req, res) => {
  const task = await createTask(req.user.id, req.body);
  res.status(201).json({ task });
});

export const updateTaskController = asyncHandler(async (req, res) => {
  const task = await updateTask(req.user.id, parseId(req.params.id), req.body);
  res.json({ task });
});

export const deleteTaskController = asyncHandler(async (req, res) => {
  await deleteTask(req.user.id, parseId(req.params.id));
  res.status(204).send();
});
