<template>
  <section class="card-tmwe">
    <CardHeader icon="mdi-cash-multiple" :title="t('cargo.profit.title')">
      <template #actions>
        <v-tooltip location="bottom">
          <template #activator="{ props }">
            <v-icon v-bind="props" icon="mdi-information-outline" size="14" />
          </template>
          <div class="profit-tt">
            <div class="font-weight-bold mb-1">
              {{ t("cargo.profit.computed") }}
            </div>
            <div>previsto = carico_volo − costo_volo_previsto</div>
            <div>reale = carico_volo − costo_volo_reale</div>
            <div class="text-caption mt-1 text-medium-emphasis">
              {{ t("cargo.profit.no_column") }}
            </div>
          </div>
        </v-tooltip>
      </template>
    </CardHeader>
    <div>
      <div class="profit-grid">
        <div class="profit-kpi">
          <div class="profit-kpi__label">{{ t("cargo.profit.forecast") }}</div>
          <div class="profit-kpi__value" :class="signClass(utilePrevisto)">
            {{ fmt(utilePrevisto) }}
          </div>
          <div class="profit-kpi__pct">
            {{ pct(utilePrevisto, caricoVolo) }}
          </div>
        </div>
        <div class="profit-kpi">
          <div class="profit-kpi__label">{{ t("cargo.profit.real") }}</div>
          <div class="profit-kpi__value" :class="signClass(utileReale)">
            {{ utileRealeLabel }}
          </div>
          <div class="profit-kpi__pct">
            {{
              costoReale > 0
                ? pct(utileReale, caricoVolo)
                : t("cargo.profit.not_booked")
            }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useCargoStore } from "@cargo/stores/cargo.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";

const { t } = useI18n();
const cargo = useCargoStore();

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Profit is derived — the legacy `utile_p` / `utile_r` columns do NOT
 * exist in `spedizioni_cargo`. Same maths the legacy form (and
 * Cargo_Charge_Calculation_Service) does inline: customer price minus
 * carrier cost, in the cargo's display currency.
 */
const caricoVolo = computed(() => num(cargo.cargo?.carico_volo));
const costoPrevisto = computed(() => num(cargo.cargo?.costo_volo_previsto));
const costoReale = computed(() => num(cargo.cargo?.costo_volo_reale));
const utilePrevisto = computed(() => caricoVolo.value - costoPrevisto.value);
const utileReale = computed(() => caricoVolo.value - costoReale.value);
const utileRealeLabel = computed(() =>
  costoReale.value > 0 ? fmt(utileReale.value) : "—",
);

function fmt(v: number): string {
  try {
    return new Intl.NumberFormat([], {
      style: "currency",
      currency: "EUR",
    }).format(v);
  } catch {
    return `${v.toFixed(2)} EUR`;
  }
}

function pct(margin: number, base: number): string {
  if (!base) return "—";
  return `${((margin / base) * 100).toFixed(1)}%`;
}

function signClass(v: number): string {
  if (v > 0) return "profit-kpi__value--positive";
  if (v < 0) return "profit-kpi__value--negative";
  return "profit-kpi__value--neutral";
}
</script>

<style scoped>
.profit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.profit-kpi {
  text-align: center;
}
.profit-kpi__label {
  font-size: 11px;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.profit-kpi__value {
  font-size: 18px;
  font-weight: 700;
  font-feature-settings: "tnum";
  margin-top: 2px;
}
.profit-kpi__value--positive {
  color: rgb(var(--v-theme-success));
}
.profit-kpi__value--negative {
  color: rgb(var(--v-theme-error));
}
.profit-kpi__pct {
  font-size: 11px;
  opacity: 0.6;
  margin-top: 2px;
}
.profit-tt {
  font-size: 12px;
  line-height: 1.4;
}
</style>
