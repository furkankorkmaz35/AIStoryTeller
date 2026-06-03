import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

// Vue uygulamasını başlatır; ekran akışı App.vue'dan, veri/iş mantığı ise composable dosyalarından yönetilir.
createApp(App).mount("#app");
