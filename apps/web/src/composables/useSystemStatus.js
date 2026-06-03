import { ref } from "vue";
import { getSystemStatus } from "../lib/api";

export function useSystemStatus() {
  const systemStatus = ref(null);

  // Provider, API key ve kuyruk durumunu okur; üstteki küçük sağlık göstergeleri bu verilerle güncellenir.
  async function refreshSystemStatus() {
    try {
      systemStatus.value = await getSystemStatus();
    } catch {
      systemStatus.value = null;
    }
  }

  return { systemStatus, refreshSystemStatus };
}
