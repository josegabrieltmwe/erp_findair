<template>
  <div>
    <v-progress-linear v-if="store.logLoading" indeterminate class="mb-2" />
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
        <tr v-for="e in rows" :key="e.id">
          <td class="text-no-wrap">{{ shortDate(e.datetime) }}</td>
          <td>
            {{ actionLabel(e.azione) }}
            <span v-if="e.id_tratta" class="text-caption text-medium-emphasis">
              · {{ t("consolidata.history.leg", { id: e.id_tratta }) }}
            </span>
          </td>
          <td>{{ e.user_nome || `#${e.user}` }}</td>
          <td class="text-caption cons-hist-detail">
            <template v-if="hasValue(e.prima)">
              <span class="text-medium-emphasis">{{ brief(e.prima) }}</span>
              →
            </template>
            {{ brief(e.dopo) }}
          </td>
        </tr>
        <tr v-if="!rows.length && !store.logLoading">
          <td colspan="4" class="text-center text-medium-emphasis py-4">
            {{ t("consolidata.history.empty") }}
          </td>
        </tr>
      </tbody>
    </v-table>
    <div v-if="maxPage > 1" class="d-flex justify-end mt-2">
      <v-pagination
        :model-value="page"
        :length="maxPage"
        density="comfortable"
        total-visible="5"
        @update:model-value="go"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useConsolidataStore } from "../stores/consolidata.store";
import { logActionI18nKey, shortDate } from "../logic";

const { t } = useI18n();
const store = useConsolidataStore();
const rows = computed(() => store.logPage?.items ?? []);
const page = computed(() => store.logPage?.current_page ?? 1);
const maxPage = computed(() => store.logPage?.max_page ?? 1);

function actionLabel(code: string): string {
  const key = logActionI18nKey(code);
  return key ? t(key) : code;
}

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

function brief(v: unknown): string {
  if (!hasValue(v)) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

function go(p: number): void {
  void store.loadLog(p);
}

onMounted(() => {
  if (!store.logPage) void store.loadLog(1);
});
</script>

<style scoped>
.cons-hist-detail {
  word-break: break-word;
}
</style>
