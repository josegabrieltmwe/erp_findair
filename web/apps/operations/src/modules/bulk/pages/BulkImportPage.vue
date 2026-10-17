<template>
  <div class="bk-page">
    <!-- ── Selector de modo ────────────────────────────────── -->
    <div class="bk-modebar">
      <span class="bk-mode-label">{{ t("bulk.bulk.mode") }}:</span>
      <v-btn-toggle
        :model-value="store.mode"
        mandatory
        density="comfortable"
        color="primary"
        @update:model-value="onMode"
      >
        <v-btn value="express" prepend-icon="mdi-truck-fast">{{
          t("bulk.bulk.express")
        }}</v-btn>
        <v-btn value="cargo" prepend-icon="mdi-airplane">{{
          t("bulk.bulk.cargo")
        }}</v-btn>
      </v-btn-toggle>
    </div>

    <!-- ── Stepper ─────────────────────────────────────────── -->
    <v-stepper
      :model-value="store.step"
      flat
      class="bk-stepper"
      :items="stepItems"
      hide-actions
    >
      <!-- Paso 1: pegar datos -->
      <template #[`item.1`]>
        <div class="bk-step">
          <p v-if="store.mapping" class="bk-hint">
            {{ t("bulk.bulk.pasteHint", { cols: mappingCols }) }}
          </p>
          <p v-if="store.mapping" class="bk-hint bk-muted">
            {{ t("bulk.bulk.maxRows", { n: store.mapping.max_rows }) }}
          </p>
          <v-textarea
            v-model="store.csvData"
            :label="t('bulk.bulk.pasteLabel')"
            rows="8"
            auto-grow
            class="bk-mono"
          />
          <div class="bk-row">
            <v-text-field
              v-model="store.delimiter"
              :label="t('bulk.bulk.delimiter')"
              maxlength="1"
              style="max-width: 120px"
            />
            <v-spacer />
            <v-btn
              color="primary"
              :loading="store.loading"
              :disabled="!store.csvData.trim()"
              @click="store.runPreview()"
            >
              {{ t("bulk.bulk.validate") }}
            </v-btn>
          </div>
        </div>
      </template>

      <!-- Paso 2: preview -->
      <template #[`item.2`]>
        <div v-if="store.preview" class="bk-step">
          <div class="bk-summary">
            <v-chip color="success" label>{{
              store.preview.summary.valid
            }}</v-chip>
            <v-chip
              :color="store.preview.summary.invalid ? 'error' : 'default'"
              label
            >
              {{ store.preview.summary.invalid }}
            </v-chip>
            <span class="bk-muted">
              {{
                t("bulk.bulk.summary", {
                  valid: store.preview.summary.valid,
                  invalid: store.preview.summary.invalid,
                  total: store.preview.summary.total,
                })
              }}
            </span>
          </div>

          <!-- Errores -->
          <div v-if="store.preview.errors.length" class="bk-errors">
            <h4>{{ t("bulk.bulk.errorsTitle") }}</h4>
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="bk-col-row">{{ t("bulk.bulk.rowCol") }}</th>
                  <th>{{ t("bulk.bulk.messageCol") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(e, i) in store.preview.errors" :key="i">
                  <td>{{ e.row }}</td>
                  <td>{{ e.messages.join("; ") }}</td>
                </tr>
              </tbody>
            </v-table>
          </div>

          <!-- Vista previa filas válidas -->
          <div v-if="validHeaders.length" class="bk-valid">
            <h4>{{ t("bulk.bulk.previewTitle") }}</h4>
            <div class="bk-table-scroll">
              <v-table density="compact">
                <thead>
                  <tr>
                    <th v-for="h in validHeaders" :key="h">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in previewRows" :key="i">
                    <td v-for="h in validHeaders" :key="h">{{ r[h] }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </div>

          <div class="bk-row">
            <v-btn variant="text" @click="store.reset()">{{
              t("common.back")
            }}</v-btn>
            <v-spacer />
            <v-btn
              color="primary"
              :loading="store.importing"
              :disabled="!store.preview.summary.valid"
              @click="store.runImport()"
            >
              {{ t("bulk.bulk.import", { n: store.preview.summary.valid }) }}
            </v-btn>
          </div>
        </div>
      </template>

      <!-- Paso 3: resultado -->
      <template #[`item.3`]>
        <div v-if="store.result" class="bk-step bk-result">
          <v-icon icon="mdi-check-circle" color="success" size="48" />
          <p class="bk-result-msg">
            {{ t("bulk.bulk.imported", { n: store.result.imported }) }}
          </p>
          <p v-if="store.result.errors.length" class="bk-result-err">
            {{ t("bulk.bulk.importErrors", { n: store.result.errors.length }) }}
          </p>
          <v-btn color="primary" variant="tonal" @click="store.reset()">
            {{ t("bulk.bulk.startOver") }}
          </v-btn>
        </div>
      </template>
    </v-stepper>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useBulkStore } from "../stores/bulk.store";
import type { BulkMode } from "../types";

const { t } = useI18n();
const store = useBulkStore();

const stepItems = computed(() => [
  t("bulk.bulk.step1"),
  t("bulk.bulk.step2"),
  t("bulk.bulk.step3"),
]);

const mappingCols = computed(() =>
  store.mapping ? Object.keys(store.mapping.default_mapping).join(", ") : "",
);

const validHeaders = computed(() => {
  const rows = store.preview?.valid_rows ?? [];
  return rows.length ? Object.keys(rows[0]) : [];
});

const previewRows = computed(() =>
  (store.preview?.valid_rows ?? []).slice(0, 20),
);

function onMode(m: BulkMode): void {
  store.setMode(m);
  void store.loadMapping();
}

onMounted(() => {
  void store.loadMapping();
});
</script>

<style scoped>
.bk-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.bk-modebar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bk-mode-label {
  color: var(--cm-text-secondary, #64748b);
  font-weight: 600;
}
.bk-stepper {
  background: transparent;
}
.bk-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}
.bk-hint {
  margin: 0;
  font-size: 0.9rem;
}
.bk-muted {
  color: var(--cm-text-secondary, #64748b);
}
.bk-mono :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
}
.bk-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bk-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bk-errors h4,
.bk-valid h4 {
  font-size: 0.95rem;
  margin: 12px 0 6px;
}
.bk-col-row {
  width: 70px;
}
.bk-table-scroll {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--cm-line, #e2e8f0);
  border-radius: 8px;
}
.bk-result {
  align-items: center;
  text-align: center;
  padding: 32px 0;
}
.bk-result-msg {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 8px 0;
}
.bk-result-err {
  color: var(--cm-text-secondary, #b45309);
  margin: 0 0 12px;
}
</style>
