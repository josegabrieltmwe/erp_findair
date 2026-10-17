<template>
  <DetailShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
    <!-- Marca: número + estado (fila 1) y fecha · cliente (subtítulo, fila 2). -->
    <template #topbar-title>
      <div class="invoice-head">
        <div class="d-flex align-center ga-3 flex-wrap">
          <v-btn
            variant="text"
            icon="mdi-arrow-left"
            size="small"
            :to="{ name: 'invoicing-list' }"
          />
          <img
            v-if="inv?.partner_logo"
            :src="inv.partner_logo"
            alt="logo"
            class="partner-logo"
          />
          <v-icon v-else icon="mdi-receipt-text" size="22" color="primary" />
          <span class="text-h6 mb-0"
            >{{ t("invoicing.invoice.title") }} {{ inv?.numero ?? "" }}</span
          >
          <v-chip :color="sdiColor(inv?.stato_sdi ?? 'N')" size="small" label>
            {{ store.sdi?.stato_label ?? t(`sdi.${inv?.stato_sdi ?? "N"}`) }}
          </v-chip>
          <v-chip
            v-if="store.locked"
            color="warning"
            size="small"
            label
            prepend-icon="mdi-lock"
          >
            {{ t("invoicing.invoice.locked") }}
          </v-chip>
        </div>
        <div class="text-medium-emphasis text-body-2 invoice-head__meta">
          {{ inv?.data_fattura }} · {{ inv?.cliente?.rag_soc }}
        </div>
      </div>
    </template>

    <!-- Acciones (lectura siempre; escritura según capacidades) -->
    <template #topbar-actions>
      <v-btn
        variant="tonal"
        prepend-icon="mdi-file-pdf-box"
        :loading="busy.pdf"
        @click="downloadPdf"
      >
        {{ t("invoicing.actions.download_pdf") }}
      </v-btn>
      <v-btn
        variant="tonal"
        prepend-icon="mdi-file-xml-box"
        :loading="busy.einvoice"
        @click="downloadEInvoice"
      >
        {{ t("invoicing.actions.download_einvoice") }}
      </v-btn>
      <v-btn
        v-if="caps.canWrite"
        variant="tonal"
        prepend-icon="mdi-calculator"
        :disabled="store.locked"
        :loading="store.saving"
        @click="store.recalculate()"
      >
        {{ t("invoicing.actions.recalculate") }}
      </v-btn>
      <v-btn
        v-if="canTransmit(caps, audience())"
        color="primary"
        prepend-icon="mdi-send"
        :disabled="store.locked"
        :loading="store.saving"
        @click="store.transmit()"
      >
        {{ t("invoicing.actions.transmit") }}
      </v-btn>
      <v-btn
        v-if="caps.canWrite"
        variant="tonal"
        color="error"
        prepend-icon="mdi-file-document-minus"
        @click="creditNoteOpen = true"
      >
        {{ t("invoicing.actions.credit_note") }}
      </v-btn>
      <!-- Solo para facturas RECHAZADAS por SDI (stato_sdi='K'): remediación
           (nota de crédito TD04 + reasignación de expediciones). -->
      <v-btn
        v-if="caps.canWrite && inv?.stato_sdi === 'K'"
        variant="tonal"
        color="warning"
        prepend-icon="mdi-file-restore"
        :loading="busy.remediate"
        @click="remediate"
      >
        {{ t("invoicing.actions.remediate") }}
      </v-btn>
    </template>

    <!-- Menú universal (sustituye a PlatformSidebar vía `hide-platform-nav`). -->
    <template #nav="{ collapsed }">
      <OperationsNav :collapsed="collapsed" />
    </template>

    <!-- Sidebar: estado SDI + timeline — bajo #nav -->
    <template #sidebar="{ collapsed }">
      <div v-if="!collapsed" class="pa-4">
        <div class="text-overline mb-3 d-flex align-center">
          <v-icon icon="mdi-timeline-clock-outline" size="18" class="me-2" />
          {{ t("invoicing.invoice.timeline") }}
        </div>
        <v-timeline
          v-if="timeline.length"
          density="compact"
          side="end"
          align="start"
          truncate-line="both"
        >
          <v-timeline-item
            v-for="(ev, i) in timeline"
            :key="i"
            size="x-small"
            :dot-color="eventColor(ev.type)"
          >
            <div class="text-body-2">{{ ev.label }}</div>
            <div class="text-caption text-medium-emphasis">{{ ev.at }}</div>
          </v-timeline-item>
        </v-timeline>
        <div v-else class="text-medium-emphasis text-body-2">—</div>
      </div>
      <div v-else class="d-flex flex-column align-center pt-3">
        <v-icon icon="mdi-timeline-clock-outline" size="20" />
      </div>
    </template>

    <!-- Estado: cargando -->
    <v-container v-if="store.loading" fluid class="pa-6 d-flex justify-center">
      <v-progress-circular
        indeterminate
        color="primary"
        size="40"
        class="mt-12"
      />
    </v-container>

    <!-- Estado: factura no encontrada / error -->
    <v-container v-else-if="!inv" fluid class="pa-6">
      <v-card variant="flat" class="invoice-list-card text-center pa-10">
        <v-icon
          icon="mdi-receipt-text-remove"
          size="48"
          color="medium-emphasis"
          class="mb-3"
        />
        <div class="text-h6 mb-1">{{ t("invoicing.invoice.not_found") }}</div>
        <div class="text-medium-emphasis mb-4">
          {{ store.error || `#${props.id}` }}
        </div>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-arrow-left"
          :to="{ name: 'invoicing-list' }"
        >
          {{ t("invoicing.invoice.list") }}
        </v-btn>
      </v-card>
    </v-container>

    <!-- Contenido: líneas + totales -->
    <v-container v-else fluid class="pa-6">
      <!-- Resumen de importes -->
      <v-row class="mb-6">
        <v-col cols="12" sm="4">
          <v-card variant="tonal" color="primary" class="text-center pa-4">
            <div class="text-caption text-medium-emphasis mb-1">
              {{ t("invoicing.invoice.net") }}
            </div>
            <div class="text-h6">{{ money(inv?.importo_netto ?? 0) }}</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="4">
          <v-card variant="tonal" class="text-center pa-4">
            <div class="text-caption text-medium-emphasis mb-1">
              {{ t("invoicing.invoice.vat") }}
            </div>
            <div class="text-h6">{{ money(inv?.importo_iva ?? 0) }}</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="4">
          <v-card variant="flat" color="success" class="text-center pa-4">
            <div class="text-caption mb-1">
              {{ t("invoicing.invoice.total") }}
            </div>
            <div class="text-h6 font-weight-bold">{{ money(grandTotal) }}</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Destinatario (línea tipo A) en su propia tarjeta, no en la tabla -->
      <v-card
        v-if="customerHeader"
        variant="flat"
        class="invoice-list-card mb-4"
      >
        <v-card-text class="py-3">
          <div class="text-overline text-medium-emphasis mb-1">
            {{ t("invoicing.invoice.client") }}
          </div>
          <div
            class="text-body-2"
            style="white-space: pre-line"
            v-html="customerHeader"
          />
        </v-card-text>
      </v-card>

      <!-- Tabla de líneas con filas alternas -->
      <v-card variant="flat" class="invoice-list-card">
        <v-card-title class="text-subtitle-1 d-flex align-center">
          <v-icon icon="mdi-format-list-bulleted" size="20" class="me-2" />
          {{ t("invoicing.invoice.lines") }}
          <v-chip size="x-small" class="ms-2" variant="tonal">{{
            lines.length
          }}</v-chip>
        </v-card-title>
        <v-divider />
        <v-data-table
          :headers="lineHeaders"
          :items="lines"
          :items-per-page="-1"
          density="comfortable"
          hide-default-footer
          class="invoice-lines"
        >
          <template #[`item.descriz`]="{ item }">
            <span
              :class="{ 'font-weight-medium': isHeaderLine(item) }"
              style="white-space: pre-line"
              >{{ cleanDesc(textoLinea(item)) }}</span
            >
          </template>
          <template #[`item.importo_netto`]="{ item }">
            {{ item.importo_netto ? money(item.importo_netto) : "" }}
          </template>
          <template #[`item.aliquota_iva`]="{ item }">
            <span v-if="hasVatInfo(item)" :class="vatRateClass(item)">
              {{ formatRate(item.aliquota_iva) }}
            </span>
          </template>
          <template #[`item.cod_iva`]="{ item }">
            <v-chip
              v-if="hasVatInfo(item) && item.cod_iva"
              size="x-small"
              variant="tonal"
              label
            >
              {{ item.cod_iva }}
            </v-chip>
          </template>
          <template #[`item.importo_iva`]="{ item }">
            {{ item.importo_iva ? money(item.importo_iva) : "" }}
          </template>
          <template #no-data>
            <div class="pa-6 text-medium-emphasis">—</div>
          </template>
        </v-data-table>
      </v-card>

      <!-- Listado de expediciones (riepilogo) — card colapsable, carga lazy -->
      <v-expansion-panels
        v-model="recapOpen"
        class="invoice-list-card mt-4"
        variant="accordion"
      >
        <v-expansion-panel @group:selected="onRecapToggle">
          <v-expansion-panel-title>
            <v-icon icon="mdi-truck-fast-outline" size="20" class="me-2" />
            {{ t("invoicing.invoice.shipments") }}
            <v-chip
              v-if="recapCount"
              size="x-small"
              class="ms-2"
              variant="tonal"
              >{{ recapCount }}</v-chip
            >
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div v-if="recapLoading" class="d-flex justify-center pa-6">
              <v-progress-circular indeterminate color="primary" size="32" />
            </div>
            <div
              v-else-if="!recapServices.length"
              class="pa-4 text-medium-emphasis"
            >
              —
            </div>
            <div v-else>
              <div v-for="(g, gi) in recapServices" :key="gi" class="mb-4">
                <div class="recap-srv-name">{{ g.service_name }}</div>
                <v-table density="compact" class="recap-table">
                  <thead>
                    <tr>
                      <th>{{ t("invoicing.invoice.date") }}</th>
                      <th>{{ t("invoicing.invoice.recap_dest") }}</th>
                      <th>{{ t("invoicing.invoice.recap_city") }}</th>
                      <th>{{ t("invoicing.invoice.country") }}</th>
                      <th class="text-center">
                        {{ t("invoicing.invoice.recap_colli") }}
                      </th>
                      <th class="text-end">
                        {{ t("invoicing.invoice.recap_weight") }}
                      </th>
                      <th class="text-end">
                        {{ t("invoicing.invoice.recap_cost") }}
                      </th>
                      <th class="text-end">
                        {{ t("invoicing.invoice.recap_fuel") }}
                      </th>
                      <th class="text-end">
                        {{ t("invoicing.invoice.total") }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(s, si) in g.rows" :key="si">
                      <td>{{ s.data }}</td>
                      <td>{{ s.dest }}</td>
                      <td>{{ s.citta }}</td>
                      <td>{{ s.paese }}</td>
                      <td class="text-center">{{ s.colli }}</td>
                      <td class="text-end">{{ s.peso }}</td>
                      <td class="text-end">{{ s.costo }}</td>
                      <td class="text-end">{{ s.fuel }}</td>
                      <td class="text-end">{{ s.totale }}</td>
                    </tr>
                    <tr class="recap-subtot">
                      <td colspan="6">{{ g.service_name }}</td>
                      <td class="text-end">{{ g.tot_costo_fmt }}</td>
                      <td class="text-end">{{ g.tot_fuel_fmt }}</td>
                      <td class="text-end">{{ g.tot_fmt }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <!-- Fuel surcharge (líneas tipo F) -->
      <v-card
        v-if="fuelLines.length"
        variant="flat"
        class="invoice-list-card mt-4"
      >
        <v-card-text class="py-3">
          <div class="text-overline text-medium-emphasis mb-1">
            {{ t("invoicing.invoice.fuel_surcharge") }}
          </div>
          <div
            v-for="(f, i) in fuelLines"
            :key="i"
            class="text-caption"
            v-html="textoLinea(f)"
          />
        </v-card-text>
      </v-card>

      <!-- Cuotas reales de la factura (cobro, reapertura) -->
      <InvoicePaymentsCard
        v-if="store.id && paymentsCaps.canRead"
        :key="store.id"
        :invoice-id="store.id"
        :can-collect="paymentsCaps.canCollect"
        class="mt-4"
      />

      <!-- Condiciones de pago (líneas tipo P) -->
      <v-card
        v-if="paymentLines.length"
        variant="flat"
        class="invoice-list-card mt-4"
      >
        <v-card-text class="py-3">
          <div class="text-overline text-medium-emphasis mb-1">
            {{ t("invoicing.invoice.payments") }}
          </div>
          <div
            v-for="(p, i) in paymentLines"
            :key="i"
            class="text-body-2"
            v-html="textoLinea(p)"
          />
        </v-card-text>
      </v-card>

      <!-- «Por qué»: reglas fiscales que produjeron cada línea (F6b) -->
      <WhyPanel v-if="store.id" :invoice-id="store.id" />
    </v-container>

    <CreditNoteDialog
      v-if="caps.canWrite"
      v-model="creditNoteOpen"
      :invoice-id="store.id ?? 0"
      :lines="allLines"
      @created="onCreditNoteCreated"
    />
  </DetailShell>
</template>

<script setup lang="ts">
import {
  computed,
  reactive,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import DetailShell from "@shared/detail/DetailShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import { useInvoiceStore } from "../stores/invoice.store";
import { useToastStore } from "../stores/toast.store";
import { capabilities, audience } from "../services/http";
import { canTransmit } from "../services/invoiceActions";
import { einvoiceService, downloadText } from "../services/einvoice.service";
import {
  invoiceService,
  type ShipmentRecapGroup,
} from "../services/invoice.service";
import CreditNoteDialog from "../components/invoice/CreditNoteDialog.vue";
import WhyPanel from "../components/invoice/WhyPanel.vue";
import InvoicePaymentsCard from "../../payments/components/InvoicePaymentsCard.vue";
import { capabilities as paymentsCapabilities } from "../../payments/env";

const props = defineProps<{ id: string }>();
const { t } = useI18n();
const router = useRouter();
const store = useInvoiceStore();
const toasts = useToastStore();
const caps = capabilities();
const paymentsCaps = paymentsCapabilities();

const creditNoteOpen = ref(false);
const busy = reactive({ pdf: false, einvoice: false, remediate: false });

// Listado de expediciones (riepilogo) — colapsable, carga lazy al expandir.
const recapOpen = ref<number | undefined>(undefined);
const recapLoading = ref(false);
const recapLoaded = ref(false);
const recapServices = ref<ShipmentRecapGroup[]>([]);
const recapCount = ref(0);

function onRecapToggle(e: { value: boolean }): void {
  if (e.value && !recapLoaded.value && store.id) {
    void loadRecap(store.id);
  }
}

async function loadRecap(id: number): Promise<void> {
  recapLoading.value = true;
  try {
    const res = await invoiceService.shipmentRecap(id);
    recapServices.value = res.services ?? [];
    recapCount.value = res.shipment_count ?? 0;
    recapLoaded.value = true;
  } catch (e) {
    toasts.push("error", String(e));
  } finally {
    recapLoading.value = false;
  }
}

const inv = computed(() => store.invoice);
const allLines = computed(() => store.invoice?.dettagli ?? []);
// La tabla muestra SOLO las líneas de servicio (C/M). El resto (A=cabecera
// cliente, F=fuel, N=resumen IVA, P=condiciones de pago) van en secciones
// propias o se omiten — no como filas sueltas de la tabla.
const lines = computed(() =>
  allLines.value.filter((l) => l.tipo_record === "C" || l.tipo_record === "M"),
);
// Regla: la factura se muestra en el idioma del partner (lingua_fattura).
// Si es EN y la línea tiene descrizEN, se usa; si no, el texto original.
function textoLinea(l: { descriz: string; descrizEN?: string | null }): string {
  return inv.value?.lingua_fattura === "EN" && l.descrizEN
    ? l.descrizEN
    : l.descriz;
}
const customerHeader = computed(() => {
  const a = allLines.value.find((l) => l.tipo_record === "A");
  return a ? textoLinea(a) : "";
});
const fuelLines = computed(() =>
  allLines.value.filter((l) => l.tipo_record === "F"),
);
const paymentLines = computed(() =>
  allLines.value.filter((l) => l.tipo_record === "P"),
);
const timeline = computed(() => store.sdi?.timeline ?? []);

const grandTotal = computed(
  () =>
    Number(inv.value?.importo_netto ?? 0) + Number(inv.value?.importo_iva ?? 0),
);

const lineHeaders = computed(() => [
  { title: t("invoicing.invoice.title"), key: "descriz" },
  {
    title: t("invoicing.invoice.net"),
    key: "importo_netto",
    align: "end" as const,
    width: 130,
  },
  {
    title: t("invoicing.invoice.vat_rate"),
    key: "aliquota_iva",
    align: "end" as const,
    width: 90,
  },
  {
    title: t("invoicing.invoice.vat_code"),
    key: "cod_iva",
    align: "center" as const,
    width: 90,
  },
  {
    title: t("invoicing.invoice.vat"),
    key: "importo_iva",
    align: "end" as const,
    width: 120,
  },
]);

/** La línea tiene info de IVA mostrable (es una línea de servicio C/M). */
function hasVatInfo(line: {
  tipo_record?: string;
  aliquota_iva?: number | null;
}): boolean {
  const t = line.tipo_record ?? "";
  return (t === "C" || t === "M") && line.aliquota_iva != null;
}

/** Formatea la alícuota como porcentaje ("22%", "0%"). */
function formatRate(rate: number | null | undefined): string {
  const n = Number(rate ?? 0);
  return `${n % 1 === 0 ? n : n.toFixed(2)}%`;
}

/** Resalta en verde las líneas exentas (0%) para que se distingan. */
function vatRateClass(line: { aliquota_iva?: number | null }): string {
  return Number(line.aliquota_iva ?? 0) === 0
    ? "text-success font-weight-medium"
    : "";
}

/** Las líneas tipo A (cabecera cliente) van resaltadas. */
function isHeaderLine(line: { tipo_record?: string }): boolean {
  return (line.tipo_record ?? "") === "A";
}

/** El backend mete <br> en la descripción de la cabecera → salto de línea real. */
function cleanDesc(desc: string | null | undefined): string {
  return (desc ?? "").toString().replace(/<br\s*\/?>/gi, "\n");
}

function money(v: number | string): string {
  const cur = inv.value?.valuta_sigla || "EUR";
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}
function sdiColor(s: string): string {
  return (
    { N: "grey", I: "info", O: "success", K: "error", W: "warning" }[s] ??
    "grey"
  );
}
function eventColor(type: string): string {
  if (type.startsWith("sdi_o")) return "success";
  if (type.startsWith("sdi_k")) return "error";
  if (type === "sent") return "info";
  return "primary";
}

/**
 * Abrir la factura en PDF en otra pestaña. El endpoint emite el PDF binario
 * (inline=1) → el navegador lo muestra en su visor. Se abre la pestaña ANTES
 * del await para que el navegador no la bloquee como popup, y luego se navega.
 */
function downloadPdf(): void {
  if (!store.id) return;
  const base = (
    window.__TMWE_INVOICING__?.basePath || "/bff/v1"
  ).replace(/\/$/, "");
  const url = `${base}/api_invoice_pdf?id=${store.id}&format=pdf&inline=1`;
  const win = window.open(url, "_blank");
  if (!win) {
    toasts.push("warning", t("invoicing.invoice.popup_blocked"));
  }
}

async function downloadEInvoice(): Promise<void> {
  if (!store.id) return;
  busy.einvoice = true;
  try {
    const res = await einvoiceService.einvoice(store.id);
    const content = res.content ?? res.document ?? "";
    if (!res.validation?.valid) {
      toasts.push(
        "warning",
        `${t("invoicing.invoice.doc_warnings")}: ${res.validation?.errors?.slice(0, 2).join("; ")}`,
      );
    }
    // Avisos no bloqueantes del builder (ej. EndpointID Peppol asumido por formato,
    // VAT mal formado). El documento se genera igual; el operador revisa antes de subir.
    if (res.warnings?.length) {
      toasts.push("warning", res.warnings.slice(0, 2).join("; "));
    }
    downloadText(content, res.filename, res.mime_type ?? "application/xml");
  } catch (e) {
    toasts.push("error", String(e));
  } finally {
    busy.einvoice = false;
  }
}

/**
 * Remedia una factura RECHAZADA por SDI (stato_sdi='K'): emite una nota de
 * crédito TD04 que la anula + reasigna sus expediciones. Pide confirmación
 * porque crea un documento fiscal y mueve las expediciones.
 */
async function remediate(): Promise<void> {
  if (!store.id || inv.value?.stato_sdi !== "K") return;
  if (!window.confirm(t("invoicing.invoice.remediate_confirm"))) return;
  busy.remediate = true;
  try {
    const res = await einvoiceService.remediateRejected(store.id);
    const ncId = res.data?.id;
    toasts.push("success", t("invoicing.invoice.remediate_done"));
    if (ncId) {
      router.push({ name: "invoicing-detail", params: { id: String(ncId) } });
    } else if (store.id) {
      void store.load(store.id);
    }
  } catch (e) {
    toasts.push("error", String(e));
  } finally {
    busy.remediate = false;
  }
}

function onCreditNoteCreated(): void {
  toasts.push("success", t("invoicing.actions.credit_note"));
  if (store.id) void store.load(store.id);
}

function loadFromRoute(): void {
  const id = Number(props.id);
  if (id > 0) void store.load(id);
}

watch(() => props.id, loadFromRoute);
onMounted(loadFromRoute);
onBeforeUnmount(() => store.reset());
</script>

<style scoped lang="scss">
@use "../styles/invoice_table" as inv;

/* Tabla de líneas de la factura unificada con el estándar visual de los
   listados cargo/shipment (ListingDataView) vía el mixin compartido:
   header gradiente + mayúsculas, zebra (pares .022 / impares base) y hover
   con tinte primario + acento izquierdo. Fuente única: _invoice_table.scss. */
.invoice-lines {
  @include inv.inv-table;
}

/* Contenedor con el borde redondeado + token del proyecto (no el v-card
   variant="outlined" de Vuetify, que pinta un borde duro). */
.invoice-list-card {
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow: hidden;
}

/* Cabecera del topbar: título en una línea, fecha·cliente como subtítulo
   con aire, en vez de todo apretado en una sola fila. */
.invoice-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-block: 2px;
}
.invoice-head__meta {
  padding-left: 4px;
}
.partner-logo {
  max-height: 28px;
  max-width: 120px;
  object-fit: contain;
}

/* Riepilogo de expediciones (card colapsable) */
.recap-srv-name {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  font-size: 13px;
  margin-bottom: 4px;
}
.recap-table :deep(thead th) {
  font-size: 10px;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
}
.recap-table :deep(tbody td) {
  font-size: 11px;
}
.recap-table :deep(tr.recap-subtot td) {
  font-weight: 700;
  background: rgba(var(--v-theme-warning), 0.12);
}
</style>
