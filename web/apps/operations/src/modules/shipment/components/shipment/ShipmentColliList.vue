<template>
  <!-- embedded: the host ModalWrapper already provides the dialog card + title. -->
  <component
    :is="embedded ? 'div' : VCard"
    v-bind="embedded ? {} : { border: true, rounded: 'lg' }"
  >
    <v-card-title v-if="!embedded" class="d-flex align-center">
      <v-icon icon="mdi-format-list-numbered" class="me-2" />
      {{ t("shipment.modals.colli.per_package") }}
      <v-badge :content="rows.length" color="primary" inline class="ms-2" />
      <v-spacer />
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-plus"
        :disabled="isPackagesLocked"
        @click="addRow"
      >
        {{ t("shipment.modals.colli.add_row") }}
      </v-btn>
    </v-card-title>
    <div v-else class="d-flex align-center mb-2">
      <v-badge :content="rows.length" color="primary" inline />
      <v-spacer />
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-plus"
        :disabled="isPackagesLocked"
        @click="addRow"
      >
        {{ t("shipment.modals.colli.add_row") }}
      </v-btn>
    </div>

    <v-data-table
      :headers="headers"
      :items="rows"
      :items-per-page="-1"
      hide-default-footer
      density="comfortable"
      class="colli-table"
    >
      <template #item.segnac_cliente="{ index }">
        <v-text-field
          v-model="rows[index]!.segnac_cliente"
          hide-details
          density="compact"
          variant="plain"
          :readonly="isPackagesLocked"
        />
      </template>
      <template #item.peso="{ index }">
        <v-text-field
          :model-value="dispWeight(rows[index]!.peso)"
          type="number"
          min="0"
          step="0.1"
          hide-details
          density="compact"
          variant="plain"
          :readonly="isPackagesLocked"
          :suffix="metric.weightLabel.value"
          @update:model-value="(v: string) => setWeight(index, v)"
        />
      </template>
      <template #item.dim_a="{ index }">
        <v-text-field
          :model-value="dispLength(rows[index]!.dim_a)"
          type="number"
          min="0"
          step="0.1"
          hide-details
          density="compact"
          variant="plain"
          :readonly="isPackagesLocked"
          :suffix="metric.lengthLabel.value"
          @update:model-value="(v: string) => setDim(index, 'dim_a', v)"
        />
      </template>
      <template #item.dim_l="{ index }">
        <v-text-field
          :model-value="dispLength(rows[index]!.dim_l)"
          type="number"
          min="0"
          step="0.1"
          hide-details
          density="compact"
          variant="plain"
          :readonly="isPackagesLocked"
          :suffix="metric.lengthLabel.value"
          @update:model-value="(v: string) => setDim(index, 'dim_l', v)"
        />
      </template>
      <template #item.dim_p="{ index }">
        <v-text-field
          :model-value="dispLength(rows[index]!.dim_p)"
          type="number"
          min="0"
          step="0.1"
          hide-details
          density="compact"
          variant="plain"
          :readonly="isPackagesLocked"
          :suffix="metric.lengthLabel.value"
          @update:model-value="(v: string) => setDim(index, 'dim_p', v)"
        />
      </template>
      <template #item.volume="{ item }">
        <v-chip size="small" variant="tonal" color="info">
          {{ volumeOf(item).toFixed(4) }} m³
        </v-chip>
      </template>
      <template #item.actions="{ index }">
        <v-btn
          icon="mdi-delete-outline"
          variant="text"
          size="small"
          :disabled="isPackagesLocked"
          @click="removeRow(index)"
        />
      </template>
      <template #no-data>
        <EmptyState
          icon="mdi-package-variant-closed-remove"
          :title="t('shipment.modals.colli.no_packages')"
          :text="t('shipment.modals.colli.no_packages_text')"
        />
      </template>
    </v-data-table>

    <!-- Package rows are persisted by the modal's single "Save" button
         (ColliModal orchestrates savePackages + commitDraft), so no dedicated
         "Save packages" button here — just the running totals. -->
    <v-card-actions class="px-4 pb-4">
      <div class="text-caption text-medium-emphasis">
        {{ t("shipment.modals.colli.total_weight") }}:
        <strong
          >{{ dispWeight(totalWeight).toFixed(2) }}
          {{ metric.weightLabel.value }}</strong
        >
        &middot; {{ t("shipment.modals.colli.total_volume") }}:
        <strong>{{ totalVolume.toFixed(4) }} m³</strong>
      </div>
    </v-card-actions>
  </component>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { VCard } from "vuetify/components";
import {
  useShipmentStore,
  type ColliRow,
} from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useMetricImperial } from "@shipment/composables/useMetricImperial";
import type { ShipmentPackage } from "@shipment/services/shipment.types";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
// rows live in the store so this list and the Packages header box (colli/pieces)
// share ONE source of truth — see store.colliRows / resizeColliRows.
const { shipment, packages, colliRows, metricDisplay } = storeToRefs(store);
const { isPackagesLocked } = useShipmentState(shipment);

// Display unit system driven by the shared store ref (initialised from the
// client's metric_imperial in ShipmentPackagesBox). Storage is always metric.
const metric = useMetricImperial(metricDisplay.value);
watch(metricDisplay, (v) => metric.setSystem(v), { immediate: true });

// Round helpers — display in 2 dec (legacy spedy_form), persist in 4 dec.
const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 10000) / 10000;

const rows = colliRows;
const initialSnapshot = ref<string>("");

const headers = computed(() => [
  { title: "#", key: "n_collo", width: 60, sortable: false },
  {
    title: t("shipment.modals.colli.col_client_ref"),
    key: "segnac_cliente",
    sortable: false,
  },
  {
    title: t("shipment.modals.colli.col_weight"),
    key: "peso",
    width: 130,
    sortable: false,
  },
  {
    title: t("shipment.modals.colli.col_height"),
    key: "dim_a",
    width: 110,
    sortable: false,
  },
  {
    title: t("shipment.modals.colli.col_length"),
    key: "dim_l",
    width: 110,
    sortable: false,
  },
  {
    title: t("shipment.modals.colli.col_width"),
    key: "dim_p",
    width: 110,
    sortable: false,
  },
  {
    title: t("shipment.modals.colli.col_volume"),
    key: "volume",
    width: 120,
    sortable: false,
  },
  { title: "", key: "actions", width: 60, sortable: false },
]);

/** Normalise a server package list into the editable row shape + serialise. */
function serializePkgs(pkgs: ShipmentPackage[]): string {
  return JSON.stringify(
    pkgs.map((p) => ({
      id: p.id,
      n_collo: Number(p.n_collo) || 0,
      segnac_cliente: p.segnac_cliente ?? "",
      peso: Number(p.peso) || 0,
      dim_a: Number(p.dim_a) || 0,
      dim_l: Number(p.dim_l) || 0,
      dim_p: Number(p.dim_p) || 0,
    })),
  );
}

// Last server package payload we hydrated from. `packages` is a computed off
// shipment.value, so it re-fires on ANY shipment change — including a
// draft-buffered field edit that merges into shipment.value and echoes the
// SAME server package data. Comparing against this (the server payload, NOT
// the possibly-edited colliRows) lets us skip those echoes and only re-hydrate
// on a genuine server refresh, so unsaved row edits are never clobbered.
let lastServerPkgs = "";

watch(
  packages,
  (pkgs) => {
    const incoming = serializePkgs(pkgs);
    if (incoming === lastServerPkgs) return;
    lastServerPkgs = incoming;

    // Mark hydration so the colli↔rows-length watcher (PackagesBox) does not
    // treat this server-driven repopulation as a user add/remove.
    store.colliRowsHydrating = true;
    colliRows.value = pkgs.map((p: ShipmentPackage) => ({
      id: p.id,
      n_collo: Number(p.n_collo) || 0,
      segnac_cliente: p.segnac_cliente ?? "",
      peso: Number(p.peso) || 0,
      dim_a: Number(p.dim_a) || 0,
      dim_l: Number(p.dim_l) || 0,
      dim_p: Number(p.dim_p) || 0,
    }));
    initialSnapshot.value = incoming;
    void Promise.resolve().then(() => {
      store.colliRowsHydrating = false;
    });
  },
  { immediate: true },
);

const dirty = computed(
  () => JSON.stringify(colliRows.value) !== initialSnapshot.value,
);

function addRow(): void {
  // Append one row; resizeColliRows handles n_collo numbering + colli sync.
  store.resizeColliRows(colliRows.value.length + 1);
}
function removeRow(idx: number): void {
  colliRows.value.splice(idx, 1);
}

// ─── Display ⇄ storage conversions (metric in DB, imperial only on screen) ──
function dispWeight(kgMetric: number): number {
  return round2(metric.toDisplayWeight(kgMetric));
}
function dispLength(cmMetric: number): number {
  return round2(metric.toDisplayLength(cmMetric));
}
function setWeight(idx: number, raw: string): void {
  const r = colliRows.value[idx];
  if (!r) return;
  r.peso = round4(metric.fromDisplayWeight(Number(raw) || 0));
}
function setDim(
  idx: number,
  key: "dim_a" | "dim_l" | "dim_p",
  raw: string,
): void {
  const r = colliRows.value[idx];
  if (!r) return;
  r[key] = round4(metric.fromDisplayLength(Number(raw) || 0));
}

function volumeOf(r: ColliRow): number {
  return (r.dim_a * r.dim_l * r.dim_p) / 1_000_000;
}

const totalWeight = computed(() =>
  colliRows.value.reduce((acc, r) => acc + Number(r.peso || 0), 0),
);
const totalVolume = computed(() =>
  colliRows.value.reduce((acc, r) => acc + volumeOf(r), 0),
);

async function save(): Promise<boolean> {
  // rows already hold metric values (conversion happens on edit), so persist as-is.
  return store.savePackages(colliRows.value);
}

// Exposed so the host ColliModal can persist the package rows from the single
// modal "Save" button (no separate "Save packages" button anymore).
defineExpose({ save, dirty });
</script>

<style scoped>
.colli-table :deep(.v-data-table__td) {
  padding: 4px 8px !important;
}
</style>
