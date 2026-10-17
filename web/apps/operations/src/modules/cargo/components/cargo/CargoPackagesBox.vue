<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-package-variant" size="18" class="me-2" />
      {{ t("cargo.packages.title") }}
      <v-badge :content="rows.length" color="primary" inline class="ms-2" />
      <v-spacer />
      <v-text-field
        v-model.number="colliCount"
        type="number"
        min="0"
        step="1"
        :label="t('cargo.packages.colli_pieces')"
        hide-details
        density="compact"
        variant="outlined"
        style="max-width: 120px"
        class="me-3"
        :readonly="isPackagesLocked"
      />
      <v-btn-toggle
        v-model="metricSystem"
        mandatory
        density="comfortable"
        variant="outlined"
        size="x-small"
      >
        <v-btn value="M" size="small">M (kg)</v-btn>
        <v-btn value="I" size="small">I (Lb)</v-btn>
      </v-btn-toggle>
    </v-card-title>
    <v-divider />

    <!-- REQ2: total weight vs sum-of-rows mismatch warning (advisory only) -->
    <v-alert
      v-if="weightMismatch"
      type="warning"
      variant="tonal"
      density="compact"
      class="ma-3"
    >
      {{
        t("cargo.packages.weight_mismatch", {
          total: shipmentWeightDisplay.toFixed(2),
          unit: metric.weightLabel.value,
          sum: totalWeightDisplay.toFixed(2),
        })
      }}
    </v-alert>

    <v-data-table
      :headers="headers"
      :items="rows"
      :items-per-page="-1"
      hide-default-footer
      density="comfortable"
    >
      <template #item.peso="{ index }">
        <v-text-field
          v-model.number="rows[index]!.peso"
          type="number"
          min="0"
          step="0.1"
          hide-details
          density="compact"
          variant="plain"
          :suffix="metric.weightLabel.value"
          :readonly="isPackagesLocked"
        />
      </template>
      <template #item.dim_a="{ index }">
        <v-text-field
          v-model.number="rows[index]!.dim_a"
          type="number"
          min="0"
          step="0.1"
          hide-details
          density="compact"
          variant="plain"
          :suffix="metric.lengthLabel.value"
          :readonly="isPackagesLocked"
        />
      </template>
      <template #item.dim_l="{ index }">
        <v-text-field
          v-model.number="rows[index]!.dim_l"
          type="number"
          min="0"
          step="0.1"
          hide-details
          density="compact"
          variant="plain"
          :suffix="metric.lengthLabel.value"
          :readonly="isPackagesLocked"
        />
      </template>
      <template #item.dim_p="{ index }">
        <v-text-field
          v-model.number="rows[index]!.dim_p"
          type="number"
          min="0"
          step="0.1"
          hide-details
          density="compact"
          variant="plain"
          :suffix="metric.lengthLabel.value"
          :readonly="isPackagesLocked"
        />
      </template>
      <template #item.volume="{ item }">
        <v-chip size="x-small" variant="tonal" color="info">
          {{ volumeOfMetric(item).toFixed(4) }} m³
        </v-chip>
      </template>
      <template #item.stackable="{ index }">
        <v-checkbox
          v-model="rows[index]!.stackable"
          hide-details
          density="compact"
          :disabled="isPackagesLocked"
        />
      </template>
      <template #item.turnable="{ index }">
        <v-checkbox
          v-model="rows[index]!.turnable"
          hide-details
          density="compact"
          :disabled="isPackagesLocked"
        />
      </template>
      <template #item.weighed="{ item }">
        <v-tooltip
          :text="
            item.weighed
              ? t('cargo.packages.weighed_yes')
              : t('cargo.packages.weighed_no')
          "
          location="top"
        >
          <template #activator="{ props: tip }">
            <v-icon
              v-bind="tip"
              :icon="item.weighed ? 'mdi-scale' : 'mdi-account-edit-outline'"
              :color="item.weighed ? 'success' : 'medium-emphasis'"
              size="18"
            />
          </template>
        </v-tooltip>
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
          :title="t('cargo.packages.empty_title')"
        />
      </template>
    </v-data-table>

    <v-card-actions class="px-4 pb-4">
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-plus"
        :disabled="isPackagesLocked"
        @click="addRow"
      >
        {{ t("cargo.charges.add_row") }}
      </v-btn>
      <div class="text-caption text-medium-emphasis ms-4">
        {{ t("cargo.packages.total") }}:
        <strong
          >{{ totalWeightDisplay.toFixed(1) }}
          {{ metric.weightLabel.value }}</strong
        >
        · {{ totalVolume.toFixed(4) }} m³ · {{ t("cargo.packages.chargeable") }}
        {{ chargeableDisplay.toFixed(1) }} {{ metric.weightLabel.value }}
      </div>
      <v-spacer />
      <v-btn
        :loading="store.saving"
        :disabled="isPackagesLocked || !dirty"
        variant="flat"
        color="primary"
        prepend-icon="mdi-content-save-outline"
        @click="save"
      >
        {{ t("common.save") }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import { useMetricImperial } from "@cargo/composables/useMetricImperial";
import type { CargoPackage } from "@cargo/services/cargo.types";

const { t } = useI18n();

/** Local edit row — values are kept METRIC internally; display converts. */
interface LocalRow {
  id?: number | string;
  n_collo: number;
  peso: number;
  dim_a: number;
  dim_l: number;
  dim_p: number;
  stackable: boolean;
  turnable: boolean;
  /** Warehouse weighing date; truthy (non-zero) = weighed in warehouse. */
  weighed: boolean;
}

const store = useCargoStore();
const { cargo, packages } = storeToRefs(store);
const { isPackagesLocked } = useCargoState(cargo);

// ── Metric / imperial ────────────────────────────────────────────────
// System is DERIVED from the client (cargo.metric_imperial). The toggle is a
// LOCAL display override only — there is no metricsystem column to persist to.
const metric = useMetricImperial(
  cargo.value?.metric_imperial === "I" ? "I" : "M",
);
const metricSystem = computed({
  get: () => metric.system.value,
  set: (v: "M" | "I") => metric.setSystem(v),
});
// Re-derive when the client preference arrives/changes (e.g. async load).
watch(
  () => cargo.value?.metric_imperial,
  (mi) => metric.setSystem(mi === "I" ? "I" : "M"),
);

// Volumetric divisor: prefer the client's coeff_volm, fallback to the IATA
// air-freight standard 166.66 (duplicated literal removed in favour of this).
const COEFF_FALLBACK = 166.66;
const coeffVolm = computed(() => {
  const c = Number(cargo.value?.coeff_volm);
  return Number.isFinite(c) && c > 0 ? c : COEFF_FALLBACK;
});

const headers = computed(() => [
  { title: "#", key: "n_collo", width: 60, sortable: false },
  { title: t("cargo.col.weight"), key: "peso", width: 130, sortable: false },
  {
    title: t("cargo.packages.height"),
    key: "dim_a",
    width: 110,
    sortable: false,
  },
  {
    title: t("cargo.packages.length"),
    key: "dim_l",
    width: 110,
    sortable: false,
  },
  {
    title: t("cargo.packages.width"),
    key: "dim_p",
    width: 110,
    sortable: false,
  },
  {
    title: t("cargo.misure.volume"),
    key: "volume",
    width: 110,
    sortable: false,
  },
  {
    title: t("cargo.packages.stackable"),
    key: "stackable",
    width: 90,
    sortable: false,
    align: "center" as const,
  },
  {
    title: t("cargo.packages.turnable"),
    key: "turnable",
    width: 90,
    sortable: false,
    align: "center" as const,
  },
  {
    title: t("cargo.packages.weighed"),
    key: "weighed",
    width: 80,
    sortable: false,
    align: "center" as const,
  },
  { title: "", key: "actions", width: 60, sortable: false },
]);

// ── Buffer ───────────────────────────────────────────────────────────
// rows hold values in the ACTIVE DISPLAY system; metric snapshot is taken on
// load. Editing/adding/removing here is buffered until Save.
const rows = ref<LocalRow[]>([]);
const initialSnapshot = ref<string>("");

/** Map a metric server package into a display row. */
function fromServer(p: CargoPackage): LocalRow {
  return {
    id: p.id,
    n_collo: Number(p.n_collo) || 0,
    peso: round2(metric.toDisplayWeight(Number(p.peso) || 0)),
    dim_a: round2(metric.toDisplayLength(Number(p.dim_a) || 0)),
    dim_l: round2(metric.toDisplayLength(Number(p.dim_l) || 0)),
    dim_p: round2(metric.toDisplayLength(Number(p.dim_p) || 0)),
    // spedizioni_colli.stackable/turnable enum('S','N') default 'S'.
    stackable: (p.stackable ?? "S") !== "N",
    turnable: (p.turnable ?? "S") !== "N",
    // data_pesatura: non-zero date = physically weighed in warehouse.
    weighed: isWeighed(p.data_pesatura),
  };
}

/** True when the warehouse weighing date is set (not the MySQL zero date). */
function isWeighed(d: string | null | undefined): boolean {
  const s = String(d ?? "").trim();
  return s !== "" && !s.startsWith("0000-00-00");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// Rebuild rows when packages load OR the display system flips (so existing
// buffered edits in metric would be lost — we re-read from server state).
watch(
  [packages, () => metric.system.value],
  ([list]) => {
    rows.value = (list as CargoPackage[]).map(fromServer);
    initialSnapshot.value = JSON.stringify(rows.value);
    // colliCount es computed → se re-deriva solo de rows/cargo.colli.
  },
  { immediate: true },
);

const dirty = computed(
  () => JSON.stringify(rows.value) !== initialSnapshot.value,
);

// ── Colli count ↔ rows sync (paridad spedyc_update_funz.php) ──────────
// The colli counter is the source of truth in the legacy form: changing it
// adjusts the number of correlative n_collo rows (adds empties / removes the
// highest). Bidirectional: add/remove rows updates the counter.
//
// Es un `computed` (NO un `ref` sembrado por watchers), para eliminar la
// condición de carrera que dejaba el input en 0 al VISUALIZAR: antes tres
// watchers (packages / cargo.colli / colliCount) competían por sembrarlo según
// el orden de llegada async, y con el guard `rows.length===0` el valor podía
// quedarse en 0. Ahora el getter DERIVA el valor de forma determinista:
//   - hay filas de colli  → su número (fuente de verdad del desglose)
//   - no hay filas         → el `colli` declarado en el cargo (fallback)
// El setter regenera las filas correlativas (crea vacías / recorta la mayor).
function seedFromCargoColli(): number {
  return Math.max(0, Math.floor(Number(cargo.value?.colli) || 0));
}

const colliCount = computed<number>({
  get: () => (rows.value.length > 0 ? rows.value.length : seedFromCargoColli()),
  set: (next) => {
    if (isPackagesLocked.value) return;
    const target = Math.max(0, Math.floor(Number(next) || 0));
    if (target === rows.value.length) return;
    if (target > rows.value.length) {
      while (rows.value.length < target) {
        rows.value.push({
          n_collo: rows.value.length + 1,
          peso: 0,
          dim_a: 0,
          dim_l: 0,
          dim_p: 0,
          stackable: true,
          turnable: true,
          weighed: false,
        });
      }
    } else {
      rows.value.splice(target);
    }
    rows.value.forEach((r, i) => {
      r.n_collo = i + 1;
    });
  },
});

function nextNumber(): number {
  return rows.value.length === 0
    ? 1
    : Math.max(...rows.value.map((r) => r.n_collo)) + 1;
}

function addRow(): void {
  rows.value.push({
    n_collo: nextNumber(),
    peso: 0,
    dim_a: 0,
    dim_l: 0,
    dim_p: 0,
    stackable: true,
    turnable: true,
    weighed: false,
  });
}

function removeRow(idx: number): void {
  rows.value.splice(idx, 1);
  // Renumber correlatively so n_collo stays 1..N.
  rows.value.forEach((r, i) => {
    r.n_collo = i + 1;
  });
}

// ── Volumes & totals (always computed in METRIC for BD-truthful m³) ───
function volumeOfMetric(r: LocalRow): number {
  // r holds DISPLAY values → convert dims back to cm before m³.
  const a = metric.fromDisplayLength(Number(r.dim_a) || 0);
  const l = metric.fromDisplayLength(Number(r.dim_l) || 0);
  const p = metric.fromDisplayLength(Number(r.dim_p) || 0);
  return (a * l * p) / 1_000_000;
}

const totalWeightDisplay = computed(() =>
  rows.value.reduce((acc, r) => acc + (Number(r.peso) || 0), 0),
);
const totalVolume = computed(() =>
  rows.value.reduce((acc, r) => acc + volumeOfMetric(r), 0),
);
const chargeableDisplay = computed(() => {
  // Air-freight chargeable weight: max(actual, volumetric = m³ * coeff).
  const volWeightKg = totalVolume.value * coeffVolm.value;
  const volWeightDisplay = metric.toDisplayWeight(volWeightKg);
  return Math.max(totalWeightDisplay.value, volWeightDisplay);
});

// ── REQ2: shipment weight vs sum-of-rows (advisory) ───────────────────
// Compare the declared shipment weight against the sum of package weights.
// Cargo's real declared weight is `pesor` (chargeable) / `peso_reale`; we use
// peso_reale when set, else pesor, else peso. Comparison done in METRIC.
const shipmentWeightKg = computed(() => {
  const c = cargo.value;
  if (!c) return 0;
  const real = Number(c.peso_reale);
  if (Number.isFinite(real) && real > 0) return real;
  const pesor = Number(c.pesor);
  if (Number.isFinite(pesor) && pesor > 0) return pesor;
  return Number(c.peso) || 0;
});
const shipmentWeightDisplay = computed(() =>
  metric.toDisplayWeight(shipmentWeightKg.value),
);
const totalWeightKg = computed(() =>
  rows.value.reduce(
    (acc, r) => acc + metric.fromDisplayWeight(Number(r.peso) || 0),
    0,
  ),
);
const weightMismatch = computed(() => {
  if (rows.value.length === 0) return false;
  if (shipmentWeightKg.value <= 0) return false;
  return Math.abs(shipmentWeightKg.value - totalWeightKg.value) > 0.01;
});

// ── Persist ───────────────────────────────────────────────────────────
async function save(): Promise<void> {
  // Convert display rows back to METRIC (BD is always metric) before sending.
  const metricRows = rows.value.map((r) => ({
    id: r.id,
    n_collo: r.n_collo,
    peso: String(round4(metric.fromDisplayWeight(Number(r.peso) || 0))),
    dim_a: String(round4(metric.fromDisplayLength(Number(r.dim_a) || 0))),
    dim_l: String(round4(metric.fromDisplayLength(Number(r.dim_l) || 0))),
    dim_p: String(round4(metric.fromDisplayLength(Number(r.dim_p) || 0))),
    stackable: (r.stackable ? "S" : "N") as "S" | "N",
    turnable: (r.turnable ? "S" : "N") as "S" | "N",
  }));
  const ok = await store.savePackages(metricRows);
  if (!ok) return;
  // Persist the colli counter alongside (paridad: contador = fuente de verdad).
  const target = Math.max(0, Math.floor(Number(colliCount.value) || 0));
  if (String(target) !== String(cargo.value?.colli ?? "")) {
    await store.update({ colli: String(target) });
  }
}
</script>
