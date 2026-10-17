<template>
  <v-menu :close-on-content-click="false" location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        icon="mdi-history"
        size="x-small"
        variant="text"
        density="comfortable"
        :title="title"
        @click="onOpen"
      />
    </template>

    <v-card min-width="280" max-width="420">
      <v-card-title class="text-caption text-medium-emphasis py-2 px-3 d-flex align-center">
        <v-icon icon="mdi-history" size="14" class="me-1" />
        {{ title }}
      </v-card-title>
      <v-divider />

      <v-progress-linear v-if="loading" indeterminate />

      <v-list v-else-if="rows.length" density="compact" max-height="320" class="overflow-y-auto py-0">
        <v-list-item v-for="(r, i) in rows" :key="i" class="py-1">
          <template #default>
            <div class="d-flex align-center justify-space-between">
              <span class="metric-mono text-body-2">{{ display(r.valore_old) }}</span>
              <span class="text-caption text-medium-emphasis ms-3">{{ shortDate(r.ts) }}</span>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ r.user_name || ('ID:' + r.user) }}
            </div>
          </template>
        </v-list-item>
      </v-list>

      <v-card-text v-else class="text-caption text-medium-emphasis py-3 px-3">
        {{ t("common.field_history_empty") }}
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref } from 'vue';

const { t } = useI18n();

/**
 * Per-field modification history popover — shared by cargo and shipment.
 * Replaces the legacy log_modifiche.php / ShowLogMod inline history. The host
 * injects a `fetcher` that calls its own audit service filtered by field
 * (api_cargo_audit?campo=… / api_shipment_audit?campo=…). Store-agnostic.
 */
export interface FieldHistoryRow {
  valore_old: string | null;
  valore_new?: string | null;
  ts: string;
  user: string;
  user_name: string | null;
}

const props = defineProps<{
  /** Human label for the field (shown in the popover header). */
  label?: string;
  /** Lazily fetch the field history (called on open). */
  fetcher: () => Promise<FieldHistoryRow[]>;
}>();

const title = props.label ? `Storico: ${props.label}` : 'Storico modifiche';
const rows = ref<FieldHistoryRow[]>([]);
const loading = ref(false);
let loaded = false;

async function onOpen(): Promise<void> {
  if (loaded) return;
  loading.value = true;
  try {
    rows.value = await props.fetcher();
    loaded = true;
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function display(v: string | null): string {
  if (v === null || v === '') return '∅';
  return v;
}

function shortDate(ts: string): string {
  return String(ts ?? '').slice(0, 16).replace('T', ' ');
}
</script>

<style scoped>
.metric-mono { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
</style>
