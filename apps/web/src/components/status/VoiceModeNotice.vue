<script setup>
import { Mic2 } from "lucide-vue-next";
</script>

<template>
  <!-- Ses stratejisini sade biçimde açıklar; kullanıcı provider ayarlarıyla uğraşmadan ElevenLabs modunu görür. -->
  <section class="notice-card depth-card voice-note">
    <Mic2 :size="20" />
    <div>
      <strong>Ses modu: ElevenLabs Türkçe</strong>
      <span>Edge TTS otomatik fallback olarak kullanılmaz; ElevenLabs başarısız olursa sessiz fallback devreye girer.</span>
    </div>
  </section>
</template>
