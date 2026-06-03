const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// Converts backend asset paths into playable URLs for video, image and audio previews.
export function assetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${apiBaseUrl}${path}`;
}

// Project creation is intentionally the only mutating call the simplified UI exposes.
export async function createProject(payload) {
  return apiRequest("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function listProjects() {
  return apiRequest("/api/projects");
}

export async function getProject(id) {
  return apiRequest(`/api/projects/${id}`);
}

export async function getSystemStatus() {
  return apiRequest("/api/system/status");
}

// One fetch wrapper keeps every API call using the same base URL and error handling.
async function apiRequest(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  if (!response.ok) throw new Error((await safeError(response)) || "API isteği başarısız oldu.");
  return response.json();
}

// API errors can be plain text or JSON depending on the failing middleware/provider.
async function safeError(response) {
  try {
    const body = await response.json();
    return body.message;
  } catch {
    return "";
  }
}
