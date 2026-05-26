<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { AlertTriangle, BookOpen, Check, Clapperboard, Cpu, Download, Film, Image, Layers3, Mic2, Minus, Play, Plus, RefreshCw, Sparkles, Wand2, Zap } from "lucide-vue-next";
import { assetUrl, createProject, getProject, getSystemStatus, listProjects, retryProject, type Project, type ProjectDetail, type SystemStatus } from "./lib/api";

const projects = ref<Project[]>([]);
const selected = ref<ProjectDetail | null>(null);
const loading = ref(false);
const creating = ref(false);
const error = ref("");
const apiError = ref("");
const systemStatus = ref<SystemStatus | null>(null);
const form = ref({
  theme: "Cesur bir robotun kaybolan hayalleri bulması",
  style: "cinematic",
  ageGroup: "7-10",
  sceneCount: 3
});

const promptPresets = [
  "Ay ışığında çalışan minik bir zaman makinesi",
  "Bulutlardan müzik toplayan küçük gezgin",
  "Denizin altında kaybolan ışık haritası"
];

const stylePresets = [
  { value: "cinematic", label: "Sinematik", hint: "Derin ışık, zarif kadraj" },
  { value: "storybook", label: "Masalsı", hint: "Yumuşak renk, sıcak anlatım" },
  { value: "cartoon", label: "Çizgi film", hint: "Canlı, eğlenceli ve temiz" },
  { value: "educational", label: "Eğitimsel", hint: "Net, sade ve öğretici" }
];

const ageGroups = ["4-6", "7-10", "11-13"];
const creationFlow = ["Fikir", "Ton", "Sahne", "Video"];

let pollTimer: number | undefined;

const selectedVideo = computed(() => selected.value?.assets.find((asset) => asset.type === "video")?.path ?? selected.value?.project.videoPath ?? "");
const selectedAudio = computed(() => selected.value?.assets.find((asset) => asset.type === "audio")?.path ?? "");
const completedCount = computed(() => projects.value.filter((project) => project.status === "completed").length);
const activeCount = computed(() => projects.value.filter((project) => !["completed", "failed"].includes(project.status)).length);
const totalSceneCount = computed(() => projects.value.reduce((total, project) => total + project.sceneCount, 0));
const assetCounts = computed(() => ({
  image: selected.value?.assets.filter((asset) => asset.type === "image").length ?? 0,
  audio: selected.value?.assets.filter((asset) => asset.type === "audio").length ?? 0,
  video: selected.value?.assets.filter((asset) => asset.type === "video").length ?? 0
}));
const currentStepIndex = computed(() => {
  if (!selected.value) return -1;
  if (selected.value.project.status === "failed") return statusSteps.length - 1;
  return statusSteps.indexOf(selected.value.project.status);
});

const progressPercent = computed(() => {
  if (!selected.value) return 0;
  return Math.max(0, Math.round((currentStepIndex.value / (statusSteps.length - 1)) * 100));
});

const statusSteps = [
  "queued",
  "generating_story",
  "generating_images",
  "generating_audio",
  "rendering_video",
  "completed"
];

const statusLabels: Record<Project["status"], string> = {
  queued: "Hazırlanıyor",
  generating_story: "Hikaye",
  generating_images: "Görseller",
  generating_audio: "Ses",
  rendering_video: "Video",
  completed: "Hazır",
  failed: "Durdu"
};

const statusDescriptions: Record<Project["status"], string> = {
  queued: "Sıraya alındı",
  generating_story: "Hikaye kuruluyor",
  generating_images: "Sahneler çiziliyor",
  generating_audio: "Anlatım hazırlanıyor",
  rendering_video: "Video birleştiriliyor",
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
    const project = await createProject(form.value);
    await refreshProjects();
    await selectProject(project._id);
  } catch (createError) {
    error.value = createError instanceof Error ? createError.message : "Beklenmeyen hata";
  } finally {
    creating.value = false;
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

function displayEventMessage(message: string) {
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

function usePreset(preset: string) {
  form.value.theme = preset;
}

function setSceneCount(nextValue: number) {
  form.value.sceneCount = Math.min(6, Math.max(3, nextValue));
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
  await Promise.all([refreshProjects(), refreshSystemStatus()]);
  pollTimer = window.setInterval(() => {
    void refreshProjects();
    void refreshSystemStatus();
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
              <span>Yeni video</span>
            </div>
            <span class="composer-mode">Hızlı taslak</span>
          </div>

          <div class="flow-row" aria-label="Oluşturma adımları">
            <span v-for="(item, index) in creationFlow" :key="item">
              <Check v-if="index < 3" :size="13" />
              <Sparkles v-else :size="13" />
              {{ item }}
            </span>
          </div>

          <label class="prompt-box">
            <span>Video fikri</span>
            <textarea v-model="form.theme" rows="5" placeholder="Örnek: Cesur bir robotun kaybolan hayalleri bulması" />
          </label>

          <div class="preset-row">
            <button v-for="preset in promptPresets" :key="preset" type="button" @click="usePreset(preset)">
              <Sparkles :size="14" />
              {{ preset }}
            </button>
          </div>

          <div class="style-card-grid">
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

          <div class="control-row">
            <label class="segmented-label">
              İzleyici
              <div class="segmented-control">
                <button
                  v-for="age in ageGroups"
                  :key="age"
                  type="button"
                  :class="{ active: form.ageGroup === age }"
                  @click="form.ageGroup = age"
                >
                  {{ age }}
                </button>
              </div>
            </label>
            <label class="stepper-control">
              Sahne
              <div>
                <button type="button" aria-label="Sahne sayısını azalt" @click="setSceneCount(form.sceneCount - 1)"><Minus :size="16" /></button>
                <strong>{{ form.sceneCount }}</strong>
                <button type="button" aria-label="Sahne sayısını artır" @click="setSceneCount(form.sceneCount + 1)"><Plus :size="16" /></button>
              </div>
            </label>
          </div>

          <button class="generate-button" :disabled="creating">
            <Play :size="18" />
            {{ creating ? "Video hazırlanıyor" : "Videoyu oluştur" }}
          </button>
          <div class="engine-strip">
            <span><Sparkles :size="15" /> Hikaye</span>
            <span><Image :size="15" /> Görsel</span>
            <span><Film :size="15" /> Video</span>
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
              <p>{{ project.theme }}</p>
            </div>
            <div class="project-meta">
              <small>{{ project.style }}</small>
              <small>{{ project.sceneCount }} sahne</small>
              <small>{{ new Date(project.createdAt).toLocaleString("tr-TR") }}</small>
            </div>
            <div class="project-progress">
              <span :style="{ width: `${projectProgress(project.status)}%` }"></span>
            </div>
          </div>
        </section>
      </section>

      <section v-if="selected" class="detail-grid">
        <div class="video-frame depth-card">
          <div v-if="selected.project.status === 'completed'" class="render-ribbon">
            <Sparkles :size="15" />
            Video hazır
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
          <div class="video-toolbar">
            <span>{{ selected.project.style }}</span>
            <span>{{ selected.project.sceneCount }} sahne</span>
            <span>{{ selected.project.ageGroup }}</span>
          </div>
        </div>

        <div class="pipeline-panel timeline-card depth-card">
          <div class="timeline-head">
            <div>
              <h2>Hazırlık akışı</h2>
              <p>{{ statusDescription(selected.project.status) }}</p>
            </div>
            <strong>{{ progressPercent }}%</strong>
          </div>
          <button v-if="selected.project.status === 'failed'" class="retry-button" @click="retrySelectedProject">
            <RefreshCw :size="16" />
            Yeniden başlat
          </button>
          <div class="progress-track">
            <span :style="{ width: `${progressPercent}%` }"></span>
          </div>
          <div class="stepper">
            <div
              v-for="(step, index) in statusSteps"
              :key="step"
              class="step"
              :class="{ done: index <= currentStepIndex, running: index === currentStepIndex && selected.project.status !== 'completed' }"
            >
              <span>{{ index + 1 }}</span>
              <div>
                <strong>{{ statusLabel(step) }}</strong>
                <small>{{ index <= currentStepIndex ? "tamam" : "bekliyor" }}</small>
              </div>
            </div>
          </div>
          <div class="events">
            <span class="event-kicker">Son hareketler</span>
            <p v-for="event in selected.events" :key="event._id">
              <strong>
                {{ statusLabel(event.step) }}
                <span>{{ statusLabel(event.status) }}</span>
              </strong>
              {{ displayEventMessage(event.message) }}
            </p>
          </div>
        </div>
      </section>

      <section v-else class="detail-grid placeholder-grid">
        <div class="video-frame depth-card">
          <div class="video-placeholder">
            <Film :size="42" />
            <span>Bir video seçildiğinde önizleme burada açılır</span>
          </div>
        </div>
        <div class="pipeline-panel depth-card">
          <h2>Hazırlık akışı</h2>
          <div class="stepper">
            <div v-for="(step, index) in statusSteps" :key="step" class="step" :class="{ done: index <= currentStepIndex }">
              <span></span>
              {{ statusLabel(step) }}
            </div>
          </div>
        </div>
      </section>

      <section v-if="selected" class="story-section">
        <div class="asset-summary">
          <div class="summary-item depth-card">
            <Image :size="20" />
            <strong>{{ assetCounts.image }}</strong>
            <span>Görsel</span>
          </div>
          <div class="summary-item depth-card">
            <Mic2 :size="20" />
            <strong>{{ assetCounts.audio }}</strong>
            <span>Anlatım</span>
          </div>
          <div class="summary-item depth-card">
            <Film :size="20" />
            <strong>{{ assetCounts.video }}</strong>
            <span>Video</span>
          </div>
        </div>
        <article class="story-panel depth-card">
          <span class="eyebrow">Hikaye</span>
          <p>{{ selected.project.story || "Hikaye üretimi bekleniyor." }}</p>
          <audio v-if="selectedAudio" :src="assetUrl(selectedAudio)" controls />
        </article>

        <div class="scene-grid">
          <article v-for="scene in selected.scenes" :key="scene._id" class="scene-card depth-card">
            <div class="scene-media">
              <img v-if="scene.imagePath" :src="assetUrl(scene.imagePath)" :alt="`Sahne ${scene.order}`" />
              <div v-else class="scene-image-placeholder">
                <Image :size="26" />
              </div>
              <div v-if="scene.imagePrompt" class="scene-overlay">
                <span>Prompt</span>
                <p>{{ scene.imagePrompt }}</p>
              </div>
            </div>
            <div class="scene-copy">
              <div class="scene-heading">
                <span>Sahne {{ scene.order }}</span>
                <small>{{ scene.status }}</small>
              </div>
              <p>{{ scene.text }}</p>
              <small>{{ scene.imagePrompt }}</small>
            </div>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>
