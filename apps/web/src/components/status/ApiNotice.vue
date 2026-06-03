<script setup>
import { AlertTriangle, RefreshCw } from "lucide-vue-next";

defineProps({
  apiError: { type: String, default: "" }
});

const emit = defineEmits(["refresh"]);
</script>

<template>
  <!-- API, MongoDB veya Redis erişilemezse görünür; kullanıcıya sistemin beklediğini net şekilde anlatır. -->
  <section v-if="apiError" class="notice-card depth-card">
    <AlertTriangle :size="20" />
    <div>
      <strong>API bağlantısı bekleniyor</strong>
      <span>{{ apiError }} MongoDB/Redis ve Express API çalıştığında ekran otomatik yenilenir.</span>
    </div>
    <button @click="emit('refresh')"><RefreshCw :size="16" /> Yenile</button>
  </section>
</template>
