<template>
  <v-table density="compact">
    <thead>
      <tr>
        <th>{{ t("consolidata.history.date") }}</th>
        <th>{{ t("consolidata.history.action") }}</th>
        <th>{{ t("consolidata.history.user") }}</th>
        <th>{{ t("consolidata.history.detail") }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="e in log" :key="e.id">
        <td class="text-no-wrap">{{ shortDate(e.datetime) }}</td>
        <td>{{ e.azione }}</td>
        <td>#{{ e.user }}</td>
        <td class="text-caption">{{ brief(e.dopo) }}</td>
      </tr>
      <tr v-if="!log.length">
        <td colspan="4" class="text-center text-medium-emphasis py-4">
          {{ t("consolidata.history.empty") }}
        </td>
      </tr>
    </tbody>
  </v-table>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useConsolidataStore } from "../stores/consolidata.store";
import { shortDate } from "../logic";

const { t } = useI18n();
const store = useConsolidataStore();
const log = computed(() => store.project?.log ?? []);

function brief(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}
</script>
