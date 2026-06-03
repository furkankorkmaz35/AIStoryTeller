<script setup>
defineProps({
  projectsCount: { type: Number, default: 0 },
  completedCount: { type: Number, default: 0 },
  activeCount: { type: Number, default: 0 },
  activeQueueCount: { type: Number, default: 0 },
  totalSceneCount: { type: Number, default: 0 }
});
</script>

<template>
  <!-- Small counters summarize what is stored and what is still processing. -->
  <section class="studio-metrics" aria-label="Stüdyo özeti">
    <div class="metric-card depth-card">
      <span>Videolar</span>
      <strong>{{ projectsCount }}</strong>
      <small>{{ completedCount }} tanesi hazır</small>
    </div>
    <div class="metric-card depth-card">
      <span>Devam eden</span>
      <strong>{{ activeCount }}</strong>
      <small>{{ activeQueueCount }} video işleniyor</small>
    </div>
    <div class="metric-card depth-card">
      <span>Sahneler</span>
      <strong>{{ totalSceneCount }}</strong>
      <small>Toplam taslak</small>
    </div>
  </section>
</template>
