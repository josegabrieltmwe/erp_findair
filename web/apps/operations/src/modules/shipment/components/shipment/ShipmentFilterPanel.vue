<template>
  <FilterDrawer
    v-model="open"
    :title="t('filters.advanced_title')"
    :groups="groups"
    :loading="loading"
    :preview-count="previewCount"
    @apply="onApply"
    @clear="onClear"
  >
    <!-- BÁSICOS — id, AWB, RIF, cliente, corriere, note -->
    <template #basics>
      <v-text-field
        v-model="local.id"
        :label="t('filters.shipment.fields.shipment_id')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.AWB_forn"
        :label="t('filters.shipment.fields.awb')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.RIF_cliente"
        :label="t('filters.fields.client_ref')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-autocomplete
        :model-value="selectedClient"
        :items="clientItems"
        :loading="clientSearching"
        :label="t('filters.fields.client_id')"
        item-title="rag_soc"
        item-value="id"
        :no-filter="true"
        hide-no-data
        hide-details
        clearable
        return-object
        density="comfortable"
        variant="outlined"
        @update:search="onClientSearch"
        @update:model-value="onClientPick"
      >
        <template #item="{ props: itemProps, item }">
          <v-list-item v-bind="itemProps">
            <template #subtitle>
              <span
                >{{ item.raw.pi_cf }} — {{ item.raw.citta }}
                {{ item.raw.prov }}</span
              >
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>
      <v-autocomplete
        v-model="local.id_fornitore"
        :items="fornitoreItems"
        :loading="fornitoriLoading"
        :label="t('filters.shipment.fields.courier')"
        item-title="label"
        item-value="id"
        auto-select-first
        hide-details
        clearable
        density="comfortable"
        variant="outlined"
      >
        <template #item="{ props: itemProps, item }">
          <v-list-item
            v-bind="itemProps"
            :subtitle="`${item.raw.count} exp.`"
          />
        </template>
      </v-autocomplete>
      <v-text-field
        v-model="local.note"
        :label="t('filters.fields.notes')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
        :placeholder="t('filters.shipment.fields.notes_ph')"
      />
      <v-switch
        v-model="local.has_contrassegno"
        :label="t('filters.shipment.fields.has_cod')"
        color="primary"
        density="comfortable"
        hide-details
        inset
      />
    </template>

    <!-- DATES TAB -->
    <template #dates>
      <v-select
        v-model="local.date_field"
        :items="dateFieldOptions"
        :label="t('filters.fields.date_field')"
        density="comfortable"
        hide-details
        variant="outlined"
      />
      <v-text-field
        v-model="local.date_from"
        :label="t('filters.fields.from')"
        type="date"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.date_to"
        :label="t('filters.fields.to')"
        type="date"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- LOCATION TAB -->
    <template #location>
      <v-select
        v-model="local.location_type"
        :items="locationScopeOptions"
        :label="t('filters.fields.location_scope')"
        density="comfortable"
        hide-details
        variant="outlined"
      />
      <CmCountrySelect
        :model-value="local.country_iso || null"
        :label="t('filters.shipment.fields.dest_country_iso')"
        clearable
        @update:model-value="local.country_iso = $event || ''"
      />
      <v-text-field
        v-model="local.city"
        :label="t('filters.shipment.fields.dest_city')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- STATES TAB — controllata, consegna_firma, presa_stato, archiviata -->
    <template #states>
      <v-select
        v-model="local.controllata"
        :items="controllataOptions"
        :label="t('filters.fields.controlled')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-select
        v-model="local.consegna_firma"
        :items="consegnaFirmaOptions"
        :label="t('filters.fields.delivered')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-select
        v-model="local.presa_stato"
        :items="presaStatoOptions"
        :label="t('filters.shipment.fields.pickup_status')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-select
        v-model="local.archiviata"
        :items="archivedOptions"
        :label="t('filters.fields.archived')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-checkbox
        v-model="local.has_assicurazione"
        :label="t('filters.fields.has_insurance')"
        density="comfortable"
        hide-details
      />
    </template>

    <!-- WEIGHT TAB -->
    <template #weight>
      <v-text-field
        v-model="local.peso_da"
        :label="t('filters.fields.weight_from')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.peso_a"
        :label="t('filters.fields.weight_to')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.peso_tassax"
        :label="t('filters.shipment.fields.chargeable_weight')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model.number="local.id_servizio"
        :label="t('filters.shipment.fields.service_id')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- STORAGE TAB — giacenze -->
    <template #storage>
      <v-select
        v-model="local.stato_giac"
        :items="statoGiacOptions"
        :label="t('filters.shipment.fields.storage_state')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <p class="text-caption text-medium-emphasis mt-2">
        {{ t("filters.shipment.storage_help") }}
      </p>
    </template>
  </FilterDrawer>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import {
  useShipmentListStore,
  buildShipmentListQuery,
  shipmentResetFilters,
  type ShipmentListUrlState,
} from "@shipment/stores/shipment_list.store";
import CmCountrySelect from "@shared/anagrafiche/components/CmCountrySelect.vue";
import FilterDrawer, {
  type FilterGroup,
} from "@shared/listing/FilterDrawer.vue";
import { shipmentListService } from "@shipment/services/shipment.service";
import {
  anagraficaService,
  type AnagraficaLite,
} from "@shipment/services/anagrafica.service";
import {
  fornitoriService,
  type ShipmentFornitoreOption,
} from "@shipment/services/fornitori.service";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
}>();

const store = useShipmentListStore();
const { state, loading } = storeToRefs(store);

/**
 * Local working copy. All fields here are persisted to the URL via the
 * store's `applyState` (see shipment_list.store.ts). Checkbox-style
 * flags (`has_contrassegno`, `has_assicurazione`) round-trip as 'S'
 * (checked) or '' (unchecked) for backend compatibility.
 */
interface LocalState {
  date_field: ShipmentListUrlState["date_field"];
  date_from: string;
  date_to: string;
  country_iso: string;
  /** Origin ('P') / destination ('D') side of the country filter. */
  location_type: string;
  city: string;
  id: string;
  id_cliente: string;
  AWB_forn: string;
  RIF_cliente: string;
  note: string;
  controllata: string;
  consegna_firma: string;
  presa_stato: string;
  archiviata: string;
  stato_giac: string;
  has_contrassegno: boolean;
  has_assicurazione: boolean;
  id_fornitore: number | string;
  id_servizio: number | string;
  peso_da: string;
  peso_a: string;
  peso_tassax: string;
}

const open = ref(props.modelValue);

/**
 * Campos de cada grupo del panel. Con esto se calcula el contador que cada
 * sección muestra y qué secciones arrancan abiertas.
 *
 * `date_field` NO cuenta: siempre tiene valor (es el selector de "qué fecha"),
 * así que marcaría "Fechas" de forma permanente.
 *
 * Los `haystack` son las etiquetas por las que busca el buscador de campos,
 * para que escribir "peso" o "AWB" lleve al grupo correcto.
 */
const GROUP_FIELDS: Record<string, Array<keyof LocalState>> = {
  basics: [
    "id",
    "AWB_forn",
    "RIF_cliente",
    "id_cliente",
    "id_fornitore",
    "note",
    "has_contrassegno",
  ],
  dates: ["date_from", "date_to"],
  location: ["country_iso", "city"],
  states: [
    "controllata",
    "consegna_firma",
    "presa_stato",
    "archiviata",
    "has_assicurazione",
  ],
  weight: ["peso_da", "peso_a", "peso_tassax", "id_servizio"],
  storage: ["stato_giac"],
};

/** Un campo cuenta como activo si tiene valor (o está marcado, si es booleano). */
function isFieldActive(key: keyof LocalState): boolean {
  const v = local.value[key];
  if (typeof v === "boolean") return v;
  return v !== "" && v !== null && v !== undefined;
}

const groups = computed<FilterGroup[]>(() =>
  Object.keys(GROUP_FIELDS).map((key) => ({
    key,
    label: t(`filters.shipment.tabs.${key}`),
    count: GROUP_FIELDS[key]!.filter(isFieldActive).length,
    haystack: GROUP_HAYSTACK[key] ? GROUP_HAYSTACK[key]!() : "",
  })),
);

/** Etiquetas buscables por grupo (se resuelven al vuelo para respetar idioma). */
const GROUP_HAYSTACK: Record<string, () => string> = {
  basics: () =>
    [
      t("filters.shipment.fields.shipment_id"),
      t("filters.shipment.fields.awb"),
      t("filters.fields.client_ref"),
      t("filters.fields.client_id"),
      t("filters.shipment.fields.courier"),
      t("filters.fields.notes"),
      t("filters.shipment.fields.has_cod"),
    ].join(" "),
  dates: () =>
    [
      t("filters.fields.date_field"),
      t("filters.fields.from"),
      t("filters.fields.to"),
    ].join(" "),
  location: () =>
    [
      t("filters.shipment.fields.dest_country_iso"),
      t("filters.shipment.fields.dest_city"),
    ].join(" "),
  states: () =>
    [
      t("filters.fields.controlled"),
      t("filters.fields.delivered"),
      t("filters.shipment.fields.pickup_status"),
      t("filters.fields.archived"),
      t("filters.fields.has_insurance"),
    ].join(" "),
  weight: () =>
    [
      t("filters.fields.weight_from"),
      t("filters.fields.weight_to"),
      t("filters.shipment.fields.chargeable_weight"),
      t("filters.shipment.fields.service_id"),
    ].join(" "),
  storage: () => t("filters.shipment.fields.storage_state"),
};

function snapshotLocal(): LocalState {
  return {
    date_field: state.value.date_field,
    date_from: state.value.date_from,
    date_to: state.value.date_to,
    country_iso: state.value.country_iso,
    location_type: state.value.location_type || "D",
    city: state.value.city,
    id: state.value.id,
    id_cliente: state.value.id_cliente,
    AWB_forn: state.value.AWB_forn,
    RIF_cliente: state.value.RIF_cliente,
    note: state.value.note,
    controllata: state.value.controllata,
    consegna_firma: state.value.consegna_firma,
    presa_stato: state.value.presa_stato,
    archiviata: state.value.archiviata,
    stato_giac: state.value.stato_giac,
    has_contrassegno: state.value.has_contrassegno === "S",
    has_assicurazione: state.value.has_assicurazione === "S",
    id_fornitore: state.value.id_fornitore,
    id_servizio: state.value.id_servizio,
    peso_da: state.value.peso_da,
    peso_a: state.value.peso_a,
    peso_tassax: state.value.peso_tassax,
  };
}

const local = ref<LocalState>(snapshotLocal());

// --- Client (id_cliente) remote autocomplete ---
const clientItems = ref<AnagraficaLite[]>([]);
const clientSearching = ref(false);
const selectedClient = ref<AnagraficaLite | null>(null);

/** Seed the autocomplete so a persisted id_cliente shows a label. */
function seedSelectedClient(): void {
  const id = local.value.id_cliente;
  if (!id) {
    selectedClient.value = null;
    return;
  }
  const current: AnagraficaLite = { id: Number(id), rag_soc: `#${id}` };
  if (!clientItems.value.some((it) => Number(it.id) === Number(id))) {
    clientItems.value = [current, ...clientItems.value];
  }
  selectedClient.value = current;
}
seedSelectedClient();

// Courier filter: the couriers actually present on shipments. Small list (~40),
// loaded once when the panel mounts; the autocomplete filters it client-side.
const fornitoreItems = ref<ShipmentFornitoreOption[]>([]);
const fornitoriLoading = ref(false);
onMounted(async () => {
  fornitoriLoading.value = true;
  try {
    fornitoreItems.value = await fornitoriService.listShipmentFornitori();
  } finally {
    fornitoriLoading.value = false;
  }
});

let clientSearchTimer: ReturnType<typeof setTimeout> | null = null;
function onClientSearch(text: string | undefined): void {
  if (clientSearchTimer) clearTimeout(clientSearchTimer);
  if (!text || text.trim().length < 2) return;
  clientSearchTimer = setTimeout(async () => {
    clientSearching.value = true;
    try {
      clientItems.value = await anagraficaService.search(text, 20);
    } finally {
      clientSearching.value = false;
    }
  }, 250);
}

function onClientPick(client: AnagraficaLite | null): void {
  selectedClient.value = client;
  local.value.id_cliente = client?.id ? String(client.id) : "";
}

const dateFieldOptions = computed(() => [
  { title: t("enums.shipment_date_field.created"), value: "data_sped0" },
  { title: t("enums.shipment_date_field.shipped"), value: "data_sped1" },
  { title: t("enums.shipment_date_field.carrier"), value: "data_corriere" },
  { title: t("enums.shipment_date_field.delivered"), value: "consegna_data" },
]);

const locationScopeOptions = computed(() => [
  { title: t("filters.value.origin"), value: "P" },
  { title: t("filters.value.destination"), value: "D" },
]);

const controllataOptions = computed(() => [
  { title: t("common.yes"), value: "S" },
  { title: t("common.no"), value: "N" },
  { title: t("enums.controllata.offer"), value: "O" },
]);

const consegnaFirmaOptions = computed(() => [
  { title: t("enums.delivered.yes"), value: "S" },
  { title: t("enums.delivered.no"), value: "N" },
]);

const presaStatoOptions = computed(() => [
  { title: t("enums.presa_stato.new"), value: "N" },
  { title: t("enums.presa_stato.in_progress"), value: "W" },
  { title: t("enums.presa_stato.finished"), value: "F" },
  { title: t("enums.presa_stato.cancelled"), value: "C" },
  { title: t("enums.presa_stato.transferred"), value: "T" },
]);

const archivedOptions = computed(() => [
  { title: t("enums.archived.yes"), value: "S" },
  { title: t("enums.archived.no"), value: "N" },
]);

const statoGiacOptions = computed(() => [
  { title: t("enums.stato_giac.has_any"), value: "S" },
  { title: t("enums.stato_giac.open"), value: "A" },
  { title: t("enums.stato_giac.closed_only"), value: "X" },
  { title: t("enums.stato_giac.none"), value: "N" },
]);

watch(
  () => props.modelValue,
  (v) => {
    open.value = v;
    if (v) {
      local.value = snapshotLocal();
      seedSelectedClient();
    }
  },
);
watch(open, (v) => emit("update:modelValue", v));

/**
 * Traduce la copia local del panel al shape del store. Lo usan tanto `onApply`
 * como el conteo previo, para garantizar que la cifra del botón corresponde
 * EXACTAMENTE al filtro que se aplicará.
 */
function localAsState(): Record<string, unknown> {
  return {
    date_field: local.value.date_field,
    date_from: local.value.date_from,
    date_to: local.value.date_to,
    country_iso: (local.value.country_iso || "").toUpperCase(),
    // El lado (P/D) ya NO se fuerza a 'D': el backend aplica country_iso y
    // city por separado desde que se corrigió el guard que los descartaba en
    // silencio. Forzar 'D' aquí volteaba sin avisar un filtro de origen puesto
    // desde la tabla. Sin lado, el backend busca en origen Y destino.
    location_type: local.value.location_type || "",
    city: local.value.city,
    id: local.value.id ? String(local.value.id) : "",
    id_cliente: local.value.id_cliente ? String(local.value.id_cliente) : "",
    AWB_forn: local.value.AWB_forn || "",
    RIF_cliente: local.value.RIF_cliente || "",
    note: local.value.note || "",
    controllata: local.value.controllata || "",
    consegna_firma: local.value.consegna_firma || "",
    presa_stato: local.value.presa_stato || "",
    archiviata: local.value.archiviata || "",
    stato_giac: local.value.stato_giac || "",
    has_contrassegno: local.value.has_contrassegno ? "S" : "",
    has_assicurazione: local.value.has_assicurazione ? "S" : "",
    id_fornitore: local.value.id_fornitore
      ? String(local.value.id_fornitore)
      : "",
    id_servizio: local.value.id_servizio ? String(local.value.id_servizio) : "",
    peso_da: local.value.peso_da || "",
    peso_a: local.value.peso_a || "",
    peso_tassax: local.value.peso_tassax || "",
  };
}

function onApply(): void {
  store.applyState({
    ...localAsState(),
    page: 1,
  } as Partial<ShipmentListUrlState>);
  void store.fetchPage();
  open.value = false;
}

function onClear(): void {
  store.applyState(shipmentResetFilters(state.value));
  local.value = snapshotLocal();
  seedSelectedClient();
  void store.fetchPage();
  open.value = false;
}

/* ─────────────────────────── conteo previo ───────────────────────────
 * El botón de aplicar muestra cuántos resultados devolvería el filtro que se
 * está componiendo, en vez de un "Aplicar" a ciegas. Evita el ciclo
 * aplicar–mirar–corregir y avisa antes de aplicar un filtro que deja la lista
 * en cero.
 *
 * Se pide con `per_page=1` (solo interesa `pagination.total`) y con debounce.
 * Cada petición cancela la anterior: al teclear en un campo se disparan varias
 * y sin cancelación llegarían desordenadas, mostrando un número que no
 * corresponde al filtro en pantalla.
 */
const previewCount = ref<number | null>(null);
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewController: AbortController | null = null;

/**
 * Los filtros de dirección (país/ciudad) tardan 15-27 s por el JOIN que
 * resuelve la dirección vigente con una subconsulta MAX() por fila. Pedir el
 * conteo mientras el operador teclea colgaría el panel, así que con ellos
 * puestos no se calcula y el botón vuelve a decir "Aplicar".
 */
function previewIsAffordable(): boolean {
  return !local.value.country_iso && !local.value.city;
}

/** Filtros del panel tal y como los enviaría `onApply`, sin paginación. */
function previewQuery(): Record<string, unknown> {
  return {
    ...buildShipmentListQuery({
      ...state.value,
      ...localAsState(),
      page: 1,
      per_page: 1,
    }),
    page: 1,
    per_page: 1,
  };
}

function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  if (previewController) previewController.abort();
  if (!open.value || !previewIsAffordable()) {
    previewCount.value = null;
    return;
  }
  previewTimer = setTimeout(async () => {
    const ctrl = new AbortController();
    previewController = ctrl;
    try {
      const r = await shipmentListService.fetch(previewQuery(), {
        signal: ctrl.signal,
      });
      if (!ctrl.signal.aborted)
        previewCount.value = r.pagination?.total ?? null;
    } catch {
      // Cancelada o fallida: se oculta la cifra en vez de mostrar una vieja.
      if (!ctrl.signal.aborted) previewCount.value = null;
    }
  }, 400);
}

watch(local, schedulePreview, { deep: true });
watch(open, (v) => {
  if (v) schedulePreview();
  else {
    if (previewTimer) clearTimeout(previewTimer);
    if (previewController) previewController.abort();
    previewCount.value = null;
  }
});
</script>
