<script setup>
import { Zap } from "lucide-vue-next";

defineProps({
  systemStatus: { type: Object, default: null }
});
</script>

<template>
  <!-- İlk ekranda projenin amacı ve stüdyo durumu görünür; sunumda uygulamanın hazır olup olmadığı hemen anlaşılır. -->
  <header class="topbar">
    <div>
      <span class="eyebrow">Creative video studio</span>
      <h1>Hikayeni gösterişli bir videoya dönüştür.</h1>
      <p class="hero-copy">Tema seç, tonu belirle, gerisini stüdyo akışı hazırlasın.</p>
    </div>
    <div class="live-pill"><Zap :size="16" /> {{ systemStatus?.ok ? "Stüdyo hazır" : "Stüdyo hazırlanıyor" }}</div>
  </header>
</template>
