<script setup>
import { Film, Sparkles } from "lucide-vue-next";
import { assetUrl } from "../../lib/api";

defineProps({
  projects: { type: Array, default: () => [] },
  pagedProjects: { type: Array, default: () => [] },
  selectedProjectId: { type: String, default: "" },
  galleryPage: { type: Number, required: true },
  galleryPageCount: { type: Number, required: true },
  galleryPageSize: { type: Number, required: true },
  statusLabel: { type: Function, required: true },
  projectProgress: { type: Function, required: true }
});

const emit = defineEmits(["select", "changePage"]);
</script>

<template>
  <!-- Sayfalama, eski demo videolarını saklar ama galeri listesinin sayfayı gereksiz uzatmasını engeller. -->
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
      v-for="project in pagedProjects"
      :key="project._id"
      class="project-card depth-card"
      :class="{ selected: selectedProjectId === project._id }"
      @click="emit('select', project._id)"
    >
      <div v-if="project.thumbnailPath" class="project-thumb">
        <img :src="assetUrl(project.thumbnailPath)" :alt="project.title" />
      </div>
      <div v-else class="project-thumb empty-thumb">
        <Film :size="18" />
      </div>
      <div class="project-card-copy">
        <span class="status-badge">{{ statusLabel(project.status) }}</span>
        <h3>{{ project.title }}</h3>
        <div class="project-meta compact">
          <small>{{ new Date(project.createdAt).toLocaleDateString("tr-TR") }}</small>
        </div>
      </div>
      <div class="project-progress">
        <span :style="{ width: `${projectProgress(project.status)}%` }"></span>
      </div>
    </div>
    <div v-if="projects.length > galleryPageSize" class="gallery-pager depth-card">
      <button type="button" :disabled="galleryPage === 1" @click="emit('changePage', -1)">
        Önceki
      </button>
      <span>{{ galleryPage }} / {{ galleryPageCount }}</span>
      <button type="button" :disabled="galleryPage === galleryPageCount" @click="emit('changePage', 1)">
        Sonraki
      </button>
    </div>
  </section>
</template>
