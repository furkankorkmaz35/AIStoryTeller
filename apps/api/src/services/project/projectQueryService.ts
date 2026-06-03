import { AssetModel } from "../../models/asset.js";
import { JobEventModel } from "../../models/jobEvent.js";
import { ProjectModel } from "../../models/project.js";
import { SceneModel } from "../../models/scene.js";

export async function listProjectsWithThumbnails() {
  const projects = await ProjectModel.find().sort({ createdAt: -1 }).limit(50).lean();
  const projectIds = projects.map((project) => project._id);
  // Galeri kartı için tüm proje detayını yüklemeye gerek yok; ilk sahneden hafif bir thumbnail yeterlidir.
  const firstScenes = await SceneModel.find({ projectId: { $in: projectIds }, order: 1, imagePath: { $ne: "" } })
    .select("projectId imagePath")
    .lean();
  const thumbnails = new Map(firstScenes.map((scene) => [String(scene.projectId), scene.imagePath]));
  return projects.map((project) => ({ ...project, thumbnailPath: project.thumbnailPath || thumbnails.get(String(project._id)) || "" }));
}

export async function getProjectDetail(id: string) {
  // Detay ekranı üretim kanıt zincirini gösterir: proje kaydı, sahneler, medya assetleri ve pipeline logları.
  const [project, scenes, assets, events] = await Promise.all([
    ProjectModel.findById(id),
    SceneModel.find({ projectId: id }).sort({ order: 1 }),
    AssetModel.find({ projectId: id }).sort({ createdAt: 1 }),
    JobEventModel.find({ projectId: id }).sort({ createdAt: 1 })
  ]);
  return { project, scenes, assets, events };
}
