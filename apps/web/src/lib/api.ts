const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export type ProjectStatus =
  | "queued"
  | "generating_story"
  | "generating_images"
  | "generating_audio"
  | "rendering_video"
  | "completed"
  | "failed";

export type Project = {
  _id: string;
  theme: string;
  title: string;
  story: string;
  style: string;
  ageGroup: string;
  sceneCount: number;
  status: ProjectStatus;
  errorMessage?: string;
  videoPath?: string;
  createdAt: string;
};

export type Scene = {
  _id: string;
  order: number;
  text: string;
  imagePrompt: string;
  imagePath: string;
  subtitle: string;
  status: string;
};

export type Asset = {
  _id: string;
  type: "image" | "audio" | "video";
  path: string;
  provider: string;
};

export type JobEvent = {
  _id: string;
  step: string;
  status: string;
  message: string;
  createdAt: string;
};

export type ProjectDetail = {
  project: Project;
  scenes: Scene[];
  assets: Asset[];
  events: JobEvent[];
};

export type SystemStatus = {
  ok: boolean;
  database: string;
  queue: Record<string, number>;
  providers: {
    ai: string;
    image: string;
    video: string;
  };
};

export function assetUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${apiBaseUrl}${path}`;
}

export async function createProject(payload: { theme: string; style: string; ageGroup: string; sceneCount: number }) {
  const response = await fetch(`${apiBaseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "Proje olusturulamadi.");
  }
  return (await response.json()) as Project;
}

export async function listProjects() {
  const response = await fetch(`${apiBaseUrl}/api/projects`);
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "Projeler alinamadi.");
  }
  return (await response.json()) as Project[];
}

export async function getProject(id: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${id}`);
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "Proje detayi alinamadi.");
  }
  return (await response.json()) as ProjectDetail;
}

export async function retryProject(id: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${id}/retry`, {
    method: "POST"
  });
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "Proje yeniden baslatilamadi.");
  }
  return (await response.json()) as Project;
}

export async function getSystemStatus() {
  const response = await fetch(`${apiBaseUrl}/api/system/status`);
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "Sistem durumu alinamadi.");
  }
  return (await response.json()) as SystemStatus;
}

async function safeError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message;
  } catch {
    return "";
  }
}
