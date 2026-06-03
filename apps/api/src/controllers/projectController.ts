import type { NextFunction, Request, Response } from "express";
import { createQueuedProject } from "../services/project/projectCommandService.js";
import { getProjectDetail, listProjectsWithThumbnails } from "../services/project/projectQueryService.js";
import { createProjectSchema } from "../validators/projectSchemas.js";

// Controller katmanı sadece HTTP istek/cevap çevirisi yapar; iş kuralları servislerde kalır, mimari daha temiz olur.
export async function createProject(request: Request, response: Response, next: NextFunction) {
  try {
    const body = createProjectSchema.parse(request.body);
    const project = await createQueuedProject(body);
    response.status(201).json(project);
  } catch (error) {
    next(error);
  }
}

export async function listProjects(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json(await listProjectsWithThumbnails());
  } catch (error) {
    next(error);
  }
}

export async function getProject(request: Request, response: Response, next: NextFunction) {
  try {
    const detail = await getProjectDetail(String(request.params.id));
    if (!detail.project) {
      response.status(404).json({ message: "Project not found" });
      return;
    }
    response.json(detail);
  } catch (error) {
    next(error);
  }
}
