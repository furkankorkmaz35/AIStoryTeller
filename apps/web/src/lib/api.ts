const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export type ProjectStatus =
  | "queued"
  | "generating_story"
  | "generating_scenes"
  | "translating_variants"
  | "awaiting_import"
  | "generating_visuals"
  | "selecting_materials"
  | "generating_audio"
  | "generating_subtitles"
  | "selecting_bgm"
  | "rendering_video"
  | "preparing_export"
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
  sceneCountMode?: "auto" | "manual";
  aspectRatio: "9:16" | "16:9" | "1:1";
  targetPlatform: "tiktok" | "reels" | "shorts";
  creationMode?: "full-auto" | "studio-import";
  languages: string[];
  imageProvider: string;
  voiceProvider: string;
  elevenLabsVoiceId?: string;
  subtitlesEnabled?: boolean;
  materialMode: string;
  imageQuality: string;
  status: ProjectStatus;
  errorMessage?: string;
  thumbnailPath?: string;
  videoPath?: string;
  createdAt: string;
};

export type Scene = {
  _id: string;
  order: number;
  text: string;
  imagePrompt: string;
  visualPrompt: string;
  searchTerms: string[];
  imagePath: string;
  videoPath?: string;
  materialPath: string;
  materialType: string;
  materialProvider?: string;
  materialQualityScore?: number;
  materialQualityReason?: string;
  subtitle: string;
  status: string;
};

export type Asset = {
  _id: string;
  type: "image" | "stock-image" | "clip" | "audio" | "video" | "bgm" | "subtitle" | "export";
  path: string;
  provider: string;
  metadata?: Record<string, unknown>;
};

export type ProjectVariant = {
  _id: string;
  language: "tr" | "en" | "de" | "es";
  title: string;
  story: string;
  status: string;
  audioPath: string;
  videoPath: string;
  exportCaption: string;
  exportHashtags: string[];
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
  variants: ProjectVariant[];
};

export type SystemStatus = {
  ok: boolean;
  database: string;
  queue: Record<string, number>;
  providers: {
    ai: string;
    image: string;
    voice: string;
    video: string;
  };
};

export type ContentAccount = {
  _id: string;
  name: string;
  platform: "instagram" | "tiktok" | "youtube";
  platforms?: Array<"instagram" | "tiktok" | "youtube">;
  category?: string;
  concept: string;
  audience: string;
  tone: string;
  language: "tr" | "en" | "de" | "es";
  postingDays?: string[];
  postingHours: string[];
  autopilotMode: "manual" | "assistant" | "autopilot-safe" | "autopilot";
  status: "active" | "paused";
};

export type ContentIdea = {
  _id: string;
  accountId: string;
  source: string;
  trend: string;
  title: string;
  hook: string;
  theme: string;
  angle: string;
  score: number;
  scoreReason: string;
  status: "draft" | "approved" | "scheduled" | "producing" | "produced" | "rejected";
  scheduledFor?: string;
  projectId?: string;
  captionSeed: string;
  hashtags: string[];
};

export function assetUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${apiBaseUrl}${path}`;
}

export async function createProject(payload: {
  theme: string;
  style: string;
  ageGroup: string;
  sceneCount: number;
  sceneCountMode?: "auto" | "manual";
  aspectRatio: "9:16" | "16:9" | "1:1";
  targetPlatform: "tiktok" | "reels" | "shorts";
  creationMode?: "full-auto" | "studio-import";
  languages: string[];
  imageProvider: string;
  voiceProvider: string;
  elevenLabsVoiceId?: string;
  subtitlesEnabled: boolean;
  materialMode: string;
  imageQuality: string;
}) {
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

export async function regenerateScene(projectId: string, sceneId: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/scenes/${sceneId}/regenerate`, {
    method: "POST"
  });
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "Sahne yeniden üretilemedi.");
  }
  return (await response.json()) as Scene;
}

export async function importSceneVideo(projectId: string, sceneId: string, payload: { filename: string; mimeType: string; dataUrl: string }) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/scenes/${sceneId}/import-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "Dış video klibi içe aktarılamadı.");
  }
  return (await response.json()) as Scene;
}

export async function continueImportedProject(projectId: string) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/continue-import`, {
    method: "POST"
  });
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "İçe aktarma sonrası final otomasyon başlatılamadı.");
  }
  return (await response.json()) as Project;
}

export async function importFinalVideo(projectId: string, payload: { filename: string; mimeType: string; dataUrl: string }) {
  const response = await fetch(`${apiBaseUrl}/api/projects/${projectId}/import-final-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await safeError(response);
    throw new Error(error || "Komple video içe aktarılamadı.");
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

export async function createContentAccount(payload: {
  name: string;
  platform: "instagram" | "tiktok" | "youtube";
  platforms?: Array<"instagram" | "tiktok" | "youtube">;
  category?: string;
  concept: string;
  audience: string;
  tone: string;
  language: "tr" | "en" | "de" | "es";
  postingDays?: string[];
  postingHours: string[];
  autopilotMode: "manual" | "assistant" | "autopilot-safe" | "autopilot";
}) {
  const response = await fetch(`${apiBaseUrl}/api/autopilot/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error((await safeError(response)) || "Otopilot hesabı oluşturulamadı.");
  return (await response.json()) as ContentAccount;
}

export async function listContentAccounts() {
  const response = await fetch(`${apiBaseUrl}/api/autopilot/accounts`);
  if (!response.ok) throw new Error((await safeError(response)) || "Otopilot hesapları alınamadı.");
  return (await response.json()) as ContentAccount[];
}

export async function listContentIdeas(accountId?: string) {
  const url = new URL(`${apiBaseUrl}/api/autopilot/ideas`, window.location.origin);
  if (accountId) url.searchParams.set("accountId", accountId);
  const response = await fetch(url);
  if (!response.ok) throw new Error((await safeError(response)) || "İçerik fikirleri alınamadı.");
  return (await response.json()) as ContentIdea[];
}

export async function generateContentIdeas(accountId: string, count = 5) {
  const response = await fetch(`${apiBaseUrl}/api/autopilot/accounts/${accountId}/generate-ideas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count })
  });
  if (!response.ok) throw new Error((await safeError(response)) || "Fikir üretilemedi.");
  return (await response.json()) as ContentIdea[];
}

export async function autoProduceContent(accountId: string, count = 5) {
  const response = await fetch(`${apiBaseUrl}/api/autopilot/accounts/${accountId}/auto-produce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count })
  });
  if (!response.ok) throw new Error((await safeError(response)) || "Otomatik üretim başlatılamadı.");
  return (await response.json()) as { ideas: ContentIdea[]; selectedIdea: ContentIdea; project: Project };
}

export async function produceContentIdea(ideaId: string) {
  const response = await fetch(`${apiBaseUrl}/api/autopilot/ideas/${ideaId}/produce`, { method: "POST" });
  if (!response.ok) throw new Error((await safeError(response)) || "Fikir video projesine çevrilemedi.");
  return (await response.json()) as { idea: ContentIdea; project: Project };
}

export async function approveContentIdea(ideaId: string) {
  const response = await fetch(`${apiBaseUrl}/api/autopilot/ideas/${ideaId}/approve`, { method: "POST" });
  if (!response.ok) throw new Error((await safeError(response)) || "Fikir onaylanamadı.");
  return (await response.json()) as ContentIdea;
}

export async function rejectContentIdea(ideaId: string) {
  const response = await fetch(`${apiBaseUrl}/api/autopilot/ideas/${ideaId}/reject`, { method: "POST" });
  if (!response.ok) throw new Error((await safeError(response)) || "Fikir reddedilemedi.");
  return (await response.json()) as ContentIdea;
}

export async function runDueAutopilot() {
  const response = await fetch(`${apiBaseUrl}/api/autopilot/run-due`, { method: "POST" });
  if (!response.ok) throw new Error((await safeError(response)) || "Zamanlanmış fikirler çalıştırılamadı.");
  return (await response.json()) as { checkedAt: string; produced: Array<{ ideaId: string; projectId: string }> };
}

async function safeError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message;
  } catch {
    return "";
  }
}
