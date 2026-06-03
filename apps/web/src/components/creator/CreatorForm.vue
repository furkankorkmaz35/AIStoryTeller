<script setup>
import { Play, Wand2 } from "lucide-vue-next";

defineProps({
  form: { type: Object, required: true },
  creating: { type: Boolean, default: false },
  error: { type: String, default: "" }
});

const emit = defineEmits(["submit", "toggleSubtitles"]);
</script>

<template>
  <!-- Kullanıcının kafası karışmasın diye form sade tutuldu: bir prompt alanı, altyazı seçimi ve tek oluştur butonu. -->
  <form class="creator-panel composer-card depth-card" @submit.prevent="emit('submit')">
    <div class="composer-head">
      <div class="section-title">
        <Wand2 :size="20" />
        <span>Prompttan video</span>
      </div>
    </div>

    <label class="prompt-box">
      <span>Prompt</span>
      <textarea v-model="form.theme" rows="5" placeholder="Ne üretmek istiyorsun? Örnek: A boy sees a white cat on the street." />
    </label>

    <div class="switch-row">
      <button type="button" class="switch-card" :class="{ active: form.subtitlesEnabled }" @click="emit('toggleSubtitles')">
        <span class="switch-knob"></span>
        <strong>Altyazı</strong>
        <small>{{ form.subtitlesEnabled ? "Videoda gösterilecek" : "Sadece ses ve görsel akış" }}</small>
      </button>
    </div>

    <button class="generate-button" :disabled="creating">
      <Play :size="18" />
      {{ creating ? "Video hazırlanıyor" : "Videoyu oluştur" }}
    </button>
    <p v-if="error" class="error-text">{{ error }}</p>
  </form>
</template>
