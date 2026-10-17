<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-cash-multiple" size="18" class="me-2" />
      {{ t("shipment.cards.margine.title") }}
    </v-card-title>
    <v-divider />
    <v-card-text class="pa-3">
      <div class="margin-grid">
        <div class="margin-kpi">
          <div class="margin-kpi__label">
            {{ t("shipment.cards.margine.charge") }}
          </div>
          <div class="margin-kpi__value">{{ fmt(charged) }}</div>
        </div>
        <div class="margin-kpi">
          <div class="margin-kpi__label">
            {{ t("shipment.cards.margine.cost") }}
          </div>
          <div class="margin-kpi__value">{{ fmt(cost) }}</div>
        </div>
        <div class="margin-kpi">
          <div class="margin-kpi__label">
            {{ t("shipment.cards.margine.margin") }}
          </div>
          <div class="margin-kpi__value" :class="signClass">
            {{ fmt(margin) }}
          </div>
          <div class="margin-kpi__pct">
            {{ marginPct ?? "—" }}{{ marginPct != null ? "%" : "" }}
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useMargin } from "@shipment/composables/useMargin";

const { t } = useI18n();
const { charged, cost, margin, marginPct, marginColor } = useMargin();

const signClass = computed(() => {
  const c = marginColor.value;
  if (c === "error") return "margin-kpi__value--negative";
  if (c === "success" || c === "medium") return "margin-kpi__value--positive";
  return "";
});

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
</script>

<style scoped>
.margin-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}
.margin-kpi {
  text-align: center;
}
.margin-kpi__label {
  font-size: 11px;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.margin-kpi__value {
  font-size: 16px;
  font-weight: 700;
  font-feature-settings: "tnum";
  margin-top: 2px;
}
.margin-kpi__value--positive {
  color: rgb(var(--v-theme-success));
}
.margin-kpi__value--negative {
  color: rgb(var(--v-theme-error));
}
.margin-kpi__pct {
  font-size: 11px;
  opacity: 0.6;
  margin-top: 2px;
}
</style>
