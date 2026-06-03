import { computed, ref } from "vue";
import { createProject, getProject, listProjects } from "../lib/api";
import { statusSteps } from "../constants/projectStatus";

export function useProjectStudio() {
  // Central state for the creator screen; components stay presentational and small.
  const projects = ref([]);
  const selected = ref(null);
  const loading = ref(false);
  const creating = ref(false);
  const galleryPage = ref(1);
  const error = ref("");
  const apiError = ref("");
  const form = ref({
    theme: "Kalem tanıtımı için doğal UGC reklam: masada not alan biri, hızlı yazım, sade CTA.",
    subtitlesEnabled: true
  });

  // Derived media fields feed the output panel without duplicating selection logic in Vue templates.
  const selectedVideo = computed(() => selected.value?.project.videoPath ?? "");
  const selectedAudio = computed(() => selected.value?.project.audioPath ?? selected.value?.assets.find((asset) => asset.type === "audio")?.path ?? "");
  const selectedImageScenes = computed(() => selected.value?.scenes.filter((scene) => scene.imagePath || scene.materialPath) ?? []);
  const selectedAudioAsset = computed(() => selected.value?.assets.find((asset) => asset.type === "audio" && asset.path === selectedAudio.value) ?? selected.value?.assets.find((asset) => asset.type === "audio") ?? null);
  const visibleEvents = computed(() => selected.value?.events.slice(-7).reverse() ?? []);
  const galleryPageSize = 4;
  const galleryPageCount = computed(() => Math.max(1, Math.ceil(projects.value.length / galleryPageSize)));
  const pagedProjects = computed(() => {
    const start = (galleryPage.value - 1) * galleryPageSize;
    return projects.value.slice(start, start + galleryPageSize);
  });
  const completedCount = computed(() => projects.value.filter((project) => project.status === "completed").length);
  const activeCount = computed(() => projects.value.filter((project) => !["completed", "failed"].includes(project.status)).length);
  const totalSceneCount = computed(() => projects.value.reduce((total, project) => total + project.sceneCount, 0));
  const currentStepIndex = computed(() => {
    if (!selected.value) return -1;
    if (selected.value.project.status === "failed") return statusSteps.length - 1;
    return statusSteps.indexOf(selected.value.project.status);
  });
  const progressPercent = computed(() => {
    if (!selected.value) return 0;
    return Math.max(0, Math.round((currentStepIndex.value / (statusSteps.length - 1)) * 100));
  });

  // Refresh also re-hydrates the selected project, so pipeline progress updates during rendering.
  async function refreshProjects() {
    try {
      apiError.value = "";
      projects.value = await listProjects();
      galleryPage.value = Math.min(galleryPage.value, galleryPageCount.value);
      if (!selected.value && projects.value[0]) {
        await selectProject(projects.value[0]._id);
      } else if (selected.value) {
        await selectProject(selected.value.project._id, false);
      }
    } catch (refreshError) {
      apiError.value = refreshError instanceof Error ? refreshError.message : "API bağlantısı kurulamadı.";
    }
  }

  function changeGalleryPage(direction) {
    galleryPage.value = Math.min(galleryPageCount.value, Math.max(1, galleryPage.value + direction));
  }

  // Loads MongoDB detail document plus related scenes, assets and job logs for the proof panel.
  async function selectProject(id, showLoader = true) {
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

  // Starts the backend BullMQ pipeline; all heavy work continues in the worker.
  async function submitProject() {
    creating.value = true;
    error.value = "";
    try {
      const project = await createProject({ ...form.value });
      await refreshProjects();
      await selectProject(project._id);
    } catch (createError) {
      error.value = createError instanceof Error ? createError.message : "Beklenmeyen hata";
    } finally {
      creating.value = false;
    }
  }

  return {
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
  };
}
