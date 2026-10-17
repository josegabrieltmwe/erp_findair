<template>
  <div>
    <div class="d-flex align-center flex-wrap ga-2 mb-2">
      <div v-if="title" class="text-subtitle-1 font-weight-medium mr-2">
        {{ title }}
      </div>
      <v-spacer />
      <v-btn-toggle
        v-if="timeline"
        v-model="view"
        density="compact"
        variant="outlined"
        mandatory
        divided
      >
        <v-btn value="timeline" size="small" prepend-icon="mdi-chart-timeline">
          {{ t("invoicing.fiscal.view.timeline") }}
        </v-btn>
        <v-btn value="table" size="small" prepend-icon="mdi-table">
          {{ t("invoicing.fiscal.view.table") }}
        </v-btn>
      </v-btn-toggle>
      <v-btn
        variant="text"
        icon="mdi-refresh"
        size="small"
        :title="t('common.refresh')"
        :loading="loading"
        @click="load"
      />
      <v-btn
        v-if="store.isWritable(tabla)"
        color="primary"
        size="small"
        prepend-icon="mdi-plus"
        @click="formOpen = true"
      >
        {{ t("invoicing.fiscal.actions.new") }}
      </v-btn>
    </div>

    <!-- Filtros: «qué aplica el día X» y ámbito -->
    <div class="fisc-filters mb-3">
      <v-text-field
        v-model="filters.fecha"
        type="date"
        :label="t('invoicing.fiscal.filters.fecha')"
        :hint="t('invoicing.fiscal.filters.fecha_hint')"
        persistent-hint
        density="compact"
        clearable
        @update:model-value="load"
      />
      <v-select
        v-if="filterKeys.includes('voce')"
        v-model="filters.voce"
        :items="voceItems"
        :label="t('invoicing.fiscal.field.id_voce')"
        density="compact"
        hide-details
        clearable
        @update:model-value="load"
      />
      <v-text-field
        v-if="filterKeys.includes('iso_paese')"
        v-model="filters.iso_paese"
        :label="t('invoicing.fiscal.field.iso_paese')"
        maxlength="2"
        density="compact"
        hide-details
        clearable
        @update:model-value="onIso"
      />
      <v-text-field
        v-if="filterKeys.includes('partner') && store.esTmwe"
        v-model="filters.partner"
        type="number"
        :label="t('invoicing.fiscal.filters.partner')"
        :hint="t('invoicing.fiscal.filters.partner_hint')"
        persistent-hint
        density="compact"
        clearable
        @keyup.enter="load"
        @click:clear="load"
      />
      <v-select
        v-for="key in enumFilterKeys"
        :key="key"
        v-model="filters[key]"
        :items="store.enumOf(tabla, key)"
        :label="t(`invoicing.fiscal.field.${key}`)"
        density="compact"
        hide-details
        clearable
        @update:model-value="load"
      />
      <v-text-field
        v-model="search"
        :label="t('common.search')"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        hide-details
        clearable
      />
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      {{ error }}
    </v-alert>

    <RuleTimeline
      v-if="timeline && view === 'timeline'"
      :tabla="tabla"
      :rows="filteredRows"
      :today="store.hoy"
      :can-write="store.isWritable(tabla)"
      :versioned="versioned"
      @change="openChange"
      @end="(r: FiscRow) => openEnd(r, 'close')"
      @deactivate="(r: FiscRow) => openEnd(r, 'deactivate')"
    />

    <v-data-table
      v-else
      :headers="headers"
      :items="filteredRows"
      :loading="loading"
      :items-per-page="50"
      density="compact"
      class="fisc-table"
    >
      <template v-for="col in columns" :key="col" #[`item.${col}`]="{ item }">
        <span
          :class="{ 'fisc-mono': col === 'formato' && tabla !== 'canali' }"
          >{{ cell(col, item) }}</span
        >
      </template>
      <template #[`item.vigencia`]="{ item }">
        <span class="text-no-wrap">
          {{ item.data_inizio }} →
          {{ item.data_fine ?? t("invoicing.fiscal.open") }}
        </span>
      </template>
      <template #[`item.situacion`]="{ item }">
        <v-chip
          size="x-small"
          variant="flat"
          :color="situacionColor(item.situacion)"
        >
          {{ t(`invoicing.fiscal.situacion.${item.situacion}`) }}
        </v-chip>
      </template>
      <template #[`item.actions`]="{ item }">
        <div class="d-flex justify-end flex-nowrap">
          <slot name="row-actions" :row="item" />
          <template v-if="store.isWritable(tabla)">
            <v-btn
              v-if="versioned"
              icon="mdi-calendar-arrow-right"
              size="x-small"
              variant="text"
              color="primary"
              :title="t('invoicing.fiscal.actions.change')"
              @click="openChange(item)"
            />
            <v-btn
              icon="mdi-calendar-end"
              size="x-small"
              variant="text"
              :title="t('invoicing.fiscal.actions.close')"
              @click="openEnd(item, 'close')"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              color="error"
              :title="t('invoicing.fiscal.actions.deactivate')"
              @click="openEnd(item, 'deactivate')"
            />
          </template>
        </div>
      </template>
      <template #no-data>
        <div class="text-medium-emphasis py-6">
          {{ t("invoicing.fiscal.empty") }}
        </div>
      </template>
    </v-data-table>

    <RuleFormDialog
      v-model="formOpen"
      :tabla="tabla"
      :today="store.hoy"
      :initial="newInitial"
      @saved="onSaved"
    />
    <ChangeFromDateDialog
      v-model="changeOpen"
      :tabla="tabla"
      :row="selected"
      @saved="onSaved"
    />
    <EndRowDialog
      v-model="endOpen"
      :tabla="tabla"
      :row="selected"
      :mode="endMode"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isAbortLikeError, toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscConfigService,
  type FiscRow,
  type FiscTabla,
  type Situacion,
} from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import { useToastStore } from "../../stores/toast.store";
import ChangeFromDateDialog from "./ChangeFromDateDialog.vue";
import EndRowDialog from "./EndRowDialog.vue";
import RuleFormDialog from "./RuleFormDialog.vue";
import RuleTimeline from "./RuleTimeline.vue";
import { summarizeCondition } from "./conditionModel";
import { NOT_VERSIONED, TABLE_COLUMNS, cellText } from "./fiscFields";

const props = withDefaults(
  defineProps<{
    tabla: FiscTabla;
    title?: string;
    /** Ofrece la vista de línea de tiempo (tablas versionadas). */
    timeline?: boolean;
    /** Filtros visibles: voce, iso_paese, partner y enumerados de la tabla. */
    filterKeys?: string[];
  }>(),
  {
    title: "",
    timeline: false,
    filterKeys: () => ["iso_paese", "partner"],
  },
);

const emit = defineEmits<{ (e: "changed"): void }>();

const { t, locale } = useI18n();
const store = useFiscConfigStore();
const toasts = useToastStore();

const rows = ref<FiscRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref("");
const view = ref<"timeline" | "table">(props.timeline ? "timeline" : "table");
const filters = reactive<Record<string, string | null>>({
  fecha: null,
  voce: null,
  iso_paese: null,
  partner: null,
});

const versioned = computed(() => !NOT_VERSIONED.includes(props.tabla));
const columns = computed(() => TABLE_COLUMNS[props.tabla]);
const enumFilterKeys = computed(() =>
  props.filterKeys.filter((k) => !["voce", "iso_paese", "partner"].includes(k)),
);

const headers = computed(() => [
  ...columns.value.map((key) => ({
    title: t(`invoicing.fiscal.field.${key}`),
    key,
    sortable: true,
  })),
  { title: t("invoicing.fiscal.vigencia"), key: "vigencia", sortable: false },
  {
    title: t("invoicing.fiscal.situacion_col"),
    key: "situacion",
    sortable: true,
  },
  {
    title: t("common.actions"),
    key: "actions",
    sortable: false,
    align: "end" as const,
  },
]);

const voceItems = computed(() =>
  (store.meta?.voci ?? []).map((v) => ({ value: v.codice, title: v.codice })),
);

const filteredRows = computed(() => {
  const q = (search.value ?? "").trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((r) =>
    Object.values(r).some(
      (v) =>
        v !== null && v !== undefined && String(v).toLowerCase().includes(q),
    ),
  );
});

/** Valores del filtro como valores iniciales del alta. */
const newInitial = computed(() => {
  const init: Record<string, string | number | null> = {};
  if (filters.iso_paese) init.iso_paese = filters.iso_paese;
  if (filters.partner) init.id_partner = Number(filters.partner);
  if (filters.voce) {
    const v = store.meta?.voci.find((x) => x.codice === filters.voce);
    if (v) init.id_voce = v.id;
  }
  return init;
});

let ctrl: AbortController | null = null;

async function load(): Promise<void> {
  ctrl?.abort();
  ctrl = new AbortController();
  const signal = ctrl.signal;
  loading.value = true;
  error.value = null;
  try {
    const params: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== null && v !== "") params[k] = String(v);
    }
    rows.value = await fiscConfigService.list(props.tabla, params, signal);
  } catch (e) {
    if (isAbortLikeError(e, signal)) return;
    error.value = toUserMessage(e, String(e));
  } finally {
    if (!signal.aborted) loading.value = false;
  }
}

function onIso(v: string | null): void {
  filters.iso_paese = v ? v.toUpperCase() : null;
  if (!v || v.length === 2) void load();
}

// ── Acciones ─────────────────────────────────────────────────────────
const formOpen = ref(false);
const changeOpen = ref(false);
const endOpen = ref(false);
const endMode = ref<"close" | "deactivate">("close");
const selected = ref<FiscRow | null>(null);

function openChange(row: FiscRow): void {
  selected.value = row;
  changeOpen.value = true;
}

function openEnd(row: FiscRow, mode: "close" | "deactivate"): void {
  selected.value = row;
  endMode.value = mode;
  endOpen.value = true;
}

function onSaved(): void {
  toasts.push("success", t("invoicing.fiscal.toast.saved"));
  void load();
  emit("changed");
}

// ── Presentación ─────────────────────────────────────────────────────
function cell(col: string, item: FiscRow): string {
  const json = String(item.condicion_json ?? "");
  if (col === "condicion_resumen") {
    // Con JSON, la frase del constructor; con atajo, su explicación.
    return summarizeCondition(
      json || String(item.condicion ?? ""),
      store.catalogo,
      {
        t,
        lang: String(locale.value),
      },
    );
  }
  if (col === "condicion" && json) return t("invoicing.fiscal.cond.json_badge");
  return cellText(col, item[col], t("invoicing.fiscal.all"));
}

function situacionColor(s: Situacion): string {
  return s === "VIGENTE" ? "success" : s === "FUTURA" ? "info" : "grey";
}

defineExpose({ load });

onMounted(() => {
  void load();
  // El catálogo da las etiquetas del resumen de condiciones (tablas con condición JSON).
  if (["valori", "requisiti"].includes(props.tabla)) void store.loadCatalogo();
});
</script>

<style scoped>
.fisc-filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 8px;
  align-items: start;
}

.fisc-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
}
</style>
