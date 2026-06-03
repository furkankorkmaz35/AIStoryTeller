// Backend pipeline sırası tek yerde tutulur; progress bar, galeri kartı ve çıktı paneli aynı sırayı kullanır.
export const statusSteps = [
  "queued",
  "generating_story",
  "generating_scenes",
  "generating_visuals",
  "selecting_materials",
  "generating_audio",
  "generating_subtitles",
  "rendering_video",
  "completed"
];

export const statusLabels = {
  queued: "Hazırlanıyor",
  generating_story: "Hikaye",
  generating_scenes: "Prompt",
  generating_visuals: "Görseller",
  selecting_materials: "Materyal",
  generating_audio: "Ses",
  generating_subtitles: "Altyazı",
  rendering_video: "Video",
  completed: "Hazır",
  failed: "Durdu"
};

// Backend status değerini yüzdeye çevirir; video üzerindeki dairesel ilerleme göstergesi bu sonucu kullanır.
export function projectProgress(status) {
  if (status === "failed") return 100;
  const index = statusSteps.indexOf(status);
  return Math.max(0, Math.round((index / (statusSteps.length - 1)) * 100));
}

export function statusLabel(status) {
  return statusLabels[status] ?? status;
}
