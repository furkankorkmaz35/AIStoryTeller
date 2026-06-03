import { ref } from "vue";
import { getSystemStatus } from "../lib/api";

export function useSystemStatus() {
  const systemStatus = ref(null);

  // Reads provider/key/queue status for the small health indicators in the UI.
  async function refreshSystemStatus() {
    try {
      systemStatus.value = await getSystemStatus();
    } catch {
      systemStatus.value = null;
    }
  }

  return { systemStatus, refreshSystemStatus };
}
