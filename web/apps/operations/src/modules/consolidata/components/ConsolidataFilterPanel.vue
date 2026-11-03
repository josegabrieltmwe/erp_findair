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
    <!-- BÁSICOS: búsqueda, estado, cliente, partner, asignado, tipo -->
    <template #basics>
      <v-text-field
        v-model="local.q"
        :label="t('consolidata.filters.q')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-select
        v-model="local.statoList"
        :items="stateItems"
        :label="t('consolidata.filters.stato')"
        multiple
        chips
        closable-chips
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <ConsolidataClientPicker
        v-model="local.id_cliente"
        :label="t('filters.group.client')"
        :initial-label="clientHint"
        hide-details
      />
      <ConsolidataClientPicker
        v-model="local.id_partner"
        :label="t('consolidata.filters.partner')"
        hide-details
      />
      <v-select
        v-model="local.assegnatoMode"
        :items="assigneeModes"
        :label="t('consolidata.filters.assegnato')"
        density="comfortable"
        hide-details
        variant="outlined"
      />
      <ConsolidataUserPicker
        v-if="local.assegnatoMode === 'user'"
        v-model="local.assegnatoUser"
        :label="t('consolidata.filters.assegnatoUser')"
      />
      <v-select
        v-model="local.tipo"
        :items="typeItems"
        :label="t('consolidata.filters.tipo')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- RUTA: hub, origen, destino -->
    <template #ruta>
      <v-text-field
        v-model="local.hub_terminal"
        :label="t('consolidata.filters.hub')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
        maxlength="5"
      />
      <CmCountrySelect
        :model-value="local.orig_paese || null"
        :label="t('consolidata.filters.origPaese')"
        clearable
        @update:model-value="local.orig_paese = $event || ''"
      />
      <CmCountrySelect
        :model-value="local.dest_country || null"
        :label="t('consolidata.filters.destCountry')"
        clearable
        @update:model-value="local.dest_country = $event || ''"
      />
    </template>

    <!-- CICLO: fechas, respuesta, conversión, cargo -->
    <template #ciclo>
      <v-select
        v-model="local.quale_data"
        :items="dateFieldItems"
        :label="t('consolidata.filters.qualeData')"
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
      <v-select
        v-model="local.risposta"
        :items="answerItems"
        :label="t('consolidata.filters.risposta')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-select
        v-model="local.conversione"
        :items="conversionItems"
        :label="t('consolidata.filters.conversione')"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.id_cargo"
        :label="t('consolidata.filters.idCargo')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>

    <!-- CIFRAS: importe, nº de expediciones -->
    <template #cifras>
      <v-text-field
        v-model="local.totale_min"
        :label="t('consolidata.filters.totaleMin')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.totale_max"
        :label="t('consolidata.filters.totaleMax')"
        type="number"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.n_sped_min"
        :label="t('consolidata.filters.nSpedMin')"
        type="number"
        min="0"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
      <v-text-field
        v-model="local.n_sped_max"
        :label="t('consolidata.filters.nSpedMax')"
        type="number"
        min="0"
        density="comfortable"
        hide-details
        clearable
        variant="outlined"
      />
    </template>
  </FilterDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import CmCountrySelect from "@shared/anagrafiche/components/CmCountrySelect.vue";
import FilterDrawer, {
  type FilterGroup,
} from "@shared/listing/FilterDrawer.vue";
import ConsolidataClientPicker from "./ConsolidataClientPicker.vue";
import ConsolidataUserPicker from "./ConsolidataUserPicker.vue";
import {
  buildConsolidataListQuery,
  consolidataResetFilters,
  useConsolidataListStore,
  type ConsolidataListUrlState,
  type QualeData,
} from "../stores/consolidata_list.store";
import { consolidataService } from "../services/consolidata.service";
import { stateI18nKey } from "../logic";
import { PROJECT_STATES, PROJECT_TYPES } from "../types";

const props = defineProps<{
  modelValue: boolean;
  clientHint?: string | null;
}>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();
const { t } = useI18n();
const store = useConsolidataListStore();
const { state, loading } = storeToRefs(store);

interface LocalState {
  q: string;
  statoList: string[];
  id_cliente: number | null;
  id_partner: number | null;
  assegnatoMode: "" | "me" | "none" | "user";
  assegnatoUser: number | null;
  tipo: string;
  hub_terminal: string;
  orig_paese: string;
  dest_country: string;
  quale_data: QualeData;
  date_from: string;
  date_to: string;
  risposta: string;
  conversione: string;
  id_cargo: string;
  totale_min: string;
  totale_max: string;
  n_sped_min: string;
  n_sped_max: string;
}

function snapshotLocal(): LocalState {
  const s = state.value;
  const a = s.assegnato_a;
  return {
    q: s.q,
    statoList: s.stato ? s.stato.split(",") : [],
    id_cliente: s.id_cliente ? Number(s.id_cliente) : null,
    id_partner: s.id_partner ? Number(s.id_partner) : null,
    assegnatoMode: a === "me" || a === "none" ? a : a ? "user" : "",
    assegnatoUser: a && a !== "me" && a !== "none" ? Number(a) : null,
    tipo: s.tipo,
    hub_terminal: s.hub_terminal,
    orig_paese: s.orig_paese,
    dest_country: s.dest_country,
    quale_data: s.quale_data,
    date_from: s.date_from,
    date_to: s.date_to,
    risposta: s.risposta,
    conversione: s.conversione,
    id_cargo: s.id_cargo,
    totale_min: s.totale_min,
    totale_max: s.totale_max,
    n_sped_min: s.n_sped_min,
    n_sped_max: s.n_sped_max,
  };
}

const open = ref(props.modelValue);
const local = ref<LocalState>(snapshotLocal());

/** Copia local → forma del store (la usan aplicar y el recuento previo). */
function localAsState(): Partial<ConsolidataListUrlState> {
  const l = local.value;
  const assegnato =
    l.assegnatoMode === "user"
      ? l.assegnatoUser
        ? String(l.assegnatoUser)
        : ""
      : l.assegnatoMode;
  const stato = l.statoList.join(",");
  return {
    q: (l.q || "").trim(),
    stato,
    // Elegir estados a mano sustituye al mosaico de fase.
    fase: stato ? "" : state.value.fase,
    id_cliente: l.id_cliente ? String(l.id_cliente) : "",
    id_partner: l.id_partner ? String(l.id_partner) : "",
    assegnato_a: assegnato,
    tipo: l.tipo || "",
    hub_terminal: (l.hub_terminal || "").trim().toUpperCase(),
    orig_paese: (l.orig_paese || "").toUpperCase(),
    dest_country: (l.dest_country || "").toUpperCase(),
    quale_data: l.quale_data,
    date_from: l.date_from || "",
    date_to: l.date_to || "",
    risposta: l.risposta || "",
    conversione: l.conversione || "",
    id_cargo: l.id_cargo ? String(l.id_cargo) : "",
    totale_min: l.totale_min ? String(l.totale_min) : "",
    totale_max: l.totale_max ? String(l.totale_max) : "",
    n_sped_min:
      l.n_sped_min !== "" && l.n_sped_min !== null
        ? String(l.n_sped_min ?? "")
        : "",
    n_sped_max:
      l.n_sped_max !== "" && l.n_sped_max !== null
        ? String(l.n_sped_max ?? "")
        : "",
  };
}

const GROUP_FIELDS: Record<string, Array<keyof LocalState>> = {
  basics: [
    "q",
    "statoList",
    "id_cliente",
    "id_partner",
    "assegnatoMode",
    "tipo",
  ],
  ruta: ["hub_terminal", "orig_paese", "dest_country"],
  ciclo: ["date_from", "date_to", "risposta", "conversione", "id_cargo"],
  cifras: ["totale_min", "totale_max", "n_sped_min", "n_sped_max"],
};

function isActive(key: keyof LocalState): boolean {
  const v = local.value[key];
  if (Array.isArray(v)) return v.length > 0;
  return v !== "" && v !== null && v !== undefined;
}

const GROUP_HAYSTACK: Record<string, () => string> = {
  basics: () =>
    [
      t("consolidata.filters.q"),
      t("consolidata.filters.stato"),
      t("filters.group.client"),
      t("consolidata.filters.partner"),
      t("consolidata.filters.assegnato"),
      t("consolidata.filters.tipo"),
    ].join(" "),
  ruta: () =>
    [
      t("consolidata.filters.hub"),
      t("consolidata.filters.origPaese"),
      t("consolidata.filters.destCountry"),
    ].join(" "),
  ciclo: () =>
    [
      t("consolidata.filters.qualeData"),
      t("filters.fields.from"),
      t("filters.fields.to"),
      t("consolidata.filters.risposta"),
      t("consolidata.filters.conversione"),
      t("consolidata.filters.idCargo"),
    ].join(" "),
  cifras: () =>
    [
      t("consolidata.filters.totaleMin"),
      t("consolidata.filters.totaleMax"),
      t("consolidata.filters.nSpedMin"),
      t("consolidata.filters.nSpedMax"),
    ].join(" "),
};

const groups = computed<FilterGroup[]>(() =>
  Object.keys(GROUP_FIELDS).map((key) => ({
    key,
    label: t(`consolidata.filters.tabs.${key}`),
    count: GROUP_FIELDS[key]!.filter(isActive).length,
    haystack: GROUP_HAYSTACK[key]!(),
  })),
);

const stateItems = computed(() =>
  PROJECT_STATES.map((s) => ({ title: t(stateI18nKey(s)), value: s })),
);
const typeItems = computed(() =>
  PROJECT_TYPES.map((v) => ({ title: t(`consolidata.type.${v}`), value: v })),
);
const assigneeModes = computed(() => [
  { title: t("consolidata.filters.assigneeAll"), value: "" },
  { title: t("consolidata.filters.assigneeMe"), value: "me" },
  { title: t("consolidata.filters.assigneeNone"), value: "none" },
  { title: t("consolidata.filters.assigneeUser"), value: "user" },
]);
const dateFieldItems = computed(() =>
  (["insert", "modif", "chiuso", "risposta"] as const).map((v) => ({
    title: t(`consolidata.filters.dateField.${v}`),
    value: v,
  })),
);
const answerItems = computed(() =>
  (["no", "vigente", "vencida"] as const).map((v) => ({
    title: t(`consolidata.filters.answer.${v}`),
    value: v,
  })),
);
const conversionItems = computed(() =>
  (["no", "parcial", "completo"] as const).map((v) => ({
    title: t(`consolidata.conversion.status.${v}`),
    value: v,
  })),
);

watch(
  () => props.modelValue,
  (v) => {
    open.value = v;
    if (v) local.value = snapshotLocal();
  },
);
watch(open, (v) => emit("update:modelValue", v));

function onApply(): void {
  store.applyState({ ...localAsState(), page: 1 });
  void store.fetchPage();
  void store.fetchCounts();
  open.value = false;
}

function onClear(): void {
  store.applyState(consolidataResetFilters(state.value));
  local.value = snapshotLocal();
  void store.fetchPage();
  void store.fetchCounts();
  open.value = false;
}

/* Recuento previo con per_page=1, con debounce y cancelación (como en cargo). */
const previewCount = ref<number | null>(null);
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewController: AbortController | null = null;

function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  previewController?.abort();
  if (!open.value) {
    previewCount.value = null;
    return;
  }
  previewTimer = setTimeout(async () => {
    const ctrl = new AbortController();
    previewController = ctrl;
    try {
      const q = buildConsolidataListQuery({
        ...state.value,
        ...localAsState(),
        page: 1,
        per_page: 1,
      });
      const r = await consolidataService.queue(q, { signal: ctrl.signal });
      if (!ctrl.signal.aborted) previewCount.value = Number(r.count) || 0;
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
    previewController?.abort();
    previewCount.value = null;
  }
});
</script>
