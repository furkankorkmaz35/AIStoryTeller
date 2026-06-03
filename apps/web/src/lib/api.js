const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// Backend'in döndürdüğü /outputs/... dosya yollarını tarayıcıda oynatılabilir tam URL'lere çevirir.
export function assetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${apiBaseUrl}${path}`;
}

// Sadeleştirilmiş UI'da kullanıcı sadece yeni video üretimi başlatır; bu yüzden tek yazma işlemi proje oluşturmadır.
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

// Tüm API çağrıları aynı base URL ve hata yakalama mantığını kullansın diye ortak fetch yardımcı fonksiyonu.
async function apiRequest(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  if (!response.ok) throw new Error((await safeError(response)) || "API isteği başarısız oldu.");
  return response.json();
}

// Hata bazen backend middleware'inden, bazen provider servisinden gelir; JSON okunamazsa boş mesajla güvenli döner.
async function safeError(response) {
  try {
    const body = await response.json();
    return body.message;
  } catch {
    return "";
  }
}
