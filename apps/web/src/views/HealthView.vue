<script setup lang="ts">
// Job: the health screen: one row per service and a "Check again" button.
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { SERVICES } from '../api/health';
import { useHealthStore, type RowState } from '../stores/health';

const { t, te } = useI18n();
const health = useHealthStore();

onMounted(() => {
  void health.checkAll();
});

const statusKey = {
  CHECKING: 'health.status.checking',
  UP: 'health.status.up',
  DOWN: 'health.status.down',
} as const;

const statusClass = {
  CHECKING: 'text-on-surface-muted',
  UP: 'text-success',
  DOWN: 'text-danger',
} as const;

// The message for a Down row, from the error code; never the server's own text.
function downMessage(row: RowState): string {
  if (row.status !== 'DOWN') return '';
  const key = `errors.${row.code}`;
  return te(key) ? t(key) : t('errors.UNKNOWN');
}
</script>

<template>
  <main
    class="mx-auto max-w-xl p-6"
    data-test="health-view"
  >
    <h1 class="text-2xl font-semibold">
      {{ t('health.title') }}
    </h1>
    <ul
      class="mt-6 divide-y divide-border rounded-lg border border-border bg-surface-muted"
      aria-live="polite"
    >
      <li
        v-for="service in SERVICES"
        :key="service"
        class="flex items-start justify-between gap-4 p-4"
        :data-test="`row-${service}`"
      >
        <span class="font-medium">{{ t(`health.services.${service}`) }}</span>
        <span class="text-right">
          <span
            :class="statusClass[health.rows[service].status]"
            data-test="status"
          >{{ t(statusKey[health.rows[service].status]) }}</span>
          <span
            v-if="health.rows[service].status === 'DOWN'"
            class="block text-sm text-on-surface-muted"
            data-test="message"
          >{{ downMessage(health.rows[service]) }}</span>
        </span>
      </li>
    </ul>
    <button
      type="button"
      class="mt-6 rounded-md bg-primary px-4 py-2 text-on-primary disabled:opacity-50"
      :disabled="health.checking"
      data-test="check-again"
      @click="health.checkAll()"
    >
      {{ t('health.checkAgain') }}
    </button>
  </main>
</template>
