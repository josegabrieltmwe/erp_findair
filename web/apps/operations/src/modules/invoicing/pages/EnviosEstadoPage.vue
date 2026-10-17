<template>
  <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
    <template #topbar-title>
      <div class="d-flex align-center ga-2">
        <v-icon icon="mdi-bank-transfer-out" size="24" color="primary" />
        <span class="text-h6">{{ t("invoicing.envios.title") }}</span>
      </div>
    </template>

    <template #topbar-actions>
      <v-btn
        variant="text"
        icon="mdi-refresh"
        :title="t('common.refresh')"
        :loading="store.loading"
        @click="store.load()"
      />
      <v-btn
        v-if="store.tab === 'listas' && store.puedeEnviar"
        color="primary"
        prepend-icon="mdi-send"
        :disabled="store.selected.length === 0"
        :loading="store.working"
        @click="sendSelected"
      >
        {{
          t("invoicing.envios.actions.send_selected", {
            n: store.selected.length,
          })
        }}
      </v-btn>
    </template>

    <template #sidebar="{ collapsed }">
      <OperationsNav :collapsed="collapsed" />
      <button
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="t('invoicing.invoice.list')"
        @click="goToList"
      >
        <v-icon icon="mdi-receipt-text" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.invoice.list")
        }}</span>
      </button>
    </template>

    <div class="pa-4">
      <v-alert type="info" variant="tonal" density="compact" class="mb-3">
        {{ t("invoicing.envios.intro") }}
      </v-alert>

      <!-- Pestañas con contadores (DISENO §10.1) -->
      <v-tabs
        :model-value="store.tab"
        color="primary"
        density="comfortable"
        class="mb-2"
        @update:model-value="(v: unknown) => store.setTab(v as EnviosTab)"
      >
        <v-tab v-for="tab in tabs" :key="tab.value" :value="tab.value">
          <v-icon :icon="tab.icon" size="18" class="mr-1" />
          {{ t(`invoicing.envios.tabs.${tab.value}`) }}
          <v-chip
            size="x-small"
            class="ml-2"
            :color="tab.color"
            variant="tonal"
            >{{ store.counters[tab.value] ?? 0 }}</v-chip
          >
        </v-tab>
      </v-tabs>

      <!-- Filtros -->
      <div class="envios-filters mb-3">
        <v-text-field
          v-model="draft.q"
          :label="t('invoicing.envios.filters.q')"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          hide-details
          clearable
          @keyup.enter="apply"
          @click:clear="clearQ"
        />
        <v-text-field
          v-if="store.esTmwe"
          v-model.number="draft.partner"
          type="number"
          :label="t('invoicing.envios.filters.partner')"
          density="compact"
          hide-details
          clearable
          @keyup.enter="apply"
        />
        <v-select
          v-model="draft.pais"
          :items="paises"
          :label="t('invoicing.envios.filters.pais')"
          density="compact"
          hide-details
          clearable
        />
        <v-select
          v-model="draft.tipo_canal"
          :items="canales"
          :label="t('invoicing.envios.filters.canal')"
          density="compact"
          hide-details
          clearable
        />
        <v-select
          v-model="draft.vence"
          :items="venceItems"
          item-title="label"
          item-value="value"
          :label="t('invoicing.envios.filters.vence')"
          density="compact"
          hide-details
        />
        <v-btn color="primary" variant="tonal" @click="apply">
          {{ t("common.apply") }}
        </v-btn>
      </div>

      <v-alert
        v-if="store.error"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ store.error }}
      </v-alert>

      <v-data-table-server
        v-model="selectedModel"
        :headers="headers"
        :items="store.items"
        :items-length="store.total"
        :loading="store.loading"
        :items-per-page="store.perPage"
        :page="store.page"
        :show-select="store.tab === 'listas' && store.puedeEnviar"
        item-value="id"
        density="compact"
        class="envios-table"
        @update:page="onPage"
        @update:items-per-page="onPerPage"
      >
        <template #[`item.partner`]="{ item }">
          <div class="d-flex align-center ga-1">
            <v-icon
              :icon="processIcon(item.validacion_estado)"
              :color="processColor(item.validacion_estado)"
              size="16"
              :title="processLabel(item.validacion_estado)"
            />
            <span class="text-truncate envios-cell-partner">{{
              item.partner_rag_soc || item.id_anagrafica_partn
            }}</span>
          </div>
        </template>

        <template #[`item.canal`]="{ item }">
          <span class="text-no-wrap">{{ channelLabel(item) }}</span>
          <div
            v-if="item.intermediario_codice"
            class="text-caption text-medium-emphasis"
          >
            {{ item.intermediario_codice }}
          </div>
        </template>

        <template #[`item.numero`]="{ item }">
          <span class="text-no-wrap">
            <v-icon
              v-if="item.es_primero"
              icon="mdi-star"
              color="amber-darken-2"
              size="14"
              :title="t('invoicing.envios.first_of_series')"
            />
            {{ item.numero_alfanum || item.numero }}
          </span>
          <v-chip
            v-if="item.tipo_documento === 'AUTOFACTURA'"
            size="x-small"
            variant="tonal"
            color="indigo"
            class="ml-1"
            :title="t('invoicing.envios.autofactura.hint')"
          >
            {{ item.cod_sdi_TD || t("invoicing.envios.autofactura.label") }}
          </v-chip>
          <div
            v-if="store.tab === 'retenidas' && item.motivos.length"
            class="text-caption text-warning envios-reasons"
          >
            {{ item.motivos.join(" · ") }}
          </div>
          <div
            v-else-if="store.tab === 'rechazadas' && item.error"
            class="text-caption text-error envios-reasons"
          >
            {{ item.error }}
          </div>
        </template>

        <template #[`item.total`]="{ item }">
          <span class="text-no-wrap">{{ totalOf(item) }}</span>
        </template>

        <template #[`item.verificacion`]="{ item }">
          <v-chip
            v-if="item.tipo_documento === 'AUTOFACTURA'"
            size="x-small"
            variant="tonal"
            :color="item.autofactura?.ok ? 'success' : 'error'"
            :title="t('invoicing.envios.autofactura.xsd_hint')"
            @click="openDetail(item, 'verificacion')"
          >
            {{
              item.autofactura?.ok
                ? t("invoicing.envios.autofactura.xsd_ok")
                : t("invoicing.envios.autofactura.xsd_ko")
            }}
          </v-chip>
          <v-chip
            v-else
            size="x-small"
            variant="tonal"
            :color="certColor(item.cert_resultado)"
            @click="openDetail(item, 'verificacion')"
          >
            {{ certLabel(item.cert_resultado) }}
          </v-chip>
        </template>

        <template #[`item.restante`]="{ item }">
          <v-chip
            v-if="item.semaforo"
            size="x-small"
            variant="flat"
            :color="lightColor(item.semaforo)"
          >
            {{ remainingLabel(item.dias_restantes) }}
          </v-chip>
        </template>

        <template #[`item.estado`]="{ item }">
          <v-chip size="x-small" variant="tonal" :color="stateColor(item)">
            {{ stateLabel(item) }}
          </v-chip>
          <div
            v-if="item.acuse_codigo"
            class="text-caption text-medium-emphasis"
          >
            {{ item.acuse_codigo }}
          </div>
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="d-flex align-center flex-nowrap">
            <v-btn
              v-if="item.tipo_documento !== 'AUTOFACTURA'"
              icon="mdi-file-pdf-box"
              size="x-small"
              variant="text"
              :title="t('invoicing.envios.actions.view_pdf')"
              @click="viewPdf(item)"
            />
            <v-btn
              icon="mdi-xml"
              size="x-small"
              variant="text"
              :title="t('invoicing.envios.actions.view_xml')"
              @click="viewXml(item)"
            />
            <v-btn
              icon="mdi-check-decagram-outline"
              size="x-small"
              variant="text"
              :title="t('invoicing.envios.actions.view_verification')"
              @click="openDetail(item, 'verificacion')"
            />
            <v-btn
              v-if="canSend(item)"
              icon="mdi-send"
              size="x-small"
              variant="text"
              color="primary"
              :loading="store.working"
              :title="t('invoicing.envios.actions.send')"
              @click="sendOne(item)"
            />
            <v-btn
              v-if="canRetry(item)"
              icon="mdi-reload"
              size="x-small"
              variant="text"
              color="warning"
              :loading="store.working"
              :title="t('invoicing.envios.actions.retry')"
              @click="retryOne(item)"
            />
            <v-btn
              v-if="item.tiene_fichero"
              icon="mdi-download"
              size="x-small"
              variant="text"
              :title="t('invoicing.envios.actions.download_file')"
              @click="store.downloadFile(item.id)"
            />
            <v-btn
              v-if="canUpload(item)"
              icon="mdi-upload"
              size="x-small"
              variant="text"
              color="success"
              :title="t('invoicing.envios.actions.upload_receipt')"
              @click="openUpload(item)"
            />
            <v-btn
              icon="mdi-information-outline"
              size="x-small"
              variant="text"
              :title="t('invoicing.envios.actions.detail')"
              @click="openDetail(item, 'resumen')"
            />
          </div>
        </template>

        <template #no-data>
          <div class="text-medium-emphasis py-6">
            {{ t(`invoicing.envios.empty.${store.tab}`) }}
          </div>
        </template>
      </v-data-table-server>
    </div>

    <EnvioDetailDialog
      v-model="detailOpen"
      :detail="detail"
      :loading="detailLoading"
      :initial-section="detailSection"
      @download-receipt="store.downloadReceipt"
    />
    <UploadReceiptDialog
      v-model="uploadOpen"
      :row="uploadRow"
      :busy="store.working"
      @submit="onUpload"
    />
  </DashboardShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import EnvioDetailDialog from "../components/envios/EnvioDetailDialog.vue";
import UploadReceiptDialog from "../components/envios/UploadReceiptDialog.vue";
import { useEnviosStore } from "../stores/envios.store";
import { enviosService } from "../services/envios.service";
import { useToastStore } from "../stores/toast.store";
import {
  downloadBase64,
  downloadText,
  einvoiceService,
} from "../services/einvoice.service";
import type {
  EnvioDetail,
  EnvioRow,
  EnviosFilters,
  EnviosTab,
  SendResult,
} from "../services/envios.service";

const { t, locale } = useI18n();
const router = useRouter();
const store = useEnviosStore();
const toasts = useToastStore();

const tabs: Array<{ value: EnviosTab; icon: string; color: string }> = [
  { value: "listas", icon: "mdi-tray-full", color: "primary" },
  { value: "enviadas", icon: "mdi-send-clock", color: "info" },
  { value: "aceptadas", icon: "mdi-check-circle-outline", color: "success" },
  { value: "rechazadas", icon: "mdi-close-octagon-outline", color: "error" },
  { value: "retenidas", icon: "mdi-pause-octagon-outline", color: "warning" },
];

const paises = ["IT", "DE", "NL", "ES", "FR"];
const canales = ["SDI", "PEPPOL", "EMAIL"];

const venceItems = computed(() => [
  { value: "", label: t("invoicing.envios.filters.vence_all") },
  { value: "vencido", label: t("invoicing.envios.filters.vence_overdue") },
  { value: "hoy", label: t("invoicing.envios.filters.vence_today") },
  { value: "7d", label: t("invoicing.envios.filters.vence_7d") },
]);

const draft = reactive<EnviosFilters>({ ...store.filters });

const headers = computed(() => [
  { title: t("invoicing.envios.col.partner"), key: "partner", sortable: false },
  { title: t("invoicing.envios.col.channel"), key: "canal", sortable: false },
  { title: t("invoicing.envios.col.numero"), key: "numero", sortable: false },
  {
    title: t("invoicing.envios.col.fecha"),
    key: "data_fattura",
    sortable: false,
  },
  {
    title: t("invoicing.envios.col.cliente"),
    key: "cliente_rag_soc",
    sortable: false,
  },
  {
    title: t("invoicing.envios.col.total"),
    key: "total",
    sortable: false,
    align: "end" as const,
  },
  {
    title: t("invoicing.envios.col.verificacion"),
    key: "verificacion",
    sortable: false,
  },
  {
    title: t("invoicing.envios.col.deadline"),
    key: "plazo_limite",
    sortable: false,
  },
  {
    title: t("invoicing.envios.col.remaining"),
    key: "restante",
    sortable: false,
  },
  { title: t("invoicing.envios.col.estado"), key: "estado", sortable: false },
  {
    title: t("common.actions"),
    key: "actions",
    sortable: false,
    align: "end" as const,
  },
]);

const selectedModel = computed<number[]>({
  get: () => store.selected,
  set: (v) => {
    store.selected = v;
  },
});

// ── Detalle / verificación ───────────────────────────────────────────
const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<EnvioDetail | null>(null);
const detailSection = ref<"resumen" | "verificacion" | "acuses">("resumen");

async function openDetail(
  row: EnvioRow,
  section: "resumen" | "verificacion" | "acuses",
): Promise<void> {
  detailSection.value = section;
  detail.value = null;
  detailOpen.value = true;
  detailLoading.value = true;
  detail.value = await store.detail(row.id);
  detailLoading.value = false;
}

// ── Acuse ────────────────────────────────────────────────────────────
const uploadOpen = ref(false);
const uploadRow = ref<EnvioRow | null>(null);

function openUpload(row: EnvioRow): void {
  uploadRow.value = row;
  uploadOpen.value = true;
}

async function onUpload(payload: {
  id: number;
  filename: string;
  contentBase64: string;
  resultado?: "ACEPTADA" | "RECHAZADA";
}): Promise<void> {
  const res = await store.uploadReceipt(
    payload.id,
    payload.filename,
    payload.contentBase64,
    payload.resultado,
  );
  if (!res) return;
  uploadOpen.value = false;
  if (res.duplicado) {
    toasts.push("info", t("invoicing.envios.toast.receipt_duplicate"));
    return;
  }
  toasts.push(
    res.estado === "ACEPTADA" ? "success" : "warning",
    t("invoicing.envios.toast.receipt_applied", {
      codigo: res.codigo,
      estado: t(`invoicing.envios.estado.${res.estado}`),
    }),
  );
  for (const aviso of res.avisos) toasts.push("warning", aviso, 8000);
}

// ── Envío ────────────────────────────────────────────────────────────
function reportResults(results: SendResult[]): void {
  const ok = results.filter((r) => r.ok);
  const ko = results.filter((r) => !r.ok);
  if (ok.length) {
    const manual = ok.some((r) => r.entrega_manual);
    toasts.push(
      "success",
      manual
        ? t("invoicing.envios.toast.sent_manual", { n: ok.length })
        : t("invoicing.envios.toast.sent", { n: ok.length }),
      manual ? 8000 : 4000,
    );
  }
  for (const r of ko) {
    toasts.push(
      "error",
      t("invoicing.envios.toast.failed", { id: r.id, error: r.error ?? "" }),
      8000,
    );
  }
}

async function sendOne(row: EnvioRow): Promise<void> {
  const results = await store.send([row.id]);
  reportResults(results);
  // Con el intermediario MANUAL se descarga el fichero en el momento.
  if (results[0]?.ok && results[0].entrega_manual) {
    await store.downloadFile(row.id);
  }
}

async function sendSelected(): Promise<void> {
  reportResults(await store.send([...store.selected]));
}

async function retryOne(row: EnvioRow): Promise<void> {
  const res = await store.retry(row.id);
  if (!res) return;
  reportResults([res]);
  if (res.ok && res.entrega_manual) {
    await store.downloadFile(res.id);
  }
}

function canSend(row: EnvioRow): boolean {
  return store.puedeEnviar && row.pestana === "listas";
}

function canRetry(row: EnvioRow): boolean {
  return (
    store.puedeEnviar &&
    (row.estado === "RECHAZADA" ||
      row.estado === "ERROR" ||
      (row.estado === "PENDIENTE" &&
        !row.enviado &&
        !!row.error &&
        !row.retenida))
  );
}

function canUpload(row: EnvioRow): boolean {
  return (
    store.puedeEnviar &&
    (row.estado === "ENVIADA" ||
      (row.estado === "PENDIENTE" && !!row.enviado) ||
      row.estado === "ACEPTADA")
  );
}

// ── Documentos ───────────────────────────────────────────────────────
async function viewPdf(row: EnvioRow): Promise<void> {
  try {
    const pdf = await einvoiceService.pdf(row.id_fattura);
    downloadBase64(
      pdf.base_64,
      pdf.file_name,
      pdf.mime_type || "application/pdf",
    );
  } catch (e) {
    toasts.push("error", String(e));
  }
}

async function viewXml(row: EnvioRow): Promise<void> {
  if (row.tiene_fichero) {
    await store.downloadFile(row.id);
    return;
  }
  try {
    if (row.tipo_documento === "AUTOFACTURA") {
      const af = await enviosService.autofacturaXml(row.id_fattura);
      downloadText(af.content, af.filename, af.mime_type ?? "application/xml");
      return;
    }
    const doc = await einvoiceService.einvoice(row.id_fattura);
    downloadText(
      doc.content ?? doc.document ?? "",
      doc.filename,
      doc.mime_type ?? "application/xml",
    );
  } catch (e) {
    toasts.push("error", String(e));
  }
}

// ── Presentación ─────────────────────────────────────────────────────
function channelLabel(row: EnvioRow): string {
  if (!row.canal_tipo) return t("invoicing.envios.no_channel");
  return [row.canal_pais, row.canal_tipo, row.canal_formato]
    .filter(Boolean)
    .join(" · ");
}

function totalOf(row: EnvioRow): string {
  const total = Number(row.importo_netto ?? 0) + Number(row.importo_iva ?? 0);
  try {
    return new Intl.NumberFormat(locale.value, {
      style: "currency",
      currency: row.valuta_sigla || "EUR",
    }).format(total);
  } catch {
    return total.toFixed(2);
  }
}

function processIcon(estado?: string | null): string {
  switch (estado) {
    case "VALIDADO":
      return "mdi-shield-check";
    case "EN_VALIDACION":
      return "mdi-shield-half-full";
    case "REVALIDAR":
      return "mdi-shield-alert";
    default:
      return "mdi-shield-off-outline";
  }
}

function processColor(estado?: string | null): string {
  switch (estado) {
    case "VALIDADO":
      return "success";
    case "EN_VALIDACION":
      return "info";
    case "REVALIDAR":
      return "warning";
    default:
      return "grey";
  }
}

function processLabel(estado?: string | null): string {
  return t(`invoicing.envios.process.${estado || "NO_VALIDADO"}`);
}

function certColor(c?: string | null): string {
  if (!c) return "grey";
  return c === "CERTIFICADA" ? "success" : "error";
}

function certLabel(c?: string | null): string {
  if (!c) return t("invoicing.envios.verification.short_none");
  return c === "CERTIFICADA"
    ? t("invoicing.envios.verification.short_ok")
    : t("invoicing.envios.verification.short_ko");
}

function lightColor(s: string | null): string {
  return s === "rojo" ? "error" : s === "ambar" ? "warning" : "success";
}

function remainingLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return t("invoicing.envios.remaining.overdue", { n: -days });
  if (days === 0) return t("invoicing.envios.remaining.today");
  return t("invoicing.envios.remaining.days", { n: days });
}

function stateLabel(row: EnvioRow): string {
  if (row.estado === "PENDIENTE" && row.enviado) {
    return t("invoicing.envios.estado.ESPERANDO_ACUSE");
  }
  if (row.estado === "PENDIENTE" && row.retenida) {
    return t("invoicing.envios.estado.RETENIDA");
  }
  return t(`invoicing.envios.estado.${row.estado}`);
}

function stateColor(row: EnvioRow): string {
  switch (row.estado) {
    case "ACEPTADA":
      return "success";
    case "RECHAZADA":
    case "ERROR":
      return "error";
    case "ENVIADA":
      return "info";
    default:
      return row.enviado ? "info" : row.retenida ? "warning" : "primary";
  }
}

// ── Navegación y carga ───────────────────────────────────────────────
function apply(): void {
  store.applyFilters({ ...draft, partner: draft.partner || null });
}

function clearQ(): void {
  draft.q = "";
  apply();
}

function onPage(p: number): void {
  store.page = p;
  void store.load();
}

function onPerPage(n: number): void {
  store.perPage = n;
  store.page = 1;
  void store.load();
}

function goToList(): void {
  void router.push({ name: "invoicing-list" });
}

onMounted(() => {
  void store.load();
});

onBeforeUnmount(() => {
  store.reset();
});
</script>

<style scoped>
.envios-filters {
  display: grid;
  grid-template-columns: minmax(200px, 2fr) repeat(4, minmax(120px, 1fr)) auto;
  gap: 8px;
  align-items: center;
}

@media (max-width: 960px) {
  .envios-filters {
    grid-template-columns: 1fr 1fr;
  }
}

.envios-cell-partner {
  max-width: 180px;
}

.envios-reasons {
  max-width: 320px;
  white-space: normal;
}

.sidebar-action {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.85rem;
  text-align: left;
}

.sidebar-action:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.sidebar-action--rail {
  justify-content: center;
  padding: 8px;
}

.sidebar-action-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
