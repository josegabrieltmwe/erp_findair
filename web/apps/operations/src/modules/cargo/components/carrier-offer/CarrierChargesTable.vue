<template>
  <v-card variant="outlined" class="carrier-card" data-testid="carrier-charges">
    <v-card-title class="carrier-card__title">{{ t("cargo.carrierOffer.charges_title") }}</v-card-title>
    <v-card-text>
      <p v-if="form" class="carrier-hint">{{ t("cargo.carrierOffer.edit_hint") }}</p>
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
              <template v-if="form">
                <th class="num mine">{{ t("cargo.carrierOffer.col_your_cost", { currency }) }}</th>
                <th class="num mine">{{ t("cargo.carrierOffer.col_your_min", { currency }) }}</th>
                <th class="num mine">{{ t("cargo.carrierOffer.col_your_max", { currency }) }}</th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in charges" :key="c.id">
              <td>{{ c.code || "—" }}</td>
              <td>{{ c.nome }}</td>
              <td class="num">{{ chargeAmount(c.costo_unit) }}</td>
              <td>{{ typeLabel(c.type) }}</td>
              <td class="num">{{ chargeAmount(c.costo_min) }}</td>
              <td class="num">{{ chargeAmount(c.costo_max, { maxSentinel: true }) }}</td>
              <template v-if="form && form.lines[i]">
                <td v-for="col in cols" :key="col" class="num mine">
                  <input
                    v-model="form.lines[i][col]"
                    class="carrier-input"
                    :class="{ 'carrier-input--error': errors[`lines.${i}.${col}`] }"
                    inputmode="decimal"
                    autocomplete="off"
                    :aria-label="`${c.nome} — ${t(`cargo.carrierOffer.col_your_${col === 'unit' ? 'cost' : col}`, { currency })}`"
                    :aria-invalid="errors[`lines.${i}.${col}`] ? 'true' : 'false'"
                    :data-testid="`carrier-line-${c.id}-${col}`"
                  />
                </td>
              </template>
            </tr>
            <tr v-if="charges.length === 0">
              <td :colspan="form ? 9 : 6" class="carrier-empty">{{ t("cargo.carrierOffer.no_charges") }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="lineErrors.length" class="carrier-error" role="alert" data-testid="carrier-line-errors">
        <div v-for="key in lineErrors" :key="key">{{ t(`cargo.carrierOffer.${errors[key]}`, { max: "9,999,999" }) }}</div>
      </div>

      <div class="carrier-totals">
        <label class="carrier-totals__label" for="carrier-weight">{{ t("cargo.carrierOffer.chargeable_weight") }}</label>
        <div class="carrier-totals__value">
          <input
            v-if="form"
            id="carrier-weight"
            v-model="form.weight"
            class="carrier-input carrier-input--wide"
            :class="{ 'carrier-input--error': errors.weight }"
            inputmode="decimal"
            autocomplete="off"
            :aria-invalid="errors.weight ? 'true' : 'false'"
            data-testid="carrier-weight-input"
          />
          <span v-else data-testid="carrier-chargeable-weight">{{ chargeAmount(chargeableWeight) }}</span>
          kg
        </div>
        <div v-if="errors.weight" class="carrier-error carrier-error--inline" role="alert">{{ t(`cargo.carrierOffer.${errors.weight}`) }}</div>
        <span class="carrier-totals__label">{{ t("cargo.carrierOffer.total_all_in") }}</span>
        <span class="carrier-total" data-testid="carrier-total" aria-live="polite">{{ formatMoney(total, currency) }}</span>
        <div v-if="errors.total" class="carrier-error carrier-error--inline" role="alert">{{ t(`cargo.carrierOffer.${errors.total}`) }}</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { CarrierCharge } from "@cargo/services/carrier_offer.service";
import { chargeAmount, chargeTypeKey, formatMoney } from "@cargo/composables/carrierOffer";
import type { QuoteForm } from "@cargo/composables/carrierOfferForm";

/**
 * Tabla de cargos. Solo lectura mientras no se pase `form`; con `form` la aerolínea escribe SUS importes (coste, mínimo, máximo)
 * a la derecha de los de TMWE y el peso tasable, y el total se recalcula en vivo (el definitivo lo calcula el servidor).
 */
const props = defineProps<{
  charges: CarrierCharge[];
  currency: string;
  total: number;
  chargeableWeight: number;
  form?: QuoteForm | null;
  errors?: Record<string, string>;
}>();
const { t } = useI18n();

const cols = ["unit", "min", "max"] as const;
const errors = computed(() => props.errors ?? {});
const lineErrors = computed(() => Object.keys(errors.value).filter((k) => k.startsWith("lines.")));

function typeLabel(type: string | null): string {
  const key = chargeTypeKey(type);
  return key ? t(`cargo.carrierOffer.${key}`) : (type ?? "—");
}
</script>

<style scoped lang="scss">
.carrier-card__title { font-size: 1rem; font-weight: 600; }
.carrier-hint { margin: 0 0 12px; font-size: 0.85rem; opacity: 0.75; }
.carrier-table-wrap { overflow-x: auto; }
.carrier-table { width: 100%; border-collapse: collapse; min-width: 560px; font-size: 0.9rem; }
.carrier-table th, .carrier-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid rgba(var(--v-border-color), 0.2); }
.carrier-table th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.carrier-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.carrier-table .mine { background: rgba(var(--v-theme-primary), 0.05); }
.carrier-empty { opacity: 0.6; text-align: center; padding: 16px 10px; }
.carrier-input { width: 96px; padding: 4px 8px; text-align: right; font: inherit; font-variant-numeric: tabular-nums; color: inherit; background: rgb(var(--v-theme-surface)); border: 1px solid rgba(var(--v-border-color), 0.5); border-radius: 4px; }
.carrier-input:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 1px; }
.carrier-input--wide { width: 120px; }
.carrier-input--error { border-color: rgb(var(--v-theme-error)); }
.carrier-error { margin-top: 8px; font-size: 0.85rem; color: rgb(var(--v-theme-error)); }
.carrier-error--inline { grid-column: 1 / -1; margin: 0; text-align: right; }
.carrier-totals { display: grid; grid-template-columns: 1fr max-content; gap: 8px 16px; align-items: center; margin: 16px 0 0; }
.carrier-totals__label { opacity: 0.7; }
.carrier-totals__value { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.carrier-total { text-align: right; font-size: 1.15rem; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
