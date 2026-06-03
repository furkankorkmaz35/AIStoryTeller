import { Router } from "express";
import { createProject, getProject, listProjects } from "../controllers/projectController.js";

const router = Router();

// Proje API'si üç temel işi yapar: video üretimini başlatır, son işleri listeler ve seçilen işin detayını döner.
router.post("/", createProject);
router.get("/", listProjects);
router.get("/:id", getProject);

export { router as projectsRouter };
