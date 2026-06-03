<script setup>
import { Clapperboard, Film, Layers3, Sparkles } from "lucide-vue-next";

defineProps({
  projectsCount: { type: Number, default: 0 },
  systemStatus: { type: Object, default: null }
});
</script>

<template>
  <!-- Sol menü uygulamanın stüdyo hissini verir; alttaki küçük gösterge kuyruk/veritabanı durumunu özetler. -->
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
      <strong>{{ systemStatus?.queue?.waiting ?? projectsCount }}</strong>
      <small>Hazırlanan video</small>
      <div class="mini-health">
        <span :class="{ online: systemStatus?.database === 'connected' }"></span>
        Stüdyo hazır
      </div>
    </section>
  </aside>
</template>
