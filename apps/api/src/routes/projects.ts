import { Router } from "express";
import { createProject, getProject, listProjects } from "../controllers/projectController.js";

const router = Router();

// Minimal project API: create a video job, list recent jobs, inspect one job in detail.
router.post("/", createProject);
router.get("/", listProjects);
router.get("/:id", getProject);

export { router as projectsRouter };
