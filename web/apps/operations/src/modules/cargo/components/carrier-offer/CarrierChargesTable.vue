<template>
  <v-card variant="outlined" class="carrier-card" data-testid="carrier-charges">
    <v-card-title class="carrier-card__title">{{ t("cargo.carrierOffer.charges_title") }}</v-card-title>
    <v-card-text>
      <div class="carrier-table-wrap">
        <table class="carrier-table">
          <thead>
            <tr>
              <th>{{ t("cargo.carrierOffer.col_code") }}</th>
              <th>{{ t("cargo.carrierOffer.col_name") }}</th>
              <th class="num">{{ t("cargo.carrierOffer.col_cost", { currency }) }}</th>
              <th>{{ t("cargo.carrierOffer.col_type") }}</th>
              <th class="num">{{ t("cargo.carrierOffer.col_min", { currency }) }}</th>
              <th class="num">{{ t("cargo.carrierOffer.col_max", { currency }) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in charges" :key="c.id">
              <td>{{ c.code || "—" }}</td>
              <td>{{ c.nome }}</td>
              <td class="num">{{ chargeAmount(c.costo_unit) }}</td>
              <td>{{ typeLabel(c.type) }}</td>
              <td class="num">{{ chargeAmount(c.costo_min) }}</td>
              <td class="num">{{ chargeAmount(c.costo_max, { maxSentinel: true }) }}</td>
            </tr>
            <tr v-if="charges.length === 0">
              <td colspan="6" class="carrier-empty">{{ t("cargo.carrierOffer.no_charges") }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <dl class="carrier-totals">
        <dt>{{ t("cargo.carrierOffer.chargeable_weight") }}</dt>
        <dd data-testid="carrier-chargeable-weight">{{ chargeAmount(chargeableWeight) }} kg</dd>
        <dt>{{ t("cargo.carrierOffer.total_all_in") }}</dt>
        <dd class="carrier-total" data-testid="carrier-total">{{ formatMoney(total, currency) }}</dd>
      </dl>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { CarrierCharge } from "@cargo/services/carrier_offer.service";
import { chargeAmount, chargeTypeKey, formatMoney } from "@cargo/composables/carrierOffer";

defineProps<{ charges: CarrierCharge[]; currency: string; total: number; chargeableWeight: number }>();
const { t } = useI18n();

function typeLabel(type: string | null): string {
  const key = chargeTypeKey(type);
  return key ? t(`cargo.carrierOffer.${key}`) : (type ?? "—");
}
</script>

<style scoped lang="scss">
.carrier-card__title { font-size: 1rem; font-weight: 600; }
.carrier-table-wrap { overflow-x: auto; }
.carrier-table { width: 100%; border-collapse: collapse; min-width: 560px; font-size: 0.9rem; }
.carrier-table th, .carrier-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid rgba(var(--v-border-color), 0.2); }
.carrier-table th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.carrier-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.carrier-empty { opacity: 0.6; text-align: center; padding: 16px 10px; }
.carrier-totals { display: grid; grid-template-columns: 1fr max-content; gap: 6px 16px; margin: 16px 0 0; }
.carrier-totals dt { opacity: 0.7; }
.carrier-totals dd { margin: 0; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.carrier-total { font-size: 1.15rem; }
</style>
