<template>
  <div class="rec-page">
    <div class="rec-toolbar">
      <v-btn variant="text" icon="mdi-arrow-left" :to="{ name: 'payments' }" />
      <h1 class="text-h6 mb-0">{{ t("payments.reconciliation.title") }}</h1>
    </div>

    <v-card variant="flat" class="rec-card">
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ t("payments.reconciliation.intro") }}
        </p>
        <div class="rec-upload">
          <v-file-input
            v-model="file"
            :label="t('payments.reconciliation.file')"
            accept=".sta,.mt940,.xml,.csv,.txt"
            density="comfortable"
            variant="outlined"
            prepend-icon=""
            prepend-inner-icon="mdi-paperclip"
            hide-details
            class="rec-file"
            :rules="[
              (f) =>
                !f || !fileTooBig(f) || t('payments.reconciliation.too_big'),
            ]"
          />
          <v-select
            v-model="format"
            :items="formatItems"
            :label="t('payments.reconciliation.format')"
            density="comfortable"
            variant="outlined"
            hide-details
            class="rec-format"
          />
          <v-text-field
            v-if="format === 'csv'"
            v-model="delimiter"
            :label="t('payments.reconciliation.delimiter')"
            maxlength="1"
            density="comfortable"
            variant="outlined"
            hide-details
            class="rec-delim"
          />
          <v-btn
            color="primary"
            prepend-icon="mdi-magnify"
            :loading="store.analyzing"
            :disabled="!singleFile || fileTooBig(singleFile)"
            @click="analyze"
          >
            {{ t("payments.reconciliation.analyze") }}
          </v-btn>
        </div>
        <v-alert
          v-if="store.error"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          {{ store.error }}
        </v-alert>
      </v-card-text>
    </v-card>

    <template v-if="store.analysis">
      <v-alert type="info" variant="tonal" density="compact">
        {{
          t("payments.reconciliation.summary", {
            matched: store.analysis.matched.length,
            unmatched: store.analysis.unmatched.length,
          })
        }}
      </v-alert>

      <!-- Resultado de la confirmación -->
      <v-alert
        v-if="store.result"
        :type="store.result.errors.length ? 'warning' : 'success'"
        variant="tonal"
        density="compact"
      >
        <div>
          {{
            t("payments.reconciliation.confirmed", {
              count: store.result.confirmed,
            })
          }}
        </div>
        <ul v-if="store.result.errors.length" class="rec-errors">
          <li v-for="e in store.result.errors" :key="e.pagamento_id">
            #{{ e.pagamento_id }}: {{ e.error }}
          </li>
        </ul>
      </v-alert>

      <v-card v-if="store.lines.length" variant="flat" class="rec-card">
        <v-card-title class="d-flex align-center text-subtitle-1">
          {{ t("payments.reconciliation.matched_title") }}
          <v-chip size="x-small" class="ms-2" variant="tonal">{{
            store.lines.length
          }}</v-chip>
          <v-spacer />
          <v-btn
            v-if="caps.canReconcile"
            color="primary"
            prepend-icon="mdi-check-all"
            :loading="store.confirming"
            :disabled="!store.canConfirm"
            @click="confirm"
          >
            {{
              t("payments.reconciliation.confirm", {
                count: store.acceptedCount,
              })
            }}
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-table density="comfortable" class="rec-table">
          <thead>
            <tr>
              <th></th>
              <th>{{ t("payments.reconciliation.col_movement") }}</th>
              <th>{{ t("payments.col.invoice") }}</th>
              <th class="text-end">
                {{ t("payments.reconciliation.col_installment") }}
              </th>
              <th class="text-end">
                {{ t("payments.reconciliation.col_apply") }}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="l in store.lines"
              :key="l.key"
              :class="{ 'rec-row--off': !l.accepted }"
            >
              <td>
                <v-checkbox-btn
                  v-model="l.accepted"
                  :disabled="!caps.canReconcile"
                />
              </td>
              <td>
                <div>
                  {{ l.item.transaction.date }} ·
                  {{ money(l.item.transaction.amount) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ l.item.transaction.reference }}
                  {{ l.item.transaction.description }}
                </div>
              </td>
              <td>
                {{ l.item.pagamento.numero }}
                <div class="text-caption text-medium-emphasis">
                  {{ l.item.pagamento.rag_soc }}
                </div>
              </td>
              <td class="text-end">
                {{ money(l.item.pagamento.importo) }}
                <div class="text-caption text-medium-emphasis">
                  {{ l.item.pagamento.scadenza }}
                </div>
              </td>
              <td class="text-end rec-amount">
                <v-text-field
                  v-model.number="l.amount"
                  type="number"
                  step="0.01"
                  min="0"
                  density="compact"
                  variant="outlined"
                  hide-details="auto"
                  :disabled="!l.accepted || !caps.canReconcile"
                  :error="l.accepted && !isLineValid(l)"
                />
              </td>
              <td>
                <v-chip
                  v-if="isPartial(l)"
                  size="x-small"
                  color="warning"
                  variant="tonal"
                  label
                >
                  {{ t("payments.reconciliation.partial") }}
                </v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-card
        v-if="store.analysis.unmatched.length"
        variant="flat"
        class="rec-card"
      >
        <v-card-title class="text-subtitle-1">
          {{ t("payments.reconciliation.unmatched_title") }}
          <v-chip size="x-small" class="ms-2" variant="tonal">{{
            store.analysis.unmatched.length
          }}</v-chip>
        </v-card-title>
        <v-divider />
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t("payments.reconciliation.col_date") }}</th>
              <th class="text-end">{{ t("payments.col.amount") }}</th>
              <th>{{ t("payments.reconciliation.col_reference") }}</th>
              <th>{{ t("payments.reconciliation.col_description") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(u, i) in store.analysis.unmatched" :key="i">
              <td>{{ u.date }}</td>
              <td class="text-end">{{ money(u.amount) }}</td>
              <td>{{ u.reference }}</td>
              <td>{{ u.description }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { capabilities } from "../env";
import { useToastStore } from "../stores/toast.store";
import {
  isLineValid,
  useReconciliationStore,
  type MatchLine,
} from "../stores/reconciliation.store";
import type { StatementFormat } from "../types";

const MAX_BYTES = 2 * 1024 * 1024;

const { t } = useI18n();
const store = useReconciliationStore();
const toasts = useToastStore();
const caps = capabilities();

const file = ref<File | File[] | null>(null);
const format = ref<StatementFormat | "">("");
const delimiter = ref(";");

const formatItems = computed(() => [
  { value: "", title: t("payments.reconciliation.format_auto") },
  { value: "mt940", title: t("payments.reconciliation.format_mt940") },
  { value: "camt053", title: t("payments.reconciliation.format_camt053") },
  { value: "csv", title: t("payments.reconciliation.format_csv") },
]);

const singleFile = computed<File | null>(() => {
  const f = file.value;
  return Array.isArray(f) ? (f[0] ?? null) : f;
});

function fileTooBig(f: File | File[]): boolean {
  const one = Array.isArray(f) ? f[0] : f;
  return !!one && one.size > MAX_BYTES;
}

function isPartial(l: MatchLine): boolean {
  return (
    l.accepted && l.amount > 0 && l.amount < Number(l.item.pagamento.importo)
  );
}

function money(v: number): string {
  return Number(v ?? 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function analyze(): Promise<void> {
  if (!singleFile.value) return;
  await store.analyze(singleFile.value, {
    format: format.value,
    delimiter: format.value === "csv" ? delimiter.value : undefined,
  });
}

async function confirm(): Promise<void> {
  const res = await store.confirm();
  if (res && !res.errors.length)
    toasts.push(
      "success",
      t("payments.reconciliation.confirmed", { count: res.confirmed }),
    );
}

onBeforeUnmount(() => store.reset());
</script>

<style scoped>
.rec-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rec-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rec-card {
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow: hidden;
}
.rec-upload {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.rec-file {
  flex: 2 1 280px;
}
.rec-format {
  flex: 1 1 200px;
  max-width: 260px;
}
.rec-delim {
  flex: 0 0 90px;
}
.rec-amount {
  min-width: 140px;
}
.rec-row--off {
  opacity: 0.5;
}
.rec-errors {
  margin: 4px 0 0;
  padding-left: 18px;
}
</style>
