<script setup>
import { Cpu, Image, Layers3 } from "lucide-vue-next";

defineProps({
  systemStatus: { type: Object, default: null }
});
</script>

<template>
  <!-- Compact infrastructure strip: useful for showing MongoDB/queue status during presentation. -->
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
</template>
