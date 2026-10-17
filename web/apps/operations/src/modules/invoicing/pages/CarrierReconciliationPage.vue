<template>
  <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
    <template #topbar-title>
      <div class="d-flex align-center ga-2">
        <v-btn
          variant="text"
          icon="mdi-arrow-left"
          :to="{ name: 'invoicing-list', query: { tipo: 'P' } }"
        />
        <v-icon icon="mdi-truck-check-outline" size="24" color="primary" />
        <span class="text-h6">{{ t("invoicing.carrier.title") }}</span>
      </div>
    </template>
    <template #sidebar>
      <OperationsNav />
    </template>

    <div class="carrier-page">
      <!-- Vista global: una fila por factura de proveedor -->
      <v-card variant="outlined">
        <div class="d-flex align-center pa-3 flex-wrap ga-2">
          <div>
            <div class="text-subtitle-1">
              {{ t("invoicing.carrier.overview_title") }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ t("invoicing.carrier.overview_hint", { from: overviewFrom }) }}
            </div>
          </div>
          <v-spacer />
          <v-switch
            v-model="overviewAttention"
            :label="t('invoicing.carrier.only_attention')"
            density="compact"
            hide-details
            color="primary"
            @update:model-value="loadOverview"
          />
          <v-btn
            variant="text"
            icon="mdi-refresh"
            :loading="overviewLoading"
            @click="loadOverview"
          />
          <v-btn
            v-if="caps.canWrite"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-plus"
            @click="openNewInvoice"
          >
            {{ t("invoicing.carrier.new_invoice") }}
          </v-btn>
        </div>
        <v-divider />
        <v-progress-linear v-if="overviewLoading" indeterminate />
        <v-table density="compact" hover>
          <thead>
            <tr>
              <th>{{ t("invoicing.carrier.supplier") }}</th>
              <th>{{ t("invoicing.carrier.number") }}</th>
              <th>{{ t("invoicing.carrier.date") }}</th>
              <th class="text-end">{{ t("invoicing.carrier.amount") }}</th>
              <th class="text-end">{{ t("invoicing.carrier.n_shipments") }}</th>
              <th class="text-end">
                {{ t("invoicing.carrier.n_differences") }}
              </th>
              <th class="text-end">{{ t("invoicing.carrier.difference") }}</th>
              <th>{{ t("invoicing.carrier.outcome") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!overviewRows.length && !overviewLoading">
              <td colspan="8" class="text-center text-medium-emphasis pa-6">
                {{ t("invoicing.carrier.overview_none") }}
              </td>
            </tr>
            <tr
              v-for="o in overviewRows"
              :key="o.id"
              class="overview-row"
              :class="{ 'overview-row--active': o.id === invoiceId }"
              @click="pickFromOverview(o)"
            >
              <td>{{ o.supplier_name }}</td>
              <td>{{ o.numero_alfanum }}</td>
              <td>{{ o.data_fattura }}</td>
              <td class="text-end">
                {{
                  o.importo_netto.toLocaleString("it-IT", {
                    minimumFractionDigits: 2,
                  })
                }}
                {{ o.valuta_sigla }}
              </td>
              <td class="text-end">{{ o.shipment_count }}</td>
              <td class="text-end">{{ o.discrepancy_count }}</td>
              <td class="text-end">{{ money(o.total_delta) }}</td>
              <td>
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="OVERVIEW_COLOR[o.status]"
                >
                  {{ t(`invoicing.carrier.ov_${o.status}`) }}
                </v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-card variant="outlined" class="pa-4">
        <p class="text-body-2 mb-3">{{ t("invoicing.carrier.intro") }}</p>
        <v-autocomplete
          :model-value="invoiceId"
          :items="invoiceItems"
          :loading="searching"
          item-title="label"
          item-value="id"
          :label="t('invoicing.carrier.invoice')"
          density="comfortable"
          variant="outlined"
          no-filter
          clearable
          hide-details
          class="mb-3"
          @update:search="onSearch"
          @update:model-value="onPick"
        />
        <div class="carrier-grid">
          <v-select
            v-model="carrier"
            :items="carrierOptions"
            :label="t('invoicing.carrier.carrier')"
            density="comfortable"
            variant="outlined"
            hide-details
          />
          <v-file-input
            v-model="file"
            accept=".csv,.txt,.tsv"
            :label="t('invoicing.carrier.file')"
            prepend-icon=""
            prepend-inner-icon="mdi-file-delimited-outline"
            density="comfortable"
            variant="outlined"
            hide-details
            show-size
            :error-messages="fileError"
            @update:model-value="fileError = ''"
          />
        </div>
        <v-alert
          v-if="failure"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ failure }}
        </v-alert>
        <div class="d-flex ga-2 mt-3">
          <v-btn
            variant="tonal"
            prepend-icon="mdi-eye-check-outline"
            :loading="busy === 'check'"
            :disabled="!canRun"
            @click="run(true)"
          >
            {{ t("invoicing.carrier.check") }}
          </v-btn>
          <v-btn
            v-if="caps.canWrite"
            color="primary"
            prepend-icon="mdi-upload"
            :loading="busy === 'import'"
            :disabled="!canRun"
            @click="run(false)"
          >
            {{ t("invoicing.carrier.import") }}
          </v-btn>
        </div>
      </v-card>

      <!-- Resultado de la lectura -->
      <v-card v-if="result" variant="outlined" class="pa-4">
        <div class="text-subtitle-1 mb-2">
          {{
            result.dry_run
              ? t("invoicing.carrier.result_check")
              : t("invoicing.carrier.result_done")
          }}
        </div>
        <div class="d-flex flex-wrap ga-2 mb-3">
          <v-chip color="success" variant="tonal">
            {{ t("invoicing.carrier.n_matched", { n: result.associated }) }}
          </v-chip>
          <v-chip color="error" variant="tonal">
            {{ t("invoicing.carrier.n_over", { n: result.overrun }) }}
          </v-chip>
          <v-chip color="warning" variant="tonal">
            {{ t("invoicing.carrier.n_unmatched", { n: result.not_found }) }}
          </v-chip>
          <v-chip variant="tonal">
            {{ t("invoicing.carrier.n_other", { n: otherCount }) }}
          </v-chip>
        </div>
        <v-table density="compact">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ t("invoicing.carrier.tracking") }}</th>
              <th>{{ t("invoicing.carrier.reference") }}</th>
              <th class="text-end">{{ t("invoicing.carrier.amount") }}</th>
              <th>{{ t("invoicing.carrier.outcome") }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in result.rows" :key="r.line">
              <td>{{ r.line }}</td>
              <td>{{ r.awb }}</td>
              <td>{{ r.riferimento }}</td>
              <td class="text-end">
                {{ r.amount != null ? money(r.amount) : "" }}
              </td>
              <td>
                <v-chip
                  size="small"
                  variant="tonal"
                  :color="
                    r.overrun ? 'error' : (STATUS_COLOR[r.status] ?? 'grey')
                  "
                >
                  {{
                    r.overrun
                      ? t("invoicing.carrier.status_over")
                      : t(`invoicing.carrier.status_${r.status}`)
                  }}
                </v-chip>
                <span v-if="r.message" class="text-caption ms-2">{{
                  r.message
                }}</span>
              </td>
              <td>
                <v-btn
                  v-if="r.shipment_id"
                  size="x-small"
                  variant="text"
                  icon="mdi-open-in-new"
                  :title="t('invoicing.carrier.open_shipment')"
                  :to="{
                    name: 'shipment-detail',
                    params: { id: String(r.shipment_id) },
                  }"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Diferencias encontradas en la factura -->
      <v-card v-if="invoiceId" variant="outlined">
        <div class="d-flex align-center pa-3 flex-wrap ga-2">
          <div class="text-subtitle-1">
            {{ t("invoicing.carrier.differences") }}
          </div>
          <v-chip
            v-if="summary.discrepancy_count != null"
            size="small"
            :color="summary.discrepancy_count ? 'warning' : 'success'"
            variant="tonal"
          >
            {{
              t("invoicing.carrier.n_diff", { n: summary.discrepancy_count })
            }}
          </v-chip>
          <v-spacer />
          <v-btn
            v-if="caps.canWrite"
            size="small"
            variant="tonal"
            prepend-icon="mdi-link-variant-plus"
            @click="openLink"
          >
            {{ t("invoicing.carrier.link_shipments") }}
          </v-btn>
          <v-switch
            v-model="onlyDiff"
            :label="t('invoicing.carrier.only_diff')"
            density="compact"
            hide-details
            color="primary"
            @update:model-value="loadList"
          />
          <v-btn
            variant="text"
            icon="mdi-refresh"
            :loading="listLoading"
            @click="loadList"
          />
        </div>
        <v-divider />
        <v-progress-linear v-if="listLoading" indeterminate />
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>{{ t("invoicing.carrier.shipment") }}</th>
              <th>{{ t("invoicing.carrier.reference") }}</th>
              <th class="text-end">{{ t("invoicing.carrier.expected") }}</th>
              <th class="text-end">{{ t("invoicing.carrier.charged") }}</th>
              <th class="text-end">{{ t("invoicing.carrier.difference") }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-if="!shipments.length && !listLoading">
              <td colspan="6" class="text-center text-medium-emphasis pa-6">
                {{ t("invoicing.carrier.none") }}
              </td>
            </tr>
            <tr v-for="s in shipments" :key="s.id">
              <td>
                <router-link
                  :to="{
                    name: 'shipment-detail',
                    params: { id: String(s.id) },
                  }"
                >
                  #{{ s.id }}
                </router-link>
              </td>
              <td>{{ s.RIF_cliente }}</td>
              <td class="text-end">{{ money(s.costo_previsto) }}</td>
              <td class="text-end">{{ money(s.costo_reale) }}</td>
              <td
                class="text-end"
                :class="{
                  'text-error font-weight-medium':
                    s.reconciliation_status === 'discrepancy',
                }"
              >
                {{ money(deltaOf(s)) }}
              </td>
              <td class="text-end">
                <template
                  v-if="
                    caps.canWrite && s.reconciliation_status === 'discrepancy'
                  "
                >
                  <v-btn
                    size="small"
                    variant="text"
                    :disabled="actionBusy === s.id"
                    @click="askAccept(s)"
                  >
                    {{ t("invoicing.carrier.accept") }}
                  </v-btn>
                  <v-btn
                    size="small"
                    variant="text"
                    color="primary"
                    :disabled="actionBusy === s.id"
                    @click="askFlag(s)"
                  >
                    {{ t("invoicing.carrier.recharge") }}
                  </v-btn>
                </template>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Incidencias guardadas de la última importación (fatture_check) -->
      <v-card v-if="invoiceId" variant="outlined" class="mt-4">
        <div class="d-flex align-center ga-3 pa-4 flex-wrap">
          <div>
            <div class="text-subtitle-1">
              {{ t("invoicing.carrier.checks_title") }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ t("invoicing.carrier.checks_hint") }}
            </div>
          </div>
          <v-spacer />
          <v-btn
            variant="text"
            icon="mdi-refresh"
            :loading="checksLoading"
            @click="loadChecks"
          />
        </div>
        <div class="d-flex flex-wrap ga-2 px-4 pb-3">
          <v-chip
            :variant="checksType === '' ? 'flat' : 'tonal'"
            color="primary"
            size="small"
            @click="pickCheckType('')"
          >
            {{ t("invoicing.carrier.checks_all") }} ({{ checksTotalAll }})
          </v-chip>
          <v-chip
            v-for="ty in CHECK_TYPES"
            :key="ty"
            :variant="checksType === ty ? 'flat' : 'tonal'"
            :color="CHECK_COLOR[ty]"
            :disabled="!checksByType[ty]"
            size="small"
            @click="pickCheckType(ty)"
          >
            {{ t(`invoicing.carrier.check_${ty}`) }} ({{
              checksByType[ty] ?? 0
            }})
          </v-chip>
        </div>
        <v-divider />
        <v-progress-linear v-if="checksLoading" indeterminate />
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t("invoicing.carrier.check_line") }}</th>
              <th>{{ t("invoicing.carrier.check_type") }}</th>
              <th>{{ t("invoicing.carrier.shipment") }}</th>
              <th>{{ t("invoicing.carrier.check_detail") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!checks.length && !checksLoading">
              <td colspan="4" class="text-center text-medium-emphasis pa-6">
                {{ t("invoicing.carrier.checks_none") }}
              </td>
            </tr>
            <tr v-for="c in checks" :key="c.id">
              <td>{{ c.riga_num || "" }}</td>
              <td>
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="CHECK_COLOR[c.tipo_record as CheckType] ?? 'grey'"
                >
                  {{ t(`invoicing.carrier.check_${c.tipo_record}`) }}
                </v-chip>
              </td>
              <td>
                <router-link
                  v-if="c.id_spediz"
                  :to="{
                    name: 'shipment-detail',
                    params: { id: String(c.id_spediz) },
                  }"
                >
                  #{{ c.id_spediz }}
                </router-link>
              </td>
              <td class="text-body-2">{{ c.descr }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </div>

    <!-- Aceptar la diferencia (con motivo) -->
    <v-dialog v-model="acceptOpen" max-width="440">
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("invoicing.carrier.accept_title") }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">
            {{ t("invoicing.carrier.accept_text") }}
          </p>
          <v-textarea
            v-model="reason"
            :label="t('invoicing.carrier.reason')"
            rows="2"
            variant="outlined"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="acceptOpen = false">
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!reason.trim() || actionBusy !== null"
            @click="doAccept"
          >
            {{ t("invoicing.carrier.accept") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Repercutir la diferencia -->
    <v-dialog v-model="flagOpen" max-width="440">
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("invoicing.carrier.recharge_title") }}
        </v-card-title>
        <v-card-text>{{ t("invoicing.carrier.recharge_text") }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="flagOpen = false">
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="actionBusy !== null"
            @click="doFlag"
          >
            {{ t("invoicing.carrier.recharge") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Registrar la factura del transportista -->
    <v-dialog v-model="newOpen" max-width="520">
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("invoicing.carrier.new_invoice") }}
        </v-card-title>
        <v-card-text>
          <v-autocomplete
            v-model="newForm.id_anagrafica"
            :items="supplierItems"
            :loading="supplierSearching"
            item-title="rag_soc"
            item-value="id"
            :label="t('invoicing.carrier.supplier')"
            density="comfortable"
            variant="outlined"
            no-filter
            class="mb-3"
            :error-messages="newErrors.supplier"
            @update:search="onSupplierSearch"
          />
          <div class="carrier-grid">
            <v-text-field
              v-model="newForm.numero_alfanum"
              :label="t('invoicing.carrier.number')"
              density="comfortable"
              variant="outlined"
              :error-messages="newErrors.number"
            />
            <v-text-field
              v-model="newForm.data_fattura"
              type="date"
              :label="t('invoicing.carrier.date')"
              density="comfortable"
              variant="outlined"
              :error-messages="newErrors.date"
            />
            <v-text-field
              v-model.number="newForm.importo_netto"
              type="number"
              min="0"
              step="0.01"
              :label="t('invoicing.carrier.net')"
              density="comfortable"
              variant="outlined"
              :error-messages="newErrors.amount"
            />
            <v-text-field
              v-model.number="newForm.importo_iva"
              type="number"
              min="0"
              step="0.01"
              :label="t('invoicing.carrier.vat')"
              density="comfortable"
              variant="outlined"
            />
            <v-text-field
              v-model="newForm.valuta_sigla"
              maxlength="3"
              :label="t('invoicing.carrier.currency')"
              density="comfortable"
              variant="outlined"
              :error-messages="newErrors.currency"
              @update:model-value="
                newForm.valuta_sigla = String($event ?? '').toUpperCase()
              "
            />
          </div>
          <v-alert
            v-if="newFailure"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ newFailure }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="newOpen = false">
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn color="primary" :loading="newBusy" @click="doCreateInvoice">
            {{ t("invoicing.carrier.register") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Vincular envíos a la factura seleccionada -->
    <v-dialog v-model="linkOpen" max-width="520">
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("invoicing.carrier.link_shipments") }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">{{ t("invoicing.carrier.link_hint") }}</p>
          <v-radio-group v-model="linkKind" inline hide-details class="mb-2">
            <v-radio
              :label="t('invoicing.carrier.kind_express')"
              value="express"
            />
            <v-radio :label="t('invoicing.carrier.kind_cargo')" value="cargo" />
          </v-radio-group>
          <v-textarea
            v-model="linkText"
            :label="t('invoicing.carrier.link_ids')"
            rows="3"
            variant="outlined"
            hide-details
          />
          <div class="text-caption text-medium-emphasis mt-1">
            {{ t("invoicing.carrier.link_count", { n: linkIds.length }) }}
          </div>
          <v-alert
            v-if="linkResult"
            :type="linkResult.errors.length ? 'warning' : 'success'"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{
              t("invoicing.carrier.link_result", {
                linked: linkResult.linked,
                already: linkResult.already_linked,
              })
            }}
            <ul v-if="linkResult.errors.length" class="mt-1 ps-4">
              <li v-for="(e, i) in linkResult.errors" :key="i">{{ e }}</li>
            </ul>
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="linkOpen = false">
            {{ t("invoicing.carrier.close") }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="linkBusy"
            :disabled="!linkIds.length"
            @click="doLink"
          >
            {{ t("invoicing.carrier.link") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </DashboardShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import { capabilities } from "../services/http";
import {
  parseShipmentIds,
  supplierInvoiceApi,
  validateNewSupplierInvoice,
  type LinkResult,
  type SupplierOption,
} from "../services/supplierInvoice.service";
import {
  CARRIERS,
  CHECK_COLOR,
  CHECK_TYPES,
  OVERVIEW_COLOR,
  STATUS_COLOR,
  carrierReconApi,
  deltaOf,
  validateCarrierFile,
  type CheckRow,
  type CheckType,
  type ChecksByType,
  type ImportResult,
  type OverviewRow,
  type ReconShipment,
  type ReconSummary,
} from "../services/carrierRecon.service";
import { useToastStore } from "../stores/toast.store";

const { t } = useI18n();
const route = useRoute();
const caps = capabilities();
const toasts = useToastStore();

interface Item {
  id: number;
  label: string;
}
const invoiceId = ref<number | null>(null);
const invoiceItems = ref<Item[]>([]);
const searching = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const carrier = ref("");
const carrierOptions = computed(() => [
  { title: t("invoicing.carrier.auto"), value: "" },
  ...CARRIERS.map((c) => ({ title: c, value: c })),
]);
const file = ref<File | File[] | null>(null);
const fileError = ref("");
const failure = ref("");
const busy = ref<"" | "check" | "import">("");
const result = ref<ImportResult | null>(null);

const onlyDiff = ref(true);
const shipments = ref<ReconShipment[]>([]);
const summary = ref<ReconSummary>({});
const listLoading = ref(false);

const checks = ref<CheckRow[]>([]);
const checksByType = ref<ChecksByType>({});
const checksType = ref<CheckType | "">("");
const checksLoading = ref(false);
const checksTotalAll = computed(() =>
  Object.values(checksByType.value).reduce((a, n) => a + (n ?? 0), 0),
);

// Vista global
const overviewRows = ref<OverviewRow[]>([]);
const overviewLoading = ref(false);
const overviewAttention = ref(true);
const overviewFrom = ref("");

// Alta manual de la factura del transportista
const newOpen = ref(false);
const newBusy = ref(false);
const newFailure = ref("");
const supplierItems = ref<SupplierOption[]>([]);
const supplierSearching = ref(false);
let supplierTimer: ReturnType<typeof setTimeout> | null = null;
const emptyNew = () => ({
  id_anagrafica: 0,
  numero_alfanum: "",
  data_fattura: new Date().toISOString().slice(0, 10),
  importo_netto: 0,
  importo_iva: 0,
  valuta_sigla: "EUR",
});
const newForm = ref(emptyNew());
const newErrors = ref<Record<string, string>>({});

// Vínculo manual de envíos
const linkOpen = ref(false);
const linkBusy = ref(false);
const linkKind = ref<"express" | "cargo">("express");
const linkText = ref("");
const linkResult = ref<LinkResult | null>(null);
const linkIds = computed(() => parseShipmentIds(linkText.value));

const actionBusy = ref<number | null>(null);
const acceptOpen = ref(false);
const flagOpen = ref(false);
const reason = ref("");
const target = ref<ReconShipment | null>(null);

const picked = computed<File | null>(() =>
  Array.isArray(file.value) ? (file.value[0] ?? null) : file.value,
);
const canRun = computed(
  () => !!invoiceId.value && !!picked.value && !busy.value,
);
const otherCount = computed(() => {
  const r = result.value;
  return r ? r.other_invoice + r.duplicates + r.format_errors : 0;
});

function money(v: unknown): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function onSearch(text: string): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    searching.value = true;
    try {
      const res = await supplierInvoiceApi.list({
        search: (text ?? "").trim() || undefined,
        per_page: 20,
        page: 1,
      });
      invoiceItems.value = res.items.map((i) => ({
        id: Number(i.id),
        label: `${i.rag_soc ?? ""} · ${i.numero_alfanum || i.numero || ""} · ${i.data_fattura ?? ""}`,
      }));
    } catch {
      invoiceItems.value = [];
    } finally {
      searching.value = false;
    }
  }, 250);
}

function onPick(id: number | null): void {
  invoiceId.value = id;
  result.value = null;
  shipments.value = [];
  summary.value = {};
  checks.value = [];
  checksByType.value = {};
  checksType.value = "";
  if (id) {
    void loadList();
    void loadChecks();
  }
}

async function loadOverview(): Promise<void> {
  overviewLoading.value = true;
  try {
    const r = await carrierReconApi.overview({
      attention: overviewAttention.value,
      page: 1,
      perPage: 50,
    });
    overviewRows.value = r.items;
    overviewFrom.value = r.from;
  } catch {
    overviewRows.value = [];
    toasts.push("error", t("invoicing.carrier.overview_failed"));
  } finally {
    overviewLoading.value = false;
  }
}

function pickFromOverview(o: OverviewRow): void {
  invoiceItems.value = [
    {
      id: o.id,
      label: `${o.supplier_name ?? ""} · ${o.numero_alfanum ?? ""} · ${o.data_fattura}`,
    },
  ];
  onPick(o.id);
}

function onSupplierSearch(text: string): void {
  if (supplierTimer) clearTimeout(supplierTimer);
  supplierTimer = setTimeout(async () => {
    supplierSearching.value = true;
    try {
      supplierItems.value = await supplierInvoiceApi.suppliers(text ?? "");
    } catch {
      supplierItems.value = [];
    } finally {
      supplierSearching.value = false;
    }
  }, 250);
}

function openNewInvoice(): void {
  newForm.value = emptyNew();
  newErrors.value = {};
  newFailure.value = "";
  newOpen.value = true;
  onSupplierSearch("");
}

async function doCreateInvoice(): Promise<void> {
  newErrors.value = {};
  newFailure.value = "";
  const check = validateNewSupplierInvoice(newForm.value);
  if (check !== "ok") {
    newErrors.value = { [check]: t(`invoicing.carrier.err_new_${check}`) };
    return;
  }
  newBusy.value = true;
  try {
    const id = await supplierInvoiceApi.create({
      ...newForm.value,
      numero_alfanum: newForm.value.numero_alfanum.trim(),
    });
    newOpen.value = false;
    toasts.push("success", t("invoicing.carrier.registered"));
    await loadOverview();
    if (id > 0) {
      const sup = supplierItems.value.find(
        (x) => x.id === newForm.value.id_anagrafica,
      );
      invoiceItems.value = [
        {
          id,
          label: `${sup?.rag_soc ?? ""} · ${newForm.value.numero_alfanum} · ${newForm.value.data_fattura}`,
        },
      ];
      onPick(id);
    }
  } catch (e) {
    const err = e as { status?: number; message?: string };
    newFailure.value =
      err?.status && err.status < 500 && err.message
        ? err.message
        : t("invoicing.carrier.register_failed");
  } finally {
    newBusy.value = false;
  }
}

function openLink(): void {
  linkText.value = "";
  linkResult.value = null;
  linkKind.value = "express";
  linkOpen.value = true;
}

async function doLink(): Promise<void> {
  if (!invoiceId.value || !linkIds.value.length) return;
  linkBusy.value = true;
  try {
    linkResult.value = await supplierInvoiceApi.linkShipments(
      invoiceId.value,
      linkIds.value,
      linkKind.value,
    );
    if (linkResult.value.linked > 0) {
      await loadList();
      await loadOverview();
    }
  } catch {
    toasts.push("error", t("invoicing.carrier.action_failed"));
  } finally {
    linkBusy.value = false;
  }
}

async function loadChecks(): Promise<void> {
  if (!invoiceId.value) return;
  checksLoading.value = true;
  try {
    const r = await carrierReconApi.checks(invoiceId.value, {
      tipo: checksType.value,
      page: 1,
      perPage: 100,
    });
    checks.value = r.items;
    // El recuento por tipo es de toda la factura: se conserva al filtrar.
    checksByType.value = r.byType;
  } catch {
    checks.value = [];
    toasts.push("error", t("invoicing.carrier.checks_load_failed"));
  } finally {
    checksLoading.value = false;
  }
}

function pickCheckType(ty: CheckType | ""): void {
  checksType.value = ty;
  void loadChecks();
}

async function loadList(): Promise<void> {
  if (!invoiceId.value) return;
  listLoading.value = true;
  try {
    const r = await carrierReconApi.list(invoiceId.value, {
      onlyDiscrepancies: onlyDiff.value,
      page: 1,
      perPage: 100,
    });
    shipments.value = r.items;
    summary.value = r.summary;
  } catch {
    shipments.value = [];
    toasts.push("error", t("invoicing.carrier.load_failed"));
  } finally {
    listLoading.value = false;
  }
}

async function run(dry: boolean): Promise<void> {
  if (!canRun.value || !invoiceId.value) return;
  const check = validateCarrierFile(picked.value);
  if (check !== "ok") {
    fileError.value = t(`invoicing.carrier.err_${check}`);
    return;
  }
  busy.value = dry ? "check" : "import";
  failure.value = "";
  try {
    result.value = await carrierReconApi.importFile(
      invoiceId.value,
      picked.value as File,
      carrier.value,
      dry,
    );
    if (!dry) {
      await loadList();
      await loadChecks();
      void loadOverview();
    }
  } catch (e) {
    const err = e as { status?: number; message?: string };
    failure.value =
      err?.status === 422 && err.message
        ? err.message
        : t("invoicing.carrier.import_failed");
  } finally {
    busy.value = "";
  }
}

function askAccept(s: ReconShipment): void {
  target.value = s;
  reason.value = "";
  acceptOpen.value = true;
}
function askFlag(s: ReconShipment): void {
  target.value = s;
  flagOpen.value = true;
}
async function doAccept(): Promise<void> {
  if (!target.value || !invoiceId.value || !reason.value.trim()) return;
  actionBusy.value = target.value.id;
  try {
    await carrierReconApi.accept(
      invoiceId.value,
      target.value.id,
      reason.value,
    );
    acceptOpen.value = false;
    toasts.push("success", t("invoicing.carrier.accepted"));
    await loadList();
    void loadOverview();
  } catch {
    toasts.push("error", t("invoicing.carrier.action_failed"));
  } finally {
    actionBusy.value = null;
  }
}
async function doFlag(): Promise<void> {
  if (!target.value || !invoiceId.value) return;
  actionBusy.value = target.value.id;
  try {
    await carrierReconApi.flag(invoiceId.value, target.value.id);
    flagOpen.value = false;
    toasts.push("success", t("invoicing.carrier.recharged"));
    await loadList();
    void loadOverview();
  } catch {
    toasts.push("error", t("invoicing.carrier.action_failed"));
  } finally {
    actionBusy.value = null;
  }
}

onMounted(() => {
  void loadOverview();
  const q = Number(route.query.invoice ?? 0);
  if (q > 0) {
    invoiceItems.value = [{ id: q, label: `#${q}` }];
    onPick(q);
  }
});
</script>

<style scoped>
.carrier-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0 40px;
}
.overview-row {
  cursor: pointer;
}
.overview-row--active {
  background: rgba(var(--v-theme-primary), 0.08);
}
.carrier-grid {
  display: grid;
  grid-template-columns: minmax(160px, 220px) 1fr;
  gap: 12px;
}
@media (max-width: 720px) {
  .carrier-grid {
    grid-template-columns: 1fr;
  }
}
</style>
