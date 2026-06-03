<script setup>
import { onMounted, onUnmounted } from "vue";
import { Film } from "lucide-vue-next";
import CreatorForm from "./components/creator/CreatorForm.vue";
import ProjectGallery from "./components/gallery/ProjectGallery.vue";
import SidebarNav from "./components/layout/SidebarNav.vue";
import StudioHeader from "./components/layout/StudioHeader.vue";
import ProductionOutputPanel from "./components/output/ProductionOutputPanel.vue";
import ApiNotice from "./components/status/ApiNotice.vue";
import StudioMetrics from "./components/status/StudioMetrics.vue";
import SystemStrip from "./components/status/SystemStrip.vue";
import VoiceModeNotice from "./components/status/VoiceModeNotice.vue";
import { useProjectStudio } from "./composables/useProjectStudio";
import { useSystemStatus } from "./composables/useSystemStatus";
import { projectProgress, statusLabel, statusSteps } from "./constants/projectStatus";

let pollTimer;

const {
  activeCount,
  apiError,
  changeGalleryPage,
  completedCount,
  creating,
  currentStepIndex,
  error,
  form,
  galleryPage,
  galleryPageCount,
  galleryPageSize,
  loading,
  pagedProjects,
  progressPercent,
  projects,
  refreshProjects,
  selectProject,
  selected,
  selectedAudio,
  selectedAudioAsset,
  selectedImageScenes,
  selectedVideo,
  submitProject,
  totalSceneCount,
  visibleEvents
} = useProjectStudio();

const { systemStatus, refreshSystemStatus } = useSystemStatus();

// Keeps gallery, selected project detail and queue health fresh while the video is rendering.
async function refreshWorkspace() {
  await Promise.all([refreshProjects(), refreshSystemStatus()]);
}

onMounted(async () => {
  await refreshWorkspace();
  pollTimer = window.setInterval(() => {
    void refreshWorkspace();
  }, 3500);
});

onUnmounted(() => {
  if (pollTimer) window.clearInterval(pollTimer);
});
</script>

<template>
  <main class="app-shell">
    <SidebarNav :projects-count="projects.length" :system-status="systemStatus" />

    <section class="workspace">
      <StudioHeader :system-status="systemStatus" />

      <StudioMetrics
        :projects-count="projects.length"
        :completed-count="completedCount"
        :active-count="activeCount"
        :active-queue-count="systemStatus?.queue?.active ?? 0"
        :total-scene-count="totalSceneCount"
      />

      <SystemStrip :system-status="systemStatus" />
      <VoiceModeNotice />
      <ApiNotice :api-error="apiError" @refresh="refreshProjects" />

      <section class="creator-grid">
        <CreatorForm :form="form" :creating="creating" :error="error" @submit="submitProject" @toggle-subtitles="form.subtitlesEnabled = !form.subtitlesEnabled" />
        <ProjectGallery
          :projects="projects"
          :paged-projects="pagedProjects"
          :selected-project-id="selected?.project._id"
          :gallery-page="galleryPage"
          :gallery-page-count="galleryPageCount"
          :gallery-page-size="galleryPageSize"
          :status-label="statusLabel"
          :project-progress="projectProgress"
          @select="selectProject"
          @change-page="changeGalleryPage"
        />
      </section>

      <ProductionOutputPanel
        v-if="selected"
        :selected="selected"
        :selected-video="selectedVideo"
        :selected-audio="selectedAudio"
        :selected-audio-asset="selectedAudioAsset"
        :selected-image-scenes="selectedImageScenes"
        :visible-events="visibleEvents"
        :loading="loading"
        :progress-percent="progressPercent"
        :current-step-index="currentStepIndex"
        :status-steps="statusSteps"
        :status-label="statusLabel"
      />

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
