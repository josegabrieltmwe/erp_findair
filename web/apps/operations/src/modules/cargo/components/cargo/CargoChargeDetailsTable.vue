<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-table-large" size="18" class="me-2" />
      {{ t("cargo.charge_details.title") }}
      <v-badge :content="rows.length" color="primary" inline class="ms-2" />
      <v-spacer />
      <v-btn
        size="x-small"
        variant="text"
        prepend-icon="mdi-cash-refund"
        :loading="recomputing"
        @click="recomputeProfit"
      >
        {{ t("cargo.charge_details.recompute_price_kg") }}
      </v-btn>
      <v-btn
        size="x-small"
        variant="tonal"
        prepend-icon="mdi-calculator-variant-outline"
        :loading="recalculating"
        @click="recalculate"
      >
        {{ t("cargo.charge_details.recalculate") }}
      </v-btn>
    </v-card-title>
    <v-divider />

    <v-data-table
      :headers="headers"
      :items="rows"
      :items-per-page="-1"
      hide-default-footer
      density="comfortable"
      :loading="loading"
    >
      <template #item.tipo="{ item }">
        <v-chip size="x-small" :color="tipoColor(item.tipo)" variant="tonal">
          {{ item.tipo }}
        </v-chip>
      </template>
      <!-- Incluir/excluir la voz del total (campo `somma` S/N). Toggle → guarda
           y dispara recalc automático (paridad legacy addrmv → ReCalc). -->
      <template #item.somma="{ item }">
        <v-switch
          :model-value="item.somma === 'S'"
          :disabled="item.tipo === 'V' || savingId === item.id"
          density="compact"
          hide-details
          color="primary"
          inset
          @update:model-value="onToggleSomma(item)"
        />
      </template>
      <!-- Coste unitario editable inline → al confirmar (blur/enter) guarda y
           recalcula (paridad legacy FldUpdDt costo_unit → ReCalc). -->
      <template #item.costo_unit="{ item }">
        <v-text-field
          v-if="item.tipo !== 'V'"
          :model-value="item.costo_unit"
          type="number"
          density="compact"
          hide-details
          variant="plain"
          class="cm-charge-input"
          :disabled="savingId === item.id"
          @blur="
            (e: FocusEvent) =>
              onEditField(
                item,
                'costo_unit',
                (e.target as HTMLInputElement).value,
              )
          "
          @keyup.enter="
            (e: KeyboardEvent) => (e.target as HTMLInputElement).blur()
          "
        />
        <span v-else>—</span>
      </template>
      <template #item.total="{ item }">
        <strong>{{ fmt(item.total) }}</strong>
      </template>
      <template #no-data>
        <EmptyState
          icon="mdi-table-search"
          :title="t('cargo.charge_details.empty_title')"
          :text="t('cargo.charge_details.empty_text')"
        />
      </template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, watch, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { chargeDetailsService } from "@cargo/services/cargo.service";
import type { CargoChargeDetail } from "@cargo/services/cargo.types";
import { profitService } from "@cargo/services/profit.service";
import { useToastStore } from "@cargo/stores/toast.store";

const { t } = useI18n();
const store = useCargoStore();
const { id } = storeToRefs(store);
const toasts = useToastStore();

const headers = computed(() => [
  { title: t("cargo.col.type"), key: "tipo", width: 90, sortable: true },
  { title: t("cargo.col.code"), key: "code", width: 100, sortable: true },
  { title: t("cargo.col.description"), key: "nome" },
  {
    title: t("cargo.col.unit_cost"),
    key: "costo_unit",
    width: 130,
    sortable: true,
    align: "end" as const,
  },
  {
    title: t("cargo.col.qty"),
    key: "qty",
    width: 80,
    sortable: false,
    align: "end" as const,
  },
  {
    title: t("cargo.charge_details.include"),
    key: "somma",
    width: 90,
    sortable: false,
    align: "center" as const,
  },
  {
    title: t("cargo.col.total"),
    key: "total",
    width: 130,
    sortable: true,
    align: "end" as const,
  },
]);

const rows = ref<CargoChargeDetail[]>([]);
const loading = ref(false);
const recalculating = ref(false);
const recomputing = ref(false);
const savingId = ref<number | null>(null);

/**
 * Editar un campo de una voz y RECALCULAR automáticamente (paridad legacy
 * spedyc_form.php FldUpdDt → ReCalc): cada edición de costo_unit/min/max o el
 * toggle `somma` re-suma las voci y actualiza carico_volo/costo_volo_previsto.
 * No persiste si el valor no cambió.
 */
async function persistAndRecalc(
  item: CargoChargeDetail,
  field: "costo_unit" | "costo_min" | "costo_max" | "somma",
  value: unknown,
): Promise<void> {
  if (!id.value) return;
  savingId.value = Number(item.id);
  try {
    const upd = await chargeDetailsService.update(
      Number(item.id),
      field,
      value,
      id.value,
    );
    if (!upd.success) {
      toasts.push(
        "error",
        upd.error ?? t("cargo.charge_details.recalculate_failed"),
      );
      await load();
      return;
    }
    // Auto-recalc encadenado (el mecanismo que dispara el legacy tras cada cambio).
    await chargeDetailsService.recalculate(id.value);
    await load();
    await store.load(id.value); // refresca carico_volo/costo_volo_previsto en la cabecera
  } finally {
    savingId.value = null;
  }
}

async function onToggleSomma(item: CargoChargeDetail): Promise<void> {
  // El backend IGNORA el value y hace el toggle S↔N por su cuenta
  // (Cargo_Charge_Calculation_Service::update_charge_field). El value es un
  // placeholder; lo relevante es que field='somma' dispara el toggle + recalc.
  await persistAndRecalc(item, "somma", item.somma === "S" ? "N" : "S");
}

async function onEditField(
  item: CargoChargeDetail,
  field: "costo_unit" | "costo_min" | "costo_max",
  raw: string,
): Promise<void> {
  const num = Number(raw);
  if (!Number.isFinite(num) || num === Number(item[field] ?? 0)) return; // sin cambio
  await persistAndRecalc(item, field, num);
}

async function load(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  try {
    const r = await chargeDetailsService.list(id.value);
    rows.value = r.success && r.data ? r.data : [];
  } finally {
    loading.value = false;
  }
}

async function recalculate(): Promise<void> {
  if (!id.value) return;
  recalculating.value = true;
  try {
    const r = await chargeDetailsService.recalculate(id.value);
    if (r.success) {
      toasts.push("success", t("cargo.charge_details.recalculated"));
      await load();
    } else {
      toasts.push(
        "error",
        r.error ?? t("cargo.charge_details.recalculate_failed"),
      );
    }
  } finally {
    recalculating.value = false;
  }
}

/**
 * Recompute the per-kg unit cost from debug_valori using
 * api_cargo_profit. Returns a structured payload — we surface
 * the old → new price in the toast so operators see the delta.
 */
async function recomputeProfit(): Promise<void> {
  if (!id.value) return;
  recomputing.value = true;
  try {
    const r = await profitService.recompute(id.value);
    if (r.success && r.data) {
      const d = r.data;
      if (d.changed) {
        toasts.push(
          "success",
          t("cargo.charge_details.price_kg_changed", {
            old: fmt(d.old_price_per_kg),
            new: fmt(d.new_price_per_kg),
            weight: d.chargeable_weight.toFixed(1),
          }),
        );
      } else {
        toasts.push(
          "info",
          t("cargo.charge_details.price_kg_unchanged", {
            price: fmt(d.new_price_per_kg),
          }),
        );
      }
      await load();
    } else {
      toasts.push(
        "error",
        r.error ?? t("cargo.charge_details.recompute_failed"),
      );
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    recomputing.value = false;
  }
}

function fmt(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function tipoColor(tipo: string): string {
  if (tipo === "P") return "primary"; // peso al Kg
  if (tipo === "F") return "info"; // fuel surcharge
  if (tipo === "S") return "warning"; // security
  if (tipo === "O") return "secondary"; // others
  return "default";
}

onMounted(load);
watch(id, load);
</script>

<style scoped>
/* Input inline compacto para editar el coste unitario en la tabla de voci. */
.cm-charge-input {
  max-width: 110px;
  margin-left: auto;
}
.cm-charge-input :deep(input) {
  text-align: right;
}
</style>
