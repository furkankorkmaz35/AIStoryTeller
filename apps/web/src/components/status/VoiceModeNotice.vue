<script setup>
import { Mic2 } from "lucide-vue-next";
</script>

<template>
  <!-- Makes the active voice strategy explicit without exposing provider configuration controls. -->
  <section class="notice-card depth-card voice-note">
    <Mic2 :size="20" />
    <div>
      <strong>Ses modu: ElevenLabs Türkçe</strong>
      <span>Edge TTS otomatik fallback olarak kullanılmaz; ElevenLabs başarısız olursa sessiz fallback devreye girer.</span>
    </div>
  </section>
</template>
