<script setup>
import { computed } from "vue";
import { CheckCircle2, Clock3, Database, Download, Film, Image, Mic2, Sparkles, TerminalSquare } from "lucide-vue-next";
import { assetUrl } from "../../lib/api";

const props = defineProps({
  selected: { type: Object, required: true },
  selectedVideo: { type: String, default: "" },
  selectedAudio: { type: String, default: "" },
  selectedAudioAsset: { type: Object, default: null },
  selectedImageScenes: { type: Array, default: () => [] },
  visibleEvents: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  progressPercent: { type: Number, default: 0 },
  currentStepIndex: { type: Number, default: -1 },
  statusSteps: { type: Array, default: () => [] },
  statusLabel: { type: Function, required: true }
});

const featuredEvents = computed(() => {
  const seen = new Set();
  return props.visibleEvents.filter((event) => {
    if (seen.has(event.step)) return false;
    seen.add(event.step);
    return true;
  }).slice(0, 3);
});
const compactSteps = computed(() => props.statusSteps);
const createdAt = computed(() => new Date(props.selected.project.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }));
const providerSummary = computed(() => {
  const providers = new Set(props.selectedImageScenes.map((scene) => scene.materialProvider).filter(Boolean));
  return providers.size ? Array.from(providers).join(", ") : "hazırlanıyor";
});

function eventStepLabel(step) {
  const labels = {
    queue: "Kuyruk",
    story: "Hikaye",
    scenes: "Sahne",
    visuals: "Görsel",
    audio: "Ses",
    subtitles: "Altyazı",
    video: "Video"
  };
  return labels[step] ?? step;
}
</script>

<template>
  <section class="detail-grid output-grid">
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

    <aside class="output-panel depth-card">
      <!-- Bu panel sunum kanıtıdır: MongoDB proje id'si, üretilen medya dosyaları ve pipeline logları burada görünür. -->
      <div class="output-hero">
        <div>
          <span class="eyebrow">Üretim özeti</span>
          <h2>{{ selected.project.title }}</h2>
        </div>
        <span class="output-status"><CheckCircle2 :size="15" /> {{ statusLabel(selected.project.status) }}</span>
      </div>

      <div class="proof-strip">
        <div class="proof-item wide">
          <Database :size="16" />
          <span>
            <small>MongoDB / projects</small>
            <strong>{{ selected.project._id }}</strong>
          </span>
        </div>
        <div class="proof-item">
          <Clock3 :size="16" />
          <span>
            <small>Kayıt</small>
            <strong>{{ createdAt }}</strong>
          </span>
        </div>
      </div>

      <div class="pipeline-card">
        <div class="pipeline-head">
          <strong>Pipeline</strong>
          <span>{{ progressPercent }}%</span>
        </div>
        <div class="pipeline-track" :style="{ '--progress': `${progressPercent}%` }"></div>
        <div class="mini-pipeline compact">
          <span
            v-for="(step, index) in compactSteps"
            :key="step"
            :class="{ done: statusSteps.indexOf(step) <= currentStepIndex || selected.project.status === 'completed', active: step === selected.project.status }"
          >
            <i>{{ index + 1 }}</i>
            {{ statusLabel(step) }}
          </span>
        </div>
      </div>

      <div class="asset-summary">
        <div class="asset-summary-card">
          <Image :size="17" />
          <span>
            <small>Görsel kaynak</small>
            <strong>{{ providerSummary }}</strong>
          </span>
        </div>
        <div class="asset-summary-card">
          <Mic2 :size="17" />
          <span>
            <small>Seslendirme</small>
            <strong>{{ selectedAudioAsset?.provider || "hazırlanıyor" }}</strong>
          </span>
        </div>
      </div>

      <div class="output-section visual-section">
        <div class="output-section-head">
          <strong>Görseller</strong>
          <span>{{ selectedImageScenes.length }} sahne</span>
        </div>
        <div class="output-images">
          <article v-for="scene in selectedImageScenes" :key="scene._id" class="output-image-card">
            <img :src="assetUrl(scene.imagePath || scene.materialPath)" :alt="`Sahne ${scene.order}`" />
            <div>
              <strong>{{ scene.order }}</strong>
              <small>{{ scene.materialProvider || "bekleniyor" }}</small>
            </div>
          </article>
        </div>
      </div>

      <div class="output-section audio-section">
        <div class="output-section-head">
          <strong>Ses</strong>
          <span>{{ selectedAudio ? "hazır" : "bekleniyor" }}</span>
        </div>
        <audio v-if="selectedAudio" :src="assetUrl(selectedAudio)" controls />
        <div v-else class="audio-empty">Ses dosyası hazırlanıyor.</div>
      </div>

      <div class="output-section log-section">
        <div class="output-section-head">
          <strong><TerminalSquare :size="15" /> Son akış</strong>
          <span>{{ featuredEvents.length }} olay</span>
        </div>
        <div class="event-list">
          <div v-for="event in featuredEvents" :key="event._id">
            <span>{{ eventStepLabel(event.step) }}</span>
            <small>{{ event.message }}</small>
          </div>
        </div>
      </div>
    </aside>
  </section>
</template>
