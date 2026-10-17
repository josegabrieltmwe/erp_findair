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
    <!-- BASICS -->
    <template #basics>
      <v-text-field
        v-model="local.id"
        :label="t('filters.cargo.fields.cargo_id')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.AWB_forn"
        :label="t('filters.cargo.fields.mawb')"
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
        v-model="clienteSelection"
        :items="clienteItems"
        :loading="clienteLoading"
        item-title="rag_soc"
        item-value="id"
        return-object
        :label="t('filters.fields.client_id')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
        hide-no-data
        prepend-inner-icon="mdi-account-search"
        @update:search="onClienteSearch"
        @update:model-value="onClientePick"
      />
      <v-text-field
        v-model="local.note"
        :label="t('filters.fields.notes')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
        :placeholder="t('filters.cargo.fields.notes_ph')"
      />
      <v-select
        v-model="local.quale_data"
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

    <!-- ROUTE -->
    <template #route>
      <v-select
        v-model="local.cerca_pd"
        :items="locationScopeOptions"
        :label="t('filters.fields.location_scope')"
        density="comfortable"
        hide-details
        variant="outlined"
      />
      <CmCountrySelect
        :model-value="local.paesex || null"
        :label="t('filters.fields.country')"
        clearable
        @update:model-value="local.paesex = $event || ''"
      />
      <v-text-field
        v-model="local.terminal_part"
        :label="t('filters.cargo.fields.origin_terminal')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
        placeholder="MXP"
      />
      <v-text-field
        v-model="local.terminal_dest"
        :label="t('filters.cargo.fields.dest_terminal')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
        placeholder="MIA"
      />
      <v-text-field
        v-model="local.airline_code"
        :label="t('filters.cargo.fields.airline_code')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
        placeholder="LH, KL, EK..."
        :maxlength="3"
      />
      <v-text-field
        v-model="local.flight_num1"
        :label="t('filters.cargo.fields.flight_num')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- LIFECYCLE — gestione + offerta -->
    <template #lifecycle>
      <v-select
        v-model="local.gestione"
        :items="gestioneOptions"
        :label="t('filters.cargo.fields.management_state')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-select
        v-model="local.offerta"
        :items="offertaOptions"
        :label="t('filters.cargo.fields.offer_state')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
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
        v-model="local.archiviata"
        :items="archivedOptions"
        :label="t('filters.fields.archived')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- CARGO type -->
    <template #cargo>
      <v-select
        v-model="local.tipo_merce"
        :items="tipoMerceOptions"
        :label="t('filters.cargo.fields.cargo_type')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-select
        v-model="local.vettore_tipo"
        :items="vettoreTipoOptions"
        :label="t('filters.cargo.fields.carrier_type')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.cargo_dazi"
        :label="t('filters.cargo.fields.duty_indicator')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- WEIGHT -->
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
        v-model="local.pesor"
        :label="t('filters.cargo.fields.chargeable_weight')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- ACCESSORIES — checkboxes (cargo-specific; no COD on air cargo) -->
    <template #accessories>
      <v-checkbox
        v-model="local.has_assicurazione"
        :label="t('filters.fields.has_insurance')"
        density="comfortable"
        hide-details
      />
      <v-checkbox
        v-model="local.acc_dryice"
        :label="t('filters.cargo.fields.dry_ice')"
        density="comfortable"
        hide-details
      />
      <v-checkbox
        v-model="local.acc_danggoods"
        :label="t('filters.cargo.fields.dangerous_goods')"
        density="comfortable"
        hide-details
      />
      <v-checkbox
        v-model="local.acc_bancale"
        :label="t('filters.cargo.fields.palletised')"
        density="comfortable"
        hide-details
      />
    </template>
  </FilterDrawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import CmCountrySelect from "@shared/anagrafiche/components/CmCountrySelect.vue";
import {
  useCargoListStore,
  buildCargoListQuery,
  cargoResetFilters,
} from "@cargo/stores/cargo_list.store";
import {
  anagraficaService,
  type AnagraficaLite,
} from "@cargo/services/anagrafica.service";
import FilterDrawer, {
  type FilterGroup,
} from "@shared/listing/FilterDrawer.vue";
import { cargoListService } from "@cargo/services/cargo.service";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
}>();

const store = useCargoListStore();
const { state, loading } = storeToRefs(store);

interface LocalState {
  date_from: string;
  date_to: string;
  quale_data: "data_sped1" | "data_volo_partenza";
  id: string;
  id_cliente: string;
  AWB_forn: string;
  RIF_cliente: string;
  note: string;
  terminal_part: string;
  terminal_dest: string;
  paesex: string;
  cerca_pd: string;
  airline_code: string;
  flight_num1: string;
  gestione: string;
  offerta: string;
  tipo_merce: string;
  vettore_tipo: string;
  cargo_dazi: string;
  controllata: string;
  archiviata: string;
  consegna_firma: string;
  peso_da: string;
  peso_a: string;
  pesor: string;
  has_assicurazione: boolean;
  acc_dryice: boolean;
  acc_danggoods: boolean;
  acc_bancale: boolean;
}

function snapshotLocal(): LocalState {
  return {
    date_from: state.value.date_from,
    date_to: state.value.date_to,
    quale_data: state.value.quale_data,
    id: state.value.id,
    id_cliente: state.value.id_cliente,
    AWB_forn: state.value.AWB_forn,
    RIF_cliente: state.value.RIF_cliente,
    note: state.value.note,
    terminal_part: state.value.terminal_part,
    terminal_dest: state.value.terminal_dest,
    paesex: state.value.paesex,
    cerca_pd: state.value.cerca_pd || "D",
    airline_code: state.value.airline_code,
    flight_num1: state.value.flight_num1,
    gestione: state.value.gestione,
    offerta: state.value.offerta,
    tipo_merce: state.value.tipo_merce,
    vettore_tipo: state.value.vettore_tipo,
    cargo_dazi: state.value.cargo_dazi,
    controllata: state.value.controllata,
    archiviata: state.value.archiviata,
    consegna_firma: state.value.consegna_firma,
    peso_da: state.value.peso_da,
    peso_a: state.value.peso_a,
    pesor: state.value.pesor,
    has_assicurazione: state.value.has_assicurazione === "S",
    acc_dryice: state.value.acc_dryice === "S",
    acc_danggoods: state.value.acc_danggoods === "S",
    acc_bancale: state.value.acc_bancale === "S",
  };
}

/**
 * Campos de cada grupo del panel: alimentan el contador que muestra cada
 * sección y deciden cuáles arrancan abiertas.
 *
 * `quale_data` NO cuenta: siempre tiene valor (selector de "qué fecha"), así
 * que marcaría "Básicos" de forma permanente.
 */
const GROUP_FIELDS: Record<string, Array<keyof LocalState>> = {
  basics: [
    "id",
    "AWB_forn",
    "RIF_cliente",
    "id_cliente",
    "note",
    "date_from",
    "date_to",
  ],
  route: ["paesex", "terminal_part", "terminal_dest", "airline_code", "flight_num1"],
  lifecycle: [
    "gestione",
    "offerta",
    "controllata",
    "archiviata",
    "consegna_firma",
  ],
  cargo: ["tipo_merce", "vettore_tipo", "cargo_dazi"],
  weight: ["peso_da", "peso_a", "pesor"],
  accessories: [
    "has_assicurazione",
    "acc_dryice",
    "acc_danggoods",
    "acc_bancale",
  ],
};

/** Un campo cuenta como activo si tiene valor (o está marcado, si es booleano). */
function isFieldActive(key: keyof LocalState): boolean {
  const v = local.value[key];
  if (typeof v === "boolean") return v;
  return v !== "" && v !== null && v !== undefined;
}

/** Etiquetas buscables por grupo (al vuelo, para respetar el idioma activo). */
const GROUP_HAYSTACK: Record<string, () => string> = {
  basics: () =>
    [
      t("filters.cargo.fields.cargo_id"),
      t("filters.cargo.fields.mawb"),
      t("filters.fields.client_ref"),
      t("filters.fields.client_id"),
      t("filters.fields.notes"),
      t("filters.fields.date_field"),
      t("filters.fields.from"),
      t("filters.fields.to"),
    ].join(" "),
  route: () =>
    [
      t("filters.cargo.fields.origin_terminal"),
      t("filters.cargo.fields.dest_terminal"),
      t("filters.cargo.fields.airline_code"),
      t("filters.cargo.fields.flight_num"),
    ].join(" "),
  lifecycle: () =>
    [
      t("filters.cargo.fields.management_state"),
      t("filters.cargo.fields.offer_state"),
      t("filters.fields.controlled"),
      t("filters.fields.delivered"),
      t("filters.fields.archived"),
    ].join(" "),
  cargo: () =>
    [
      t("filters.cargo.fields.cargo_type"),
      t("filters.cargo.fields.carrier_type"),
      t("filters.cargo.fields.duty_indicator"),
    ].join(" "),
  weight: () =>
    [
      t("filters.fields.weight_from"),
      t("filters.fields.weight_to"),
      t("filters.cargo.fields.chargeable_weight"),
    ].join(" "),
  accessories: () => t("filters.fields.has_insurance"),
};

const groups = computed<FilterGroup[]>(() =>
  Object.keys(GROUP_FIELDS).map((key) => ({
    key,
    label: t(`filters.cargo.tabs.${key}`),
    count: GROUP_FIELDS[key]!.filter(isFieldActive).length,
    haystack: GROUP_HAYSTACK[key] ? GROUP_HAYSTACK[key]!() : "",
  })),
);
const open = ref(props.modelValue);
const local = ref<LocalState>(snapshotLocal());

// --- Cliente autocomplete (remote anagrafica search) ---
// Search-only filter: the selected anagrafica id feeds `local.id_cliente`.
// A persisted id not (yet) in the fetched catalog is preserved and resolved
// to a label on open so the chip stays populated.
const clienteItems = ref<AnagraficaLite[]>([]);
const clienteSelection = ref<AnagraficaLite | null>(null);
const clienteLoading = ref(false);
let clienteTimer: ReturnType<typeof setTimeout> | null = null;

function onClienteSearch(q: string): void {
  if (clienteTimer) clearTimeout(clienteTimer);
  clienteTimer = setTimeout(async () => {
    const trimmed = (q ?? "").trim();
    if (trimmed.length < 2) {
      clienteItems.value = [];
      return;
    }
    clienteLoading.value = true;
    try {
      clienteItems.value = await anagraficaService.search(trimmed, 25);
    } finally {
      clienteLoading.value = false;
    }
  }, 250);
}

function onClientePick(sel: AnagraficaLite | null): void {
  local.value.id_cliente = sel ? String(sel.id) : "";
}

/** Resolve a persisted id_cliente to a labelled selection when the panel opens. */
async function syncClienteSelection(): Promise<void> {
  const id = Number(local.value.id_cliente);
  if (!id || id <= 0) {
    clienteSelection.value = null;
    return;
  }
  // Keep the raw id visible even if resolution fails.
  clienteSelection.value = { id, rag_soc: String(id) };
  clienteItems.value = [clienteSelection.value];
  const row = await anagraficaService.getById(id);
  if (row && Number(local.value.id_cliente) === id) {
    clienteSelection.value = row;
    clienteItems.value = [row];
  }
}
void syncClienteSelection();

const dateFieldOptions = computed(() => [
  { title: t("enums.cargo_date_field.shipped"), value: "data_sped1" },
  {
    title: t("enums.cargo_date_field.flight_departure"),
    value: "data_volo_partenza",
  },
]);

const locationScopeOptions = computed(() => [
  { title: t("filters.value.origin"), value: "P" },
  { title: t("filters.value.destination"), value: "D" },
]);

const gestioneOptions = computed(() => [
  { title: t("enums.gestione.to_quote"), value: "N" },
  { title: t("enums.gestione.quoting"), value: "F" },
  { title: t("enums.gestione.sent"), value: "O" },
]);

const offertaOptions = computed(() => [
  { title: t("enums.offerta.accepted"), value: "A" },
  { title: t("enums.offerta.rejected"), value: "R" },
]);

// Cargo `controllata` is binary (S/N) — there is no 'O' value as in
// express (the offerta workflow lives on its own `offerta` column).
const controllataOptions = computed(() => [
  { title: t("common.yes"), value: "S" },
  { title: t("common.no"), value: "N" },
]);

const consegnaFirmaOptions = computed(() => [
  { title: t("enums.delivered.yes"), value: "S" },
  { title: t("enums.delivered.no"), value: "N" },
]);

const archivedOptions = computed(() => [
  { title: t("enums.archived.yes"), value: "S" },
  { title: t("enums.archived.no"), value: "N" },
]);

// Legacy `$cargoct` enum — first values from spedyc_form. Conservative
// list; can be extended as needed.
const tipoMerceOptions = computed(() => [
  { title: t("enums.cargo_type.documents"), value: "DOC" },
  { title: t("enums.cargo_type.non_doc"), value: "NDC" },
  { title: t("enums.cargo_type.special"), value: "SPL" },
]);

// Legacy `$cargovtERPsrc` enum.
const vettoreTipoOptions = computed(() => [
  { title: t("enums.carrier_type.international"), value: "intl" },
  { title: t("enums.carrier_type.domestic"), value: "dom" },
  { title: t("enums.carrier_type.express"), value: "express" },
]);

watch(
  () => props.modelValue,
  (v) => {
    open.value = v;
    if (v) {
      local.value = snapshotLocal();
      void syncClienteSelection();
    }
  },
);
watch(open, (v) => emit("update:modelValue", v));

/**
 * Traduce la copia local del panel al shape del store. La usan `onApply` y el
 * conteo previo, para que la cifra del botón corresponda EXACTAMENTE al filtro
 * que se va a aplicar.
 */
function localAsState(): Record<string, unknown> {
  return {
    date_from: local.value.date_from,
    date_to: local.value.date_to,
    quale_data: local.value.quale_data,
    id: local.value.id || "",
    id_cliente: local.value.id_cliente || "",
    AWB_forn: local.value.AWB_forn || "",
    RIF_cliente: local.value.RIF_cliente || "",
    note: local.value.note || "",
    terminal_part: local.value.terminal_part || "",
    terminal_dest: local.value.terminal_dest || "",
    paesex: (local.value.paesex || "").toUpperCase(),
    cerca_pd: local.value.paesex ? local.value.cerca_pd : "",
    airline_code: (local.value.airline_code || "").toUpperCase(),
    flight_num1: local.value.flight_num1 || "",
    gestione: local.value.gestione || "",
    offerta: local.value.offerta || "",
    tipo_merce: local.value.tipo_merce || "",
    vettore_tipo: local.value.vettore_tipo || "",
    cargo_dazi: local.value.cargo_dazi || "",
    controllata: local.value.controllata || "",
    archiviata: local.value.archiviata || "",
    consegna_firma: local.value.consegna_firma || "",
    peso_da: local.value.peso_da || "",
    peso_a: local.value.peso_a || "",
    pesor: local.value.pesor || "",
    has_assicurazione: local.value.has_assicurazione ? "S" : "",
    acc_dryice: local.value.acc_dryice ? "S" : "",
    acc_danggoods: local.value.acc_danggoods ? "S" : "",
    acc_bancale: local.value.acc_bancale ? "S" : "",
  };
}

function onApply(): void {
  store.applyState({ ...localAsState(), page: 1 } as Parameters<
    typeof store.applyState
  >[0]);
  void store.fetchPage();
  open.value = false;
}

function onClear(): void {
  store.applyState(cargoResetFilters(state.value));
  local.value = snapshotLocal();
  void syncClienteSelection();
  void store.fetchPage();
  open.value = false;
}

/* ─────────────────────────── conteo previo ───────────────────────────
 * El botón muestra cuántos resultados devolvería el filtro que se está
 * componiendo, en vez de un "Aplicar" a ciegas. A diferencia del listado
 * courier, aquí NO hace falta excluir ningún filtro: todos los de cargo
 * responden por debajo de 1,5 s.
 *
 * Debounce + cancelación de la petición anterior: al teclear se disparan
 * varias y sin cancelar llegarían desordenadas, mostrando una cifra que no
 * corresponde al filtro en pantalla.
 */
const previewCount = ref<number | null>(null);
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewController: AbortController | null = null;

function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  if (previewController) previewController.abort();
  if (!open.value) {
    previewCount.value = null;
    return;
  }
  previewTimer = setTimeout(async () => {
    const ctrl = new AbortController();
    previewController = ctrl;
    try {
      const q = {
        ...buildCargoListQuery({
          ...state.value,
          ...localAsState(),
          page: 1,
          per_page: 1,
        }),
        page: 1,
        per_page: 1,
      };
      const r = await cargoListService.fetch(q, { signal: ctrl.signal });
      if (!ctrl.signal.aborted)
        previewCount.value = r.pagination?.total ?? null;
    } catch {
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
