// Job: the health of auth, chat and ai. One round of checks at a time, run in parallel.
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { checkHealth, SERVICES, type HealthResult, type ServiceName } from '../api/health';

export type RowState = { status: 'CHECKING' } | HealthResult;

export const useHealthStore = defineStore('health', () => {
  const rows = reactive(
    Object.fromEntries(SERVICES.map((s) => [s, { status: 'CHECKING' }])) as Record<ServiceName, RowState>,
  );
  const checking = ref(false);

  async function checkAll(): Promise<void> {
    if (checking.value) return;
    checking.value = true;
    for (const service of SERVICES) rows[service] = { status: 'CHECKING' };
    try {
      await Promise.all(
        SERVICES.map(async (service) => {
          rows[service] = await checkHealth(service);
        }),
      );
    } finally {
      checking.value = false;
    }
  }

  return { rows, checking, checkAll };
});
