<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        <v-icon icon="mdi-receipt-text-plus" size="20" class="me-2" />
        {{ t("invoicing.invoice.new") }}
      </v-card-title>

      <v-card-text>
        <!-- Autocomplete de cliente (búsqueda remota; one-way + onPick +
             mergedItems para que el nombre se conserve tras seleccionar). -->
        <v-autocomplete
          :model-value="clientId"
          :items="mergedItems"
          :loading="searching"
          item-title="label"
          item-value="id"
          :label="t('invoicing.invoice.client')"
          density="comfortable"
          variant="outlined"
          no-filter
          clearable
          hide-details
          class="mb-3"
          @update:search="onSearch"
          @update:model-value="onPick"
        >
          <template #no-data>
            <div class="px-3 py-2 text-medium-emphasis text-body-2">
              {{ searching ? t("common.loading") : "—" }}
            </div>
          </template>
        </v-autocomplete>

        <!-- Atajos de rango -->
        <div class="d-flex ga-2 mb-2">
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-calendar-arrow-left"
            @click="setPreviousMonth"
          >
            {{ t("invoicing.invoice.range.prev_month") }}
          </v-btn>
          <v-btn size="small" variant="text" @click="setCurrentMonth">
            {{ t("invoicing.invoice.range.current_month") }}
          </v-btn>
        </div>

        <!-- Rango de fechas -->
        <div class="d-flex ga-2 mb-3">
          <v-text-field
            v-model="dal"
            :label="t('invoicing.invoice.filters.date_from')"
            type="date"
            density="comfortable"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-model="al"
            :label="t('invoicing.invoice.filters.date_to')"
            type="date"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </div>

        <!-- Preview de facturables -->
        <v-alert
          v-if="clientId && previewError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-1"
        >
          {{ t("invoicing.invoice.preview_error") }}
          <template #append>
            <v-btn
              size="small"
              variant="text"
              @click="clientId && loadPreview(clientId)"
            >
              {{ t("common.retry") }}
            </v-btn>
          </template>
        </v-alert>
        <v-alert
          v-else-if="clientId && previewLoaded"
          :type="billableCount > 0 ? 'info' : 'warning'"
          variant="tonal"
          density="compact"
          class="mb-1"
        >
          <template v-if="billableCount > 0">
            {{ billableCount }}
            {{ t("invoicing.invoice.title_plural").toLowerCase() }} ·
            {{ t("invoicing.invoice.total") }}: {{ money(billableTotal) }}
          </template>
          <template v-else-if="notBillableReason">
            {{ notBillableReason }}
          </template>
          <template v-else>
            {{ t("invoicing.invoice.no_billable") }}
          </template>
        </v-alert>
        <div
          v-else-if="clientId && previewLoading"
          class="text-medium-emphasis text-body-2"
        >
          {{ t("common.loading") }}
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
        <v-btn
          color="primary"
          :loading="generating"
          :disabled="!clientId || billableCount === 0"
          @click="generate"
        >
          {{ t("invoicing.actions.generate_batch") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { anagraficaService } from "../../services/anagrafica.service";
import {
  invoiceService,
  type BillableDiagnostic,
} from "../../services/invoice.service";
import { useToastStore } from "../../stores/toast.store";

const props = defineProps<{
  modelValue: boolean;
  // Contexto del botón "Genera fattura" del detalle cargo/courier (fattsw3):
  // cliente preseleccionado + expedición concreta a facturar.
  prefillClient?: number | null;
  prefillShipment?: number | null;
  // Tabla de la expedición (express/cargo): sus ids no son comparables entre sí.
  prefillShipmentTipo?: ShipmentTipo | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  created: [number];
}>();

const { t } = useI18n();
const router = useRouter();
const toasts = useToastStore();

type ShipmentTipo = "express" | "cargo";

interface ClientItem {
  id: number;
  label: string;
}

const clientId = ref<number | null>(null);
const clientItems = ref<ClientItem[]>([]);
// Cliente elegido (id + label). Se mantiene en la lista de items para que el
// autocomplete pueda resolver id→nombre aunque la búsqueda cambie los items
// (si no, Vuetify mostraría el id crudo). Regla: feedback_vuetify_autocomplete_remote.
const selectedClient = ref<ClientItem | null>(null);
const searching = ref(false);

/** Items que ve el autocomplete = resultados de búsqueda + el seleccionado. */
const mergedItems = computed<ClientItem[]>(() => {
  const items = [...clientItems.value];
  const sel = selectedClient.value;
  if (sel && !items.some((i) => i.id === sel.id)) {
    items.unshift(sel);
  }
  return items;
});

// Por defecto: el MES ANTERIOR completo (día 1 → último día).
const [defaultDal, defaultAl] = monthRange(-1);
const dal = ref(defaultDal);
const al = ref(defaultAl);

const previewLoading = ref(false);
const previewLoaded = ref(false);
const previewError = ref(false);
const diagnostics = ref<BillableDiagnostic[]>([]);
const billableCount = ref(0);
const billableTotal = ref(0);

const generating = ref(false);

/** Motivo concreto por el que la expedición pedida no se puede facturar. */
function reasonText(list: BillableDiagnostic[]): string {
  const d = list[0];
  return d ? t(`invoicing.invoice.not_billable.${d.code}`) : "";
}
const notBillableReason = computed<string>(() => reasonText(diagnostics.value));

let searchTimer: ReturnType<typeof setTimeout> | null = null;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function money(v: number): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

/** Formatea año/mes/día en local (evita el desfase UTC de toISOString). */
function fmt(year: number, monthIdx: number, day: number): string {
  const mm = String(monthIdx + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Rango [día 1, último día] de un mes relativo al actual.
 * offset 0 = mes actual, -1 = mes anterior.
 */
function monthRange(offset: number): [string, string] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return [
    fmt(first.getFullYear(), first.getMonth(), 1),
    fmt(last.getFullYear(), last.getMonth(), last.getDate()),
  ];
}

function setPreviousMonth(): void {
  [dal.value, al.value] = monthRange(-1);
}
function setCurrentMonth(): void {
  [dal.value, al.value] = monthRange(0);
}

// Búsqueda remota con debounce. one-way (:model-value) + onPick (regla del proyecto).
function onSearch(text: string): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = (text ?? "").trim();
    if (q.length < 2) {
      clientItems.value = [];
      return;
    }
    searching.value = true;
    try {
      const rows = await anagraficaService.search(q);
      clientItems.value = rows
        .filter((a) => Number(a.id) > 0)
        .map((a) => ({
          id: Number(a.id),
          // Solo el nombre (el id va como item-value, no se muestra).
          label: (a.rag_soc || a.nome_breve || `Cliente #${a.id}`)
            .toString()
            .trim(),
        }));
    } catch {
      clientItems.value = [];
    } finally {
      searching.value = false;
    }
  }, 250);
}

function onPick(id: number | null): void {
  clientId.value = id;
  if (id) {
    // Guardar el cliente elegido (con su nombre) para que el campo lo muestre
    // aunque los items de búsqueda cambien después.
    selectedClient.value =
      mergedItems.value.find((i) => i.id === id) ?? selectedClient.value;
    void loadPreview(id);
  } else {
    selectedClient.value = null;
    resetPreview();
  }
}

async function loadPreview(id: number): Promise<void> {
  previewLoading.value = true;
  previewLoaded.value = false;
  previewError.value = false;
  diagnostics.value = [];
  try {
    const params: Record<string, string> = {
      data_da: dal.value,
      data_a: al.value,
    };
    // Si venimos del botón del detalle, restringimos a esa expedición (fattsw3).
    if (props.prefillShipment) {
      params.id_spediz = String(props.prefillShipment);
      if (props.prefillShipmentTipo) params.tipo = props.prefillShipmentTipo;
    }
    const res = await invoiceService.billableShipments(id, params);
    diagnostics.value = res.diagnostics ?? [];
    const items = (res.data ?? []) as Array<{
      shipment_count?: number;
      total?: number;
    }>;
    // El endpoint devuelve los clientes facturables (filtrado por id_anagrafica → 1).
    const c = items[0] ?? {};
    billableCount.value = Number(c.shipment_count ?? items.length ?? 0);
    billableTotal.value = Number(c.total ?? 0);
    previewLoaded.value = true;
  } catch {
    // Un fallo de carga NO es «nada facturable»: se avisa aparte.
    billableCount.value = 0;
    billableTotal.value = 0;
    previewError.value = true;
  } finally {
    previewLoading.value = false;
  }
}

function resetPreview(): void {
  previewLoaded.value = false;
  previewError.value = false;
  diagnostics.value = [];
  billableCount.value = 0;
  billableTotal.value = 0;
}

async function generate(): Promise<void> {
  if (!clientId.value || billableCount.value === 0) return;
  generating.value = true;
  try {
    const body: Record<string, unknown> = {
      id_anagrafica: [clientId.value],
      data_fattura: today(),
      dal: dal.value,
      al: al.value,
    };
    // Facturar SOLO esta expedición si venimos del botón del detalle (fattsw3).
    if (props.prefillShipment) {
      if (props.prefillShipmentTipo) {
        body.shipment_refs = [
          { tipo: props.prefillShipmentTipo, id: props.prefillShipment },
        ];
      } else {
        body.id_spediz = props.prefillShipment;
      }
    }
    const res = await invoiceService.generateBatch(body);
    const generated = res.generated;
    if (generated.length === 0) {
      // Sin factura: el motivo concreto si el backend lo dio; si hubo errores,
      // se muestran; solo al final el aviso genérico.
      diagnostics.value = res.diagnostics;
      const reason = reasonText(res.diagnostics);
      const failure = res.errors
        .map((e) => (e as { error?: string })?.error)
        .find((m): m is string => !!m);
      if (reason) {
        toasts.push("warning", reason);
      } else if (failure) {
        toasts.push("error", failure);
      } else {
        toasts.push("warning", t("invoicing.invoice.no_billable"));
      }
      return;
    }
    if (res.errors.length > 0) {
      toasts.push(
        "warning",
        `${res.errors.length} ${t("invoicing.invoice.partial_errors")}`,
      );
    }
    toasts.push(
      "success",
      `${generated.length} ${t("invoicing.invoice.title_plural").toLowerCase()}`,
    );
    const first = generated[0]?.id_fattura;
    emit("created", generated.length);
    close();
    if (first) {
      router.push({ name: "invoicing-detail", params: { id: String(first) } });
    }
  } catch (e) {
    toasts.push("error", String(e));
  } finally {
    generating.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}

// Reset al cerrar; recargar preview si cambia el rango con cliente elegido.
// immediate: si el dialog se monta YA abierto con prefill (botón "Genera fattura"
// del detalle cargo/courier que abre invoicing con ?new=1&client=&shipment=),
// la inicialización debe correr en el mount, no solo en un cambio posterior.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      // Al abrir, el rango por defecto es el mes anterior.
      [dal.value, al.value] = monthRange(-1);
      // Contexto del detalle cargo/courier (fattsw3): cliente preseleccionado +
      // expedición concreta. Al facturar UNA expedición, su fecha puede caer
      // fuera del mes anterior → ampliamos el rango para no excluirla.
      if (props.prefillClient) {
        if (props.prefillShipment) {
          dal.value = "2000-01-01";
          al.value = today();
        }
        clientId.value = props.prefillClient;
        selectedClient.value = {
          id: props.prefillClient,
          label: `Cliente #${props.prefillClient}`,
        };
        void resolveClientLabel(props.prefillClient);
        void loadPreview(props.prefillClient);
      }
    } else {
      clientId.value = null;
      clientItems.value = [];
      selectedClient.value = null;
      resetPreview();
    }
  },
  { immediate: true },
);

/** Resuelve el nombre real del cliente preseleccionado (el prefill solo trae el id). */
async function resolveClientLabel(id: number): Promise<void> {
  try {
    const a = await anagraficaService.getById(id);
    const label = (a?.rag_soc || `Cliente #${id}`).toString().trim();
    selectedClient.value = { id, label };
  } catch {
    /* deja el placeholder #id */
  }
}
watch([dal, al], () => {
  if (clientId.value) void loadPreview(clientId.value);
});
</script>
