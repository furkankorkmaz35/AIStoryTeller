import { AssetModel } from "../../models/asset.js";
import { JobEventModel } from "../../models/jobEvent.js";
import { ProjectModel } from "../../models/project.js";
import { SceneModel } from "../../models/scene.js";

export async function listProjectsWithThumbnails() {
  const projects = await ProjectModel.find().sort({ createdAt: -1 }).limit(50).lean();
  const projectIds = projects.map((project) => project._id);
  // Gallery cards need one lightweight thumbnail without loading full project details.
  const firstScenes = await SceneModel.find({ projectId: { $in: projectIds }, order: 1, imagePath: { $ne: "" } })
    .select("projectId imagePath")
    .lean();
  const thumbnails = new Map(firstScenes.map((scene) => [String(scene.projectId), scene.imagePath]));
  return projects.map((project) => ({ ...project, thumbnailPath: project.thumbnailPath || thumbnails.get(String(project._id)) || "" }));
}

export async function getProjectDetail(id: string) {
  // Detail screen shows the full proof chain: project, scenes, assets and logs.
  const [project, scenes, assets, events] = await Promise.all([
    ProjectModel.findById(id),
    SceneModel.find({ projectId: id }).sort({ order: 1 }),
    AssetModel.find({ projectId: id }).sort({ createdAt: 1 }),
    JobEventModel.find({ projectId: id }).sort({ createdAt: 1 })
  ]);
  return { project, scenes, assets, events };
}
