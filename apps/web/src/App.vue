<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { AlertTriangle, BookOpen, CalendarClock, Check, Clapperboard, Cpu, Download, Film, Image, Layers3, Mic2, Play, RefreshCw, Sparkles, Wand2, Zap } from "lucide-vue-next";
import {
  assetUrl,
  approveContentIdea,
  autoProduceContent,
  continueImportedProject,
  createContentAccount,
  createProject,
  generateContentIdeas,
  getProject,
  getSystemStatus,
  importFinalVideo,
  importSceneVideo,
  listContentAccounts,
  listContentIdeas,
  listProjects,
  produceContentIdea,
  rejectContentIdea,
  regenerateScene,
  retryProject,
  runDueAutopilot,
  type ContentAccount,
  type ContentIdea,
  type Project,
  type ProjectDetail,
  type SystemStatus
} from "./lib/api";

const projects = ref<Project[]>([]);
const selected = ref<ProjectDetail | null>(null);
const loading = ref(false);
const creating = ref(false);
const regeneratingSceneId = ref("");
const importingSceneId = ref("");
const error = ref("");
const apiError = ref("");
const systemStatus = ref<SystemStatus | null>(null);
const contentAccounts = ref<ContentAccount[]>([]);
const contentIdeas = ref<ContentIdea[]>([]);
const autopilotBusy = ref(false);
const showAutopilot = false;
const form = ref({
  theme: "Kalem tanıtımı için doğal UGC reklam: masada not alan biri, hızlı yazım, sade CTA.",
  style: "cinematic",
  ageGroup: "genel sosyal medya izleyicisi",
  sceneCount: 0,
  sceneCountMode: "auto" as const,
  aspectRatio: "9:16" as const,
  targetPlatform: "tiktok" as const,
  creationMode: "full-auto" as "full-auto" | "studio-import",
  languages: ["tr"],
  imageProvider: "pollinations",
  voiceProvider: "elevenlabs",
  elevenLabsVoiceId: "01p4omegjS2n3rSDCM5u",
  subtitlesEnabled: true,
  materialMode: "ai-image",
  imageQuality: "balanced"
});
const activeLanguage = ref<"tr" | "en" | "de" | "es">("tr");
const autopilotForm = ref({
  name: "Türkiye Merak Atlası",
  platform: "instagram" as "instagram" | "tiktok" | "youtube",
  platforms: ["instagram", "tiktok", "youtube"] as Array<"instagram" | "tiktok" | "youtube">,
  category: "Türkiye merak atlası",
  concept: "Türkiye gündemi, tarih ve spor içindeki sıkıcı görünmeyen ama dikkat çekici arka planları 20 saniyelik sinematik kısa videolarla anlat.",
  audience: "Türkiye gündemini, tarihi ve sporu hızlı ama kaliteli kısa videolarla takip etmek isteyen izleyici",
  tone: "merak uyandıran, hızlı, güvenilir, şehirli ve gösterişsiz",
  language: "tr" as const,
  postingDays: ["mon", "wed", "fri"] as string[],
  postingHours: ["20:30"],
  autopilotMode: "autopilot-safe" as const
});

const promptPresets = [
  "Kalem tanıtımı: öğrenciler için hızlı not alma, temiz masa düzeni ve doğal ürün vurgusu",
  "Türkiye gündemi: haftanın konuşulan konusunun arka planını 20 saniyede ilgi çekici anlat",
  "Spor hikayesi: maçtan sonra herkesin kaçırdığı kırılma anını kısa belgesel gibi anlat"
];

const stylePresets = [
  { value: "cinematic", label: "Sinematik", hint: "Derin ışık, zarif kadraj" },
  { value: "storybook", label: "Masalsı", hint: "Yumuşak renk, sıcak anlatım" },
  { value: "cartoon", label: "Çizgi film", hint: "Canlı, eğlenceli ve temiz" },
  { value: "educational", label: "Eğitimsel", hint: "Net, sade ve öğretici" }
];

const creationFlow = ["Prompt", "Görsel", "Ses", "Video"];
const languageOptions = [
  { value: "tr", label: "TR" },
  { value: "en", label: "EN" },
  { value: "de", label: "DE" },
  { value: "es", label: "ES" }
];
const platformOptions = [
  { value: "tiktok", label: "TikTok" },
  { value: "reels", label: "Reels" },
  { value: "shorts", label: "Shorts" }
];
const creationModeOptions = [
  { value: "full-auto", label: "Full Otomatik", hint: "Hikayeden final videoya kadar sistem kendi tamamlar." },
  { value: "studio-import", label: "Studio Import", hint: "Promptlar hazır olur; görsel/klip içe aktarınca final otomasyon devam eder." }
] as const;
const autopilotPlatformOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "Shorts" },
  { value: "tiktok", label: "TikTok" }
] as const;
const postingDayOptions = [
  { value: "mon", label: "Pzt", format: "Gündem sorusu" },
  { value: "tue", label: "Sal", format: "Toplum/şehir" },
  { value: "wed", label: "Çar", format: "Tarih bağlantısı" },
  { value: "thu", label: "Per", format: "Yanlış bilinen" },
  { value: "fri", label: "Cum", format: "Spor hikayesi" },
  { value: "sat", label: "Cmt", format: "Mini liste" },
  { value: "sun", label: "Paz", format: "Hafta özeti" }
];
const materialModes = [
  { value: "hybrid-cloud", label: "Hibrit", hint: "Cloud AI + stok + fallback" },
  { value: "ai-image", label: "AI Görsel", hint: "Öncelik free cloud image" },
  { value: "stock-assisted", label: "Stok destekli", hint: "Pexels/Pixabay ağırlıklı" }
];
const imageProviderOptions = [
  { value: "pollinations", label: "AI Görsel", hint: "Ücretsiz Pollinations ile üretir" },
  { value: "auto", label: "Auto AI", hint: "Cloudflare, HF, Pollinations sırayla denenir" },
  { value: "cloudflare", label: "Cloudflare", hint: "Free günlük limitli AI görsel" },
  { value: "huggingface", label: "HF", hint: "Free krediyle AI görsel yedeği" },
  { value: "designed", label: "Tasarım", hint: "AI bozulursa içerikle bağlı sahne" },
  { value: "stock", label: "Pexels", hint: "Kaliteli stok foto/video desteği" }
];
const voiceOptions = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "Free fallback", tone: "Free planda çalışır, Türkçe metni okuyabilir" },
  { id: "01p4omegjS2n3rSDCM5u", name: "Mert", tone: "Creator gerekli olabilir" },
  { id: "z2ObNnp0E5ZGeTlSXkX0", name: "Mert Aksoy", tone: "Creator gerekli olabilir" },
  { id: "lxZLq5dcyw12UangGJgN", name: "Cavit", tone: "Creator gerekli olabilir" },
  { id: "Q2IX97JeHBY3vNGzgM5s", name: "Cavit", tone: "TV presenter, Creator gerekli olabilir" },
  { id: "Y2T2O1csKPgWgyuKcU0a", name: "Cavit Pancar", tone: "Creator gerekli olabilir" },
  { id: "LCHGt3rsPMP50Vs28amI", name: "Mehmet Derindağ", tone: "Creator gerekli olabilir" }
];

let pollTimer: number | undefined;

const selectedVariant = computed(() => selected.value?.variants.find((variant) => variant.language === activeLanguage.value) ?? selected.value?.variants[0] ?? null);
const selectedVideo = computed(() => selectedVariant.value?.videoPath ?? selected.value?.project.videoPath ?? "");
const selectedAudio = computed(() => selectedVariant.value?.audioPath ?? "");
const completedCount = computed(() => projects.value.filter((project) => project.status === "completed").length);
const activeCount = computed(() => projects.value.filter((project) => !["completed", "failed"].includes(project.status)).length);
const totalSceneCount = computed(() => projects.value.reduce((total, project) => total + project.sceneCount, 0));
const assetCounts = computed(() => ({
  image: selected.value?.assets.filter((asset) => ["image", "stock-image"].includes(asset.type)).length ?? 0,
  audio: selected.value?.assets.filter((asset) => asset.type === "audio").length ?? 0,
  video: selected.value?.assets.filter((asset) => asset.type === "video").length ?? 0
}));
const activeAccount = computed(() => contentAccounts.value[0] ?? null);
const readyIdeas = computed(() => contentIdeas.value.filter((idea) => idea.status !== "rejected").slice(0, 6));
const scheduleSummary = computed(() => {
  const days = postingDayOptions.filter((day) => autopilotForm.value.postingDays.includes(day.value)).map((day) => day.label).join(", ");
  return `${days || "Gün seçilmedi"} · ${autopilotForm.value.postingHours.join(", ")}`;
});
const selectedScheduleFormats = computed(() => postingDayOptions.filter((day) => autopilotForm.value.postingDays.includes(day.value)));
const estimatedSceneCount = computed(() => estimateSceneCount(form.value.theme));
const estimatedVideoDuration = computed(() => estimateVideoDuration(estimatedSceneCount.value));
const currentStepIndex = computed(() => {
  if (!selected.value) return -1;
  if (selected.value.project.status === "failed") return statusSteps.length - 1;
  return statusSteps.indexOf(selected.value.project.status);
});

const progressPercent = computed(() => {
  if (!selected.value) return 0;
  return Math.max(0, Math.round((currentStepIndex.value / (statusSteps.length - 1)) * 100));
});
const imageProviderLabel = computed(() => providerLabel(form.value.imageProvider));

const statusSteps = [
  "queued",
  "generating_story",
  "generating_scenes",
  "translating_variants",
  "awaiting_import",
  "generating_visuals",
  "selecting_materials",
  "generating_audio",
  "generating_subtitles",
  "selecting_bgm",
  "rendering_video",
  "preparing_export",
  "completed"
];

const statusLabels: Record<Project["status"], string> = {
  queued: "Hazırlanıyor",
  generating_story: "Hikaye",
  generating_scenes: "Prompt",
  translating_variants: "Diller",
  awaiting_import: "Import",
  generating_visuals: "Görseller",
  selecting_materials: "Materyal",
  generating_audio: "Ses",
  generating_subtitles: "Altyazı",
  selecting_bgm: "Müzik",
  rendering_video: "Video",
  preparing_export: "Export",
  completed: "Hazır",
  failed: "Durdu"
};

const statusDescriptions: Record<Project["status"], string> = {
  queued: "Sıraya alındı",
  generating_story: "Hikaye kuruluyor",
  generating_scenes: "Promptlar hazırlanıyor",
  translating_variants: "Diller hazırlanıyor",
  awaiting_import: "Klip/görsel içe aktarımı bekleniyor",
  generating_visuals: "Cloud görseller deneniyor",
  selecting_materials: "En iyi materyal seçiliyor",
  generating_audio: "Anlatım hazırlanıyor",
  generating_subtitles: "Altyazılar hazırlanıyor",
  selecting_bgm: "Müzik atmosferi hazırlanıyor",
  rendering_video: "Video birleştiriliyor",
  preparing_export: "Sosyal medya paketi hazırlanıyor",
  completed: "İzlemeye hazır",
  failed: "Tekrar denenebilir"
};

async function refreshProjects() {
  try {
    apiError.value = "";
    projects.value = await listProjects();
    if (!selected.value && projects.value[0]) {
      await selectProject(projects.value[0]._id);
    } else if (selected.value) {
      await selectProject(selected.value.project._id, false);
    }
  } catch (refreshError) {
    apiError.value = refreshError instanceof Error ? refreshError.message : "API bağlantısı kurulamadı.";
  }
}

async function refreshSystemStatus() {
  try {
    systemStatus.value = await getSystemStatus();
  } catch {
    systemStatus.value = null;
  }
}

async function refreshAutopilot() {
  try {
    contentAccounts.value = await listContentAccounts();
    contentIdeas.value = await listContentIdeas(contentAccounts.value[0]?._id);
  } catch {
    contentAccounts.value = [];
    contentIdeas.value = [];
  }
}

async function selectProject(id: string, showLoader = true) {
  if (showLoader) loading.value = true;
  try {
    apiError.value = "";
    selected.value = await getProject(id);
  } catch (detailError) {
    apiError.value = detailError instanceof Error ? detailError.message : "Proje detayı alınamadı.";
  } finally {
    loading.value = false;
  }
}

async function submitProject() {
  creating.value = true;
  error.value = "";
  try {
    const payload = {
      ...form.value,
      materialMode: form.value.imageProvider === "stock" ? "stock-assisted" : form.value.materialMode
    };
    const project = await createProject(payload);
    await refreshProjects();
    await selectProject(project._id);
  } catch (createError) {
    error.value = createError instanceof Error ? createError.message : "Beklenmeyen hata";
  } finally {
    creating.value = false;
  }
}

async function ensureAutopilotAccount() {
  if (activeAccount.value && accountMatchesForm(activeAccount.value)) return activeAccount.value;
  const account = await createContentAccount(autopilotForm.value);
  contentAccounts.value = [account, ...contentAccounts.value];
  return account;
}

function accountMatchesForm(account: ContentAccount) {
  const currentPlatforms = (account.platforms?.length ? account.platforms : [account.platform]).join(",");
  return (
    account.category === autopilotForm.value.category &&
    account.concept === autopilotForm.value.concept &&
    currentPlatforms === autopilotForm.value.platforms.join(",") &&
    (account.postingDays ?? []).join(",") === autopilotForm.value.postingDays.join(",") &&
    account.postingHours.join(",") === autopilotForm.value.postingHours.join(",")
  );
}

function toggleAutopilotPlatform(platform: "instagram" | "tiktok" | "youtube") {
  const platforms = autopilotForm.value.platforms;
  if (platforms.includes(platform) && platforms.length > 1) {
    autopilotForm.value.platforms = platforms.filter((item) => item !== platform);
  } else if (!platforms.includes(platform)) {
    autopilotForm.value.platforms = [...platforms, platform];
  }
  autopilotForm.value.platform = autopilotForm.value.platforms[0] ?? "instagram";
}

function togglePostingDay(day: string) {
  const days = autopilotForm.value.postingDays;
  if (days.includes(day) && days.length > 1) {
    autopilotForm.value.postingDays = days.filter((item) => item !== day);
  } else if (!days.includes(day)) {
    autopilotForm.value.postingDays = postingDayOptions.filter((option) => [...days, day].includes(option.value)).map((option) => option.value);
  }
}

function setPrimaryPostingHour(event: Event) {
  const value = (event.target as HTMLInputElement).value || "20:30";
  autopilotForm.value.postingHours = [value];
}

function formatSchedule(date?: string) {
  if (!date) return "Takvime alınmadı";
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

async function generateAutopilotIdeas() {
  autopilotBusy.value = true;
  error.value = "";
  try {
    const account = await ensureAutopilotAccount();
    await generateContentIdeas(account._id, 5);
    await refreshAutopilot();
  } catch (autopilotError) {
    error.value = autopilotError instanceof Error ? autopilotError.message : "Otopilot fikir üretemedi.";
  } finally {
    autopilotBusy.value = false;
  }
}

async function autoProduceFromConcept() {
  autopilotBusy.value = true;
  error.value = "";
  try {
    const account = await ensureAutopilotAccount();
    const result = await autoProduceContent(account._id, 5);
    await Promise.all([refreshAutopilot(), refreshProjects()]);
    await selectProject(result.project._id);
  } catch (autopilotError) {
    error.value = autopilotError instanceof Error ? autopilotError.message : "Otomatik üretim başlatılamadı.";
  } finally {
    autopilotBusy.value = false;
  }
}

async function produceIdea(idea: ContentIdea) {
  autopilotBusy.value = true;
  error.value = "";
  try {
    const result = await produceContentIdea(idea._id);
    await Promise.all([refreshAutopilot(), refreshProjects()]);
    await selectProject(result.project._id);
  } catch (produceError) {
    error.value = produceError instanceof Error ? produceError.message : "Fikir video pipeline'a alınamadı.";
  } finally {
    autopilotBusy.value = false;
  }
}

async function approveIdea(idea: ContentIdea) {
  autopilotBusy.value = true;
  error.value = "";
  try {
    await approveContentIdea(idea._id);
    await refreshAutopilot();
  } catch (approveError) {
    error.value = approveError instanceof Error ? approveError.message : "Fikir onaylanamadı.";
  } finally {
    autopilotBusy.value = false;
  }
}

async function rejectIdea(idea: ContentIdea) {
  autopilotBusy.value = true;
  error.value = "";
  try {
    await rejectContentIdea(idea._id);
    await refreshAutopilot();
  } catch (rejectError) {
    error.value = rejectError instanceof Error ? rejectError.message : "Fikir reddedilemedi.";
  } finally {
    autopilotBusy.value = false;
  }
}

async function runDueIdeas() {
  autopilotBusy.value = true;
  error.value = "";
  try {
    await runDueAutopilot();
    await Promise.all([refreshAutopilot(), refreshProjects()]);
  } catch (runError) {
    error.value = runError instanceof Error ? runError.message : "Zamanlanmış fikirler çalıştırılamadı.";
  } finally {
    autopilotBusy.value = false;
  }
}

async function retrySelectedProject() {
  if (!selected.value) return;
  creating.value = true;
  error.value = "";
  try {
    await retryProject(selected.value.project._id);
    await selectProject(selected.value.project._id, false);
  } catch (retryError) {
    error.value = retryError instanceof Error ? retryError.message : "Proje yeniden başlatılamadı.";
  } finally {
    creating.value = false;
  }
}

async function regenerateSelectedScene(sceneId: string) {
  if (!selected.value) return;
  regeneratingSceneId.value = sceneId;
  error.value = "";
  try {
    await regenerateScene(selected.value.project._id, sceneId);
    await selectProject(selected.value.project._id, false);
  } catch (regenerateError) {
    error.value = regenerateError instanceof Error ? regenerateError.message : "Sahne yeniden üretilemedi.";
  } finally {
    regeneratingSceneId.value = "";
  }
}

async function importExternalClip(sceneId: string, event: Event) {
  if (!selected.value) return;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  importingSceneId.value = sceneId;
  error.value = "";
  try {
    const dataUrl = await readFileAsDataUrl(file);
    await importSceneVideo(selected.value.project._id, sceneId, {
      filename: file.name,
      mimeType: file.type || "video/mp4",
      dataUrl
    });
    await selectProject(selected.value.project._id, false);
  } catch (importError) {
    error.value = importError instanceof Error ? importError.message : "Dış video klibi içe aktarılamadı.";
  } finally {
    importingSceneId.value = "";
  }
}

async function continueImportFlow() {
  if (!selected.value) return;
  creating.value = true;
  error.value = "";
  try {
    await continueImportedProject(selected.value.project._id);
    await selectProject(selected.value.project._id, false);
  } catch (continueError) {
    error.value = continueError instanceof Error ? continueError.message : "Final otomasyon başlatılamadı.";
  } finally {
    creating.value = false;
  }
}

async function importWholeVideo(event: Event) {
  if (!selected.value) return;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  creating.value = true;
  error.value = "";
  try {
    const dataUrl = await readFileAsDataUrl(file);
    await importFinalVideo(selected.value.project._id, {
      filename: file.name,
      mimeType: file.type || "video/mp4",
      dataUrl
    });
    await selectProject(selected.value.project._id, false);
    await refreshProjects();
  } catch (importError) {
    error.value = importError instanceof Error ? importError.message : "Komple video içe aktarılamadı.";
  } finally {
    creating.value = false;
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

function displayEventMessage(message: string) {
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

function usePreset(preset: string) {
  form.value.theme = preset;
}

function toggleLanguage(language: string) {
  const next = new Set(form.value.languages);
  if (next.has(language) && next.size > 1) next.delete(language);
  else next.add(language);
  form.value.languages = Array.from(next);
}

function selectVoice(voiceId: string) {
  form.value.elevenLabsVoiceId = voiceId;
}

function providerLabel(value?: string) {
  if (value === "designed") return "Tasarım";
  if (value === "auto") return "Auto AI";
  if (value === "pollinations") return "AI Görsel";
  if (value === "stock") return "Pexels";
  if (value === "huggingface") return "HF";
  if (value === "cloudflare") return "Cloudflare";
  return value || "Tasarım";
}

function estimateSceneCount(content: string) {
  return 3;
}

function estimateVideoDuration(sceneCount: number) {
  return sceneCount <= 3 ? 18 : 20;
}

function projectProgress(status: Project["status"]) {
  if (status === "failed") return 100;
  const index = statusSteps.indexOf(status);
  return Math.max(0, Math.round((index / (statusSteps.length - 1)) * 100));
}

function statusLabel(status: Project["status"] | string) {
  return statusLabels[status as Project["status"]] ?? status;
}

function statusDescription(status: Project["status"] | string) {
  return statusDescriptions[status as Project["status"]] ?? "Bekliyor";
}

onMounted(async () => {
  await Promise.all([refreshProjects(), refreshSystemStatus(), refreshAutopilot()]);
  pollTimer = window.setInterval(() => {
    void refreshProjects();
    void refreshSystemStatus();
    void refreshAutopilot();
  }, 3500);
});

onUnmounted(() => {
  if (pollTimer) window.clearInterval(pollTimer);
});
</script>

<template>
  <main class="app-shell">
    <aside class="sidebar">
      <div class="brand-mark">
        <div class="brand-icon"><Clapperboard :size="24" /></div>
        <div>
          <strong>AI Video Studio</strong>
          <span>Hikayeden videoya</span>
        </div>
      </div>

      <nav class="nav-stack">
        <button class="nav-item active" type="button"><Sparkles :size="18" /> Oluştur</button>
        <button class="nav-item" type="button"><Film :size="18" /> Galeri</button>
        <button class="nav-item" type="button"><Layers3 :size="18" /> Akış</button>
      </nav>

      <section class="sidebar-panel">
        <span class="panel-kicker">Sıradaki iş</span>
        <strong>{{ systemStatus?.queue?.waiting ?? projects.length }}</strong>
        <small>Hazırlanan video</small>
        <div class="mini-health">
          <span :class="{ online: systemStatus?.database === 'connected' }"></span>
          Stüdyo hazır
        </div>
      </section>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <span class="eyebrow">Creative video studio</span>
          <h1>Hikayeni gösterişli bir videoya dönüştür.</h1>
          <p class="hero-copy">Tema seç, tonu belirle, gerisini stüdyo akışı hazırlasın.</p>
        </div>
        <div class="live-pill"><Zap :size="16" /> {{ systemStatus?.ok ? "Stüdyo hazır" : "Stüdyo hazırlanıyor" }}</div>
      </header>

      <section class="studio-metrics" aria-label="Stüdyo özeti">
        <div class="metric-card depth-card">
          <span>Videolar</span>
          <strong>{{ projects.length }}</strong>
          <small>{{ completedCount }} tanesi hazır</small>
        </div>
        <div class="metric-card depth-card">
          <span>Devam eden</span>
          <strong>{{ activeCount }}</strong>
          <small>{{ systemStatus?.queue?.active ?? 0 }} video işleniyor</small>
        </div>
        <div class="metric-card depth-card">
          <span>Sahneler</span>
          <strong>{{ totalSceneCount }}</strong>
          <small>Toplam taslak</small>
        </div>
      </section>

      <section class="system-strip" aria-label="Arka plan durumu">
        <div class="system-chip depth-card">
          <span class="pulse-dot" :class="{ online: systemStatus?.database === 'connected' }"></span>
          Kayıt {{ systemStatus?.database === "connected" ? "aktif" : "bekleniyor" }}
        </div>
        <div class="system-chip depth-card">
          <Layers3 :size="16" />
          {{ systemStatus?.queue?.waiting ?? 0 }} bekleyen
        </div>
        <div class="system-chip depth-card">
          <Cpu :size="16" />
          Hikaye motoru hazır
        </div>
        <div class="system-chip depth-card">
          <Image :size="16" />
          Görsel akışı hazır
        </div>
      </section>
      <section class="notice-card depth-card voice-note">
        <Mic2 :size="20" />
        <div>
          <strong>Ses modu: ElevenLabs Türkçe</strong>
          <span>Edge TTS otomatik fallback olarak kullanılmaz; ElevenLabs başarısız olursa sessiz fallback devreye girer.</span>
        </div>
      </section>

      <section v-if="showAutopilot" class="autopilot-panel depth-card">
        <div class="autopilot-copy">
          <span class="eyebrow">Kanal otomasyonu</span>
          <h2>Tek kategoriyle düzenli kısa video akışı kur.</h2>
          <p>Sayfa kimliği, yayın günü ve platform paketi sabit kalsın; sistem her slot için fikir, hook, caption ve video taslağı hazırlasın.</p>
        </div>
        <div class="autopilot-form">
          <div class="content-plan">
            <div>
              <span>Kategori</span>
              <strong>{{ autopilotForm.category }}</strong>
            </div>
            <div>
              <span>Yayın ritmi</span>
              <strong>{{ scheduleSummary }}</strong>
            </div>
            <div>
              <span>Platform paketi</span>
              <strong>{{ autopilotForm.platforms.length }} kanal</strong>
            </div>
          </div>
          <label>
            Kategori
            <input v-model="autopilotForm.category" />
          </label>
          <label>
            Sayfa konsepti
            <textarea v-model="autopilotForm.concept" rows="3" />
          </label>
          <div class="schedule-builder">
            <div>
              <span>Platformlar</span>
              <div class="pill-row">
                <button
                  v-for="option in autopilotPlatformOptions"
                  :key="option.value"
                  type="button"
                  class="choice-pill"
                  :class="{ active: autopilotForm.platforms.includes(option.value) }"
                  @click="toggleAutopilotPlatform(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div>
              <span>Yayın günleri</span>
              <div class="pill-row">
                <button
                  v-for="day in postingDayOptions"
                  :key="day.value"
                  type="button"
                  class="choice-pill day-pill"
                  :class="{ active: autopilotForm.postingDays.includes(day.value) }"
                  @click="togglePostingDay(day.value)"
                >
                  {{ day.label }}
                </button>
              </div>
            </div>
            <label class="time-control">
              Saat
              <input :value="autopilotForm.postingHours[0]" type="time" @input="setPrimaryPostingHour" />
            </label>
          </div>
          <div class="format-strip">
            <span v-for="day in selectedScheduleFormats" :key="day.value">
              <strong>{{ day.label }}</strong>
              {{ day.format }}
            </span>
          </div>
          <div class="autopilot-controls">
            <select v-model="autopilotForm.autopilotMode">
              <option value="assistant">Assistant</option>
              <option value="autopilot-safe">Autopilot Safe</option>
              <option value="autopilot">Autopilot</option>
            </select>
            <button type="button" :disabled="autopilotBusy" @click="generateAutopilotIdeas">
              <CalendarClock :size="16" />
              {{ autopilotBusy ? "Üretiliyor" : "Öneri üret" }}
            </button>
            <button type="button" :disabled="autopilotBusy" @click="autoProduceFromConcept">
              <Zap :size="16" />
              Otomatik üret
            </button>
            <button type="button" :disabled="autopilotBusy" @click="runDueIdeas">
              <Zap :size="16" />
              Zamanı gelenleri çalıştır
            </button>
          </div>
        </div>
        <div class="idea-grid">
          <article v-for="idea in readyIdeas" :key="idea._id" class="idea-card">
            <div class="idea-score">{{ idea.score }}</div>
            <span>{{ idea.source }} · {{ idea.status }} · {{ formatSchedule(idea.scheduledFor) }}</span>
            <h3>{{ idea.title }}</h3>
            <p>{{ idea.hook }}</p>
            <small>{{ idea.scoreReason }}</small>
            <div class="idea-tags">
              <span v-for="tag in idea.hashtags" :key="tag">{{ tag }}</span>
            </div>
            <div class="idea-actions">
              <button type="button" :disabled="autopilotBusy || idea.status === 'approved' || idea.status === 'producing'" @click="approveIdea(idea)">
                <Check :size="14" />
                Onayla
              </button>
              <button type="button" :disabled="autopilotBusy || idea.status === 'producing'" @click="produceIdea(idea)">
                <Play :size="14" />
                Video üret
              </button>
              <button type="button" :disabled="autopilotBusy || idea.status === 'producing'" @click="rejectIdea(idea)">
                Reddet
              </button>
            </div>
          </article>
          <div v-if="!readyIdeas.length" class="idea-empty">
            <Sparkles :size="20" />
            Konseptten ilk fikirleri üretmeye hazır.
          </div>
        </div>
      </section>

      <section v-if="apiError" class="notice-card depth-card">
        <AlertTriangle :size="20" />
        <div>
          <strong>API bağlantısı bekleniyor</strong>
          <span>{{ apiError }} MongoDB/Redis ve Express API çalıştığında ekran otomatik yenilenir.</span>
        </div>
        <button @click="refreshProjects"><RefreshCw :size="16" /> Yenile</button>
      </section>

      <section class="creator-grid">
        <form class="creator-panel composer-card depth-card" @submit.prevent="submitProject">
          <div class="composer-head">
            <div class="section-title">
              <Wand2 :size="20" />
              <span>Prompttan video</span>
            </div>
          </div>

          <div v-if="false" class="flow-row" aria-label="Oluşturma adımları">
            <span v-for="(item, index) in creationFlow" :key="item">
              <Check v-if="index < 3" :size="13" />
              <Sparkles v-else :size="13" />
              {{ item }}
            </span>
          </div>

          <label class="prompt-box">
            <span>Prompt</span>
            <textarea v-model="form.theme" rows="5" placeholder="Ne üretmek istiyorsun? Örnek: A curious cat and a friendly dog find a hidden sunny bay by canoe." />
          </label>

          <div class="preset-row">
            <button v-for="preset in promptPresets" :key="preset" type="button" @click="usePreset(preset)">
              <Sparkles :size="14" />
              {{ preset }}
            </button>
          </div>

          <div v-if="false" class="style-card-grid">
            <button
              v-for="preset in stylePresets"
              :key="preset.value"
              type="button"
              class="style-card"
              :class="{ active: form.style === preset.value }"
              @click="form.style = preset.value"
            >
              <BookOpen :size="18" />
              <strong>{{ preset.label }}</strong>
              <span>{{ preset.hint }}</span>
            </button>
          </div>

          <div v-if="false" class="tool-section">
            <div class="tool-section-head">
              <span>Üretim modu</span>
              <small>{{ form.creationMode === "full-auto" ? "Sistem uçtan uca tamamlar" : "Promptlar hazırlanır, klip/görsel içe aktarılır" }}</small>
            </div>
            <div class="provider-choice-grid">
              <button
                v-for="mode in creationModeOptions"
                :key="mode.value"
                type="button"
                class="provider-choice"
                :class="{ active: form.creationMode === mode.value }"
                @click="form.creationMode = mode.value"
              >
                <strong>{{ mode.label }}</strong>
                <span>{{ mode.hint }}</span>
              </button>
            </div>
          </div>

          <div v-if="false" class="option-group">
            <label>
              Platform
              <div class="segmented-control">
                <button
                  v-for="platform in platformOptions"
                  :key="platform.value"
                  type="button"
                  :class="{ active: form.targetPlatform === platform.value }"
                  @click="form.targetPlatform = platform.value as typeof form.targetPlatform"
                >
                  {{ platform.label }}
                </button>
              </div>
            </label>
            <label>
              Kalite
              <select v-model="form.imageQuality">
                <option value="demo">Demo</option>
                <option value="balanced">Dengeli</option>
                <option value="high">Yüksek</option>
              </select>
            </label>
          </div>

          <div v-if="false" class="material-grid">
            <button
              v-for="mode in materialModes"
              :key="mode.value"
              type="button"
              class="material-card"
              :class="{ active: form.materialMode === mode.value }"
              @click="form.materialMode = mode.value"
            >
              <strong>{{ mode.label }}</strong>
              <span>{{ mode.hint }}</span>
            </button>
          </div>

          <div v-if="false" class="tool-section">
            <div class="tool-section-head">
              <span>Görsel kaynağı</span>
              <small>{{ form.imageProvider === "auto" ? "En iyi aday otomatik seçilir" : "Bu sağlayıcı öncelikli denenir" }}</small>
            </div>
            <div class="provider-choice-grid">
              <button
                v-for="provider in imageProviderOptions"
                :key="provider.value"
                type="button"
                class="provider-choice"
                :class="{ active: form.imageProvider === provider.value }"
                @click="form.imageProvider = provider.value"
              >
                <strong>{{ provider.label }}</strong>
                <span>{{ provider.hint }}</span>
              </button>
            </div>
          </div>

          <div v-if="false" class="tool-section voice-lab">
            <div class="tool-section-head">
              <span>Türkçe ses denemesi</span>
              <small>ElevenLabs multilingual model</small>
            </div>
            <div class="voice-grid">
              <button
                v-for="voice in voiceOptions"
                :key="voice.id"
                type="button"
                class="voice-card"
                :class="{ active: form.elevenLabsVoiceId === voice.id }"
                @click="selectVoice(voice.id)"
              >
                <strong>{{ voice.name }}</strong>
                <span>{{ voice.tone }}</span>
              </button>
            </div>
            <label class="voice-id-field">
              Manuel ElevenLabs Voice ID
              <input v-model="form.elevenLabsVoiceId" placeholder="ElevenLabs panelinden Voice ID yapıştır" />
            </label>
          </div>

          <label v-if="false" class="language-picker">
            Diller
            <div>
              <button
                v-for="language in languageOptions"
                :key="language.value"
                type="button"
                :class="{ active: form.languages.includes(language.value) }"
                @click="toggleLanguage(language.value)"
              >
                {{ language.label }}
              </button>
            </div>
          </label>

          <div v-if="false" class="control-row">
            <div class="auto-flow-card">
              <span>Sahne akışı</span>
              <strong>{{ estimatedSceneCount }} sahne</strong>
              <small>Yaklaşık {{ estimatedVideoDuration }} saniyelik kısa video.</small>
            </div>
          </div>

          <div class="switch-row">
            <button type="button" class="switch-card" :class="{ active: form.subtitlesEnabled }" @click="form.subtitlesEnabled = !form.subtitlesEnabled">
              <span class="switch-knob"></span>
              <strong>Altyazı</strong>
              <small>{{ form.subtitlesEnabled ? "Videoda gösterilecek" : "Sadece ses ve görsel akış" }}</small>
            </button>
          </div>

          <button class="generate-button" :disabled="creating">
            <Play :size="18" />
            {{ creating ? "Video hazırlanıyor" : "Videoyu oluştur" }}
          </button>
          <div v-if="false" class="engine-strip">
            <span><Sparkles :size="15" /> Groq metin</span>
            <span><Image :size="15" /> {{ imageProviderLabel }} görsel</span>
            <span><Mic2 :size="15" /> ElevenLabs {{ form.subtitlesEnabled ? "+ altyazı" : "ses" }}</span>
            <span><Film :size="15" /> Remotion</span>
          </div>
          <p v-if="error" class="error-text">{{ error }}</p>
        </form>

        <section class="projects-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">Galeri</span>
              <h2>Son çalışmalar</h2>
            </div>
            <small>{{ projects.length }} video</small>
          </div>
          <div v-if="!projects.length" class="empty-card depth-card">
            <Sparkles :size="28" />
            <strong>Henüz video yok</strong>
            <span>İlk fikrini yazıp oluşturmayı başlat.</span>
          </div>
          <div
            v-for="project in projects"
            :key="project._id"
            class="project-card depth-card"
            :class="{ selected: selected?.project._id === project._id }"
            @click="selectProject(project._id)"
          >
            <div>
              <span class="status-badge">{{ statusLabel(project.status) }}</span>
              <h3>{{ project.title }}</h3>
            </div>
            <div class="project-meta compact">
              <small>{{ new Date(project.createdAt).toLocaleDateString("tr-TR") }}</small>
            </div>
            <div class="project-progress">
              <span :style="{ width: `${projectProgress(project.status)}%` }"></span>
            </div>
          </div>
        </section>
      </section>

      <section v-if="selected" class="detail-grid video-only">
        <div class="video-frame depth-card">
          <div v-if="selected.project.status === 'completed'" class="render-ribbon">
            <Sparkles :size="15" />
            Video hazır
          </div>
          <div
            v-else
            class="video-progress-orb"
            :style="{ '--progress': `${progressPercent}%` }"
            aria-label="Video hazırlık ilerlemesi"
          >
            <strong>{{ progressPercent }}%</strong>
            <span>hazır</span>
          </div>
          <video v-if="selectedVideo" :src="assetUrl(selectedVideo)" controls />
          <div v-else class="video-placeholder">
            <Film :size="42" />
            <span>{{ loading ? "Yükleniyor" : "Video hazırlanıyor" }}</span>
          </div>
          <a v-if="selectedVideo" class="download-link" :href="assetUrl(selectedVideo)" download>
            <Download :size="16" />
            MP4 indir
          </a>
        </div>
      </section>

      <section v-else class="detail-grid placeholder-grid">
        <div class="video-frame depth-card">
          <div class="video-placeholder">
            <Film :size="42" />
            <span>Bir video seçildiğinde önizleme burada açılır</span>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>
