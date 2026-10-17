<template>
  <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
    <template #topbar-title>
      <div class="d-flex align-center ga-2">
        <v-btn
          variant="text"
          icon="mdi-arrow-left"
          :to="{ name: 'invoicing-list' }"
        />
        <v-icon icon="mdi-calendar-month-outline" size="24" color="primary" />
        <span class="text-h6">{{ t("invoicing.monthly.title") }}</span>
      </div>
    </template>

    <template #sidebar>
      <OperationsNav />
    </template>

    <div class="monthly-page">
      <!-- Parámetros -->
      <v-card variant="outlined" class="pa-4">
        <div class="monthly-grid">
          <v-text-field
            v-model="params.dal"
            type="date"
            :label="t('invoicing.monthly.from')"
            density="comfortable"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-model="params.al"
            type="date"
            :label="t('invoicing.monthly.to')"
            density="comfortable"
            variant="outlined"
            hide-details
          />
          <CustomerPicker
            v-model="params.id_cliente"
            :label="t('invoicing.monthly.client_filter')"
          />
          <v-text-field
            v-model.number="minimo"
            type="number"
            min="0"
            :label="t('invoicing.monthly.minimum')"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </div>
        <div class="d-flex flex-wrap ga-4 mt-2">
          <v-checkbox
            v-model="params.solo_chiusi"
            :label="t('invoicing.monthly.only_closed')"
            density="compact"
            hide-details
          />
          <v-checkbox
            v-model="params.no_giaccrm"
            :label="t('invoicing.monthly.no_storage')"
            density="compact"
            hide-details
          />
          <v-checkbox
            v-model="params.no_cargo"
            :label="t('invoicing.monthly.no_cargo')"
            density="compact"
            hide-details
          />
          <v-checkbox
            v-model="params.no_express"
            :label="t('invoicing.monthly.no_courier')"
            density="compact"
            hide-details
          />
        </div>
        <div class="d-flex mt-3">
          <v-btn
            color="primary"
            prepend-icon="mdi-magnify"
            :loading="loading"
            :disabled="!rangeOk"
            @click="loadPreview"
          >
            {{ t("invoicing.monthly.preview") }}
          </v-btn>
        </div>
        <div v-if="!rangeOk" class="text-caption text-error mt-1">
          {{ t("invoicing.monthly.err_range") }}
        </div>
      </v-card>

      <v-alert v-if="loadError" type="error" variant="tonal" density="compact">
        {{ t("invoicing.monthly.load_failed") }}
      </v-alert>

      <v-alert
        v-if="uncertain"
        type="warning"
        variant="tonal"
        density="compact"
        icon="mdi-alert"
      >
        {{ t("invoicing.monthly.uncertain") }}
      </v-alert>

      <!-- Progreso de la emisión por tandas -->
      <v-card v-if="progress" variant="outlined" class="pa-4">
        <div class="text-subtitle-1 mb-2">
          {{ t("invoicing.monthly.progress_title") }}
        </div>
        <v-progress-linear
          :model-value="progress.percent"
          height="14"
          rounded
          color="primary"
        />
        <div class="text-body-2 mt-2">
          {{
            t("invoicing.monthly.progress_text", {
              done: progress.doneClients,
              total: progress.totalClients,
              batch: progress.doneBatches,
              batches: progress.totalBatches,
            })
          }}
        </div>
        <v-btn
          v-if="emitting"
          class="mt-3"
          variant="outlined"
          color="warning"
          prepend-icon="mdi-stop"
          :disabled="stopRequested"
          @click="stopRequested = true"
        >
          {{
            stopRequested
              ? t("invoicing.monthly.stopping")
              : t("invoicing.monthly.stop_after_batch")
          }}
        </v-btn>
      </v-card>

      <v-alert
        v-if="runReport"
        type="warning"
        variant="tonal"
        density="compact"
        icon="mdi-alert"
      >
        <div v-for="(line, i) in runReport" :key="i">{{ line }}</div>
      </v-alert>

      <!-- Resultado de la emisión -->
      <v-card v-if="results" variant="outlined" class="pa-4">
        <div class="text-subtitle-1 mb-2">
          {{ t("invoicing.monthly.result_title") }}
        </div>
        <v-alert
          v-for="(w, i) in resultWarnings"
          :key="i"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ w }}
        </v-alert>
        <v-table density="compact">
          <tbody>
            <tr v-for="(r, i) in results" :key="i">
              <td>{{ clientName(r.id_anagrafica) }}</td>
              <td>
                <template v-if="r.kind === 'generated'">
                  <v-chip size="small" color="success" variant="tonal">
                    {{ t("invoicing.monthly.res_generated") }}
                  </v-chip>
                  <router-link
                    v-if="r.id_fattura"
                    class="ms-2"
                    :to="{
                      name: 'invoicing-detail',
                      params: { id: String(r.id_fattura) },
                    }"
                  >
                    {{ r.numero ?? r.id_fattura }}
                  </router-link>
                </template>
                <v-chip
                  v-else-if="r.kind === 'nothing'"
                  size="small"
                  color="grey"
                  variant="tonal"
                >
                  {{ t("invoicing.monthly.res_nothing") }}
                </v-chip>
                <template v-else>
                  <v-chip size="small" color="error" variant="tonal">
                    {{ t("invoicing.monthly.res_error") }}
                  </v-chip>
                  <span class="text-caption ms-2">{{ r.detail }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Vista previa -->
      <v-card v-if="clients" variant="outlined">
        <div class="d-flex align-center pa-3 flex-wrap ga-2">
          <div class="text-subtitle-1">
            {{ t("invoicing.monthly.clients_title", { n: clients.length }) }}
          </div>
          <v-spacer />
          <v-btn
            size="small"
            variant="text"
            @click="selected = selectAllValid(clients)"
          >
            {{ t("invoicing.monthly.select_valid") }}
          </v-btn>
          <v-btn size="small" variant="text" @click="selected = []">
            {{ t("invoicing.monthly.select_none") }}
          </v-btn>
        </div>
        <v-divider />
        <v-table density="comfortable">
          <thead>
            <tr>
              <th style="width: 48px" />
              <th>{{ t("invoicing.invoice.client") }}</th>
              <th class="text-end">{{ t("invoicing.monthly.shipments") }}</th>
              <th class="text-end">{{ t("invoicing.monthly.amount") }}</th>
              <th>{{ t("invoicing.monthly.data_status") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="clients.length === 0">
              <td colspan="5" class="text-center text-medium-emphasis pa-6">
                {{ t("invoicing.monthly.nothing") }}
              </td>
            </tr>
            <tr v-for="c in clients" :key="c.id_anagrafica">
              <td>
                <v-checkbox-btn
                  :model-value="selected.includes(Number(c.id_anagrafica))"
                  :disabled="!isBillable(c) || locked"
                  @update:model-value="toggle(Number(c.id_anagrafica), $event)"
                />
              </td>
              <td>{{ c.rag_soc || `#${c.id_anagrafica}` }}</td>
              <td class="text-end">{{ c.shipment_count }}</td>
              <td class="text-end">{{ money(c.total) }}</td>
              <td>
                <v-chip
                  v-if="isBillable(c)"
                  size="small"
                  color="success"
                  variant="tonal"
                >
                  {{ t("invoicing.monthly.ready") }}
                </v-chip>
                <template v-else>
                  <v-chip size="small" color="warning" variant="tonal">
                    {{ t("invoicing.monthly.missing_data") }}
                  </v-chip>
                  <div
                    v-for="(reason, i) in invalidReasons(c)"
                    :key="i"
                    class="text-caption text-medium-emphasis"
                  >
                    {{ reason }}
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-divider />

        <!-- Emisión -->
        <div v-if="caps.canWrite" class="pa-4 monthly-emit">
          <v-text-field
            v-model="dataFattura"
            type="date"
            @update:model-value="dateTouched = true"
            :label="t('invoicing.monthly.invoice_date')"
            density="comfortable"
            variant="outlined"
            hide-details="auto"
            :error-messages="dateMessage"
            :disabled="locked"
            style="max-width: 220px"
          />
          <div class="monthly-total">
            {{
              t("invoicing.monthly.selected_total", {
                n: selected.length,
                total: money(totalOf(clients, selected)),
              })
            }}
          </div>
          <v-btn
            color="primary"
            prepend-icon="mdi-receipt-text-check"
            :disabled="!canEmit"
            @click="confirmOpen = true"
          >
            {{ t("invoicing.monthly.emit") }}
          </v-btn>
        </div>
      </v-card>
    </div>

    <v-dialog v-model="confirmOpen" max-width="480" persistent>
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("invoicing.monthly.confirm_title") }}
        </v-card-title>
        <v-card-text>
          <p class="mb-2">
            {{
              t("invoicing.monthly.confirm_text", {
                n: selected.length,
                total: money(totalOf(clients ?? [], selected)),
                date: dataFattura,
              })
            }}
          </p>
          <v-alert type="warning" variant="tonal" density="compact">
            {{ t("invoicing.monthly.irreversible") }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="emitting"
            @click="confirmOpen = false"
          >
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="emitting"
            :disabled="emitting || !canEmit"
            @click="emit"
          >
            {{ t("invoicing.monthly.confirm_emit") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </DashboardShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import { capabilities } from "../services/http";
import CustomerPicker from "../../payments/components/CustomerPicker.vue";
import {
  DEFAULT_BATCH_SIZE,
  chunkClientIds,
  computeProgress,
  runBatches,
  type BatchProgress,
  type RunOutcome,
} from "../services/monthlyBatching.logic";
import {
  invalidReasons,
  isBillable,
  monthlyBillingApi,
  previousMonthRange,
  defaultInvoiceDate,
  selectAllValid,
  totalOf,
  validateInvoiceDate,
  type BillingClient,
  type BillingParams,
  type ResultRow,
} from "../services/monthlyBilling.service";

const { t } = useI18n();
const caps = capabilities();

const range = previousMonthRange();
const params = reactive<BillingParams>({
  dal: range.dal,
  al: range.al,
  minimo: null,
  solo_chiusi: true,
  no_giaccrm: false,
  no_cargo: false,
  no_express: false,
});
const minimo = computed({
  get: () => params.minimo,
  set: (v) => {
    params.minimo = typeof v === "number" && v > 0 ? v : null;
  },
});
// Como en el ERP original, la factura lleva por defecto el último día del periodo.
const dataFattura = ref(defaultInvoiceDate(params.al, false, ""));
const dateTouched = ref(false);

const clients = ref<BillingClient[] | null>(null);
const selected = ref<number[]>([]);
const loading = ref(false);
const loadError = ref(false);
const uncertain = ref(false);
const emitting = ref(false);
/** Tras el primer clic de emitir, no se vuelve a emitir sin recalcular la vista previa. */
const locked = ref(false);
const confirmOpen = ref(false);
const results = ref<ResultRow[] | null>(null);
const resultWarnings = ref<string[]>([]);
const dateFailure = ref("");
const progress = ref<BatchProgress | null>(null);
const stopRequested = ref(false);
const runReport = ref<string[] | null>(null);

// Si cambian los parámetros, la vista previa deja de valer: hay que recalcularla.
watch(params, () => {
  clients.value = null;
  selected.value = [];
});
// La fecha de factura sigue al fin del periodo mientras el usuario no la cambie a mano.
watch(
  () => params.al,
  (al) => {
    dataFattura.value = defaultInvoiceDate(al, dateTouched.value, dataFattura.value);
  },
);

const rangeOk = computed(
  () => !!params.dal && !!params.al && params.dal <= params.al,
);
const dateIssue = computed(() =>
  validateInvoiceDate(dataFattura.value, params.dal, params.al),
);
const dateMessage = computed(() => {
  if (dateFailure.value) return dateFailure.value;
  return dateIssue.value ? t(`invoicing.monthly.date_${dateIssue.value}`) : "";
});
const canEmit = computed(
  () =>
    caps.canWrite &&
    !locked.value &&
    !emitting.value &&
    selected.value.length > 0 &&
    dateIssue.value === null,
);

function money(v: unknown): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}
function toggle(id: number, on: unknown): void {
  selected.value = on
    ? [...new Set([...selected.value, id])]
    : selected.value.filter((x) => x !== id);
}
function clientName(id?: number): string {
  const c = clients.value?.find((x) => Number(x.id_anagrafica) === Number(id));
  return c?.rag_soc || (id ? `#${id}` : "—");
}

async function loadPreview(): Promise<void> {
  loading.value = true;
  loadError.value = false;
  try {
    clients.value = await monthlyBillingApi.preview({ ...params });
    selected.value = selectAllValid(clients.value);
    locked.value = false;
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

/** "1, 3-4" a partir de índices 0-based de tandas (se muestran 1-based). */
function batchList(idx: number[]): string {
  return idx.map((i) => i + 1).join(", ");
}

function buildReport(o: RunOutcome, total: number): string[] {
  const lines: string[] = [];
  if (o.stop === "none") return lines;
  if (o.stop === "user") lines.push(t("invoicing.monthly.rep_stopped_user"));
  else if (o.stop === "uncertain")
    lines.push(t("invoicing.monthly.rep_stopped_uncertain"));
  else lines.push(t("invoicing.monthly.rep_stopped_rejected"));
  lines.push(
    o.completed.length
      ? t("invoicing.monthly.rep_completed", { list: batchList(o.completed) })
      : t("invoicing.monthly.rep_completed_none"),
  );
  if (o.uncertain !== null)
    lines.push(
      t("invoicing.monthly.rep_uncertain", { n: o.uncertain + 1, total }),
    );
  if (o.rejected !== null)
    lines.push(
      t("invoicing.monthly.rep_rejected", {
        n: o.rejected + 1,
        total,
        detail: o.failureMessage || "",
      }),
    );
  if (o.notSent.length)
    lines.push(t("invoicing.monthly.rep_not_sent", { list: batchList(o.notSent) }));
  lines.push(t("invoicing.monthly.rep_next"));
  return lines;
}

/**
 * Emisión secuencial por tandas. Nunca se reintenta una tanda y cualquier
 * fallo de la llamada para toda la ejecución (ver monthlyBatching.logic).
 */
async function emit(): Promise<void> {
  if (!canEmit.value) return;
  emitting.value = true;
  locked.value = true; // el botón queda desactivado desde el primer clic
  dateFailure.value = "";
  uncertain.value = false;
  runReport.value = null;
  stopRequested.value = false;
  confirmOpen.value = false;
  const batches = chunkClientIds([...selected.value], DEFAULT_BATCH_SIZE);
  progress.value = computeProgress(batches, 0);
  results.value = [];
  resultWarnings.value = [];
  try {
    const out = await runBatches({
      batches,
      send: (ids) =>
        monthlyBillingApi.emit({ ...params }, ids, dataFattura.value),
      shouldStop: () => stopRequested.value,
      onProgress: (p) => {
        progress.value = p;
      },
    });
    results.value = out.rows;
    resultWarnings.value = out.warnings;
    selected.value = [];
    if (out.stop === "date" || out.stop === "rejected" || out.stop === "forbidden") {
      if (!out.anySent) locked.value = false; // nada emitido: se puede corregir
      if (out.stop === "date")
        dateFailure.value =
          out.failureMessage || t("invoicing.monthly.date_before_dal");
      else if (!out.anySent)
        resultWarnings.value = [
          ...out.warnings,
          out.failureMessage || t("invoicing.monthly.rejected"),
        ];
    }
    if (out.stop === "uncertain") uncertain.value = true;
    const report = buildReport(out, batches.length);
    runReport.value = report.length ? report : null;
    // Recalcula la vista previa: los ya facturados desaparecen.
    await refreshQuietly();
  } finally {
    emitting.value = false;
  }
}

/** Recalcula la vista previa para que se vea qué queda por facturar. */
async function refreshQuietly(): Promise<void> {
  try {
    clients.value = await monthlyBillingApi.preview({ ...params });
    selected.value = [];
  } catch {
    /* la vista previa se puede relanzar a mano */
  }
}

onMounted(() => void loadPreview());
</script>

<style scoped>
.monthly-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0 40px;
}
.monthly-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 240px));
  gap: 12px;
}
.monthly-emit {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
}
.monthly-total {
  flex: 1;
  align-self: center;
  font-weight: 600;
}
@media (max-width: 720px) {
  .monthly-grid {
    grid-template-columns: 1fr;
  }
}
</style>
