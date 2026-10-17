<template>
  <section class="card-tmwe card-tmwe--alt">
    <CardHeader
      icon="mdi-currency-eur"
      :title="t('shipment.cards.costi.title')"
      editable
      alt
      @edit="ui.openModal('costi')"
    >
      <template #badge>
        <button
          type="button"
          class="lock-toggle"
          :class="{ 'lock-toggle--on': caricoLk }"
          :title="
            caricoLk
              ? t('shipment.cards.costi.lock_client_on')
              : t('shipment.cards.costi.lock_client_off')
          "
          @click.stop="toggleLock('carico_lk')"
        >
          <v-icon
            :icon="caricoLk ? 'mdi-lock' : 'mdi-lock-open-variant-outline'"
            size="13"
          />
          <span class="lock-toggle__lab">{{
            t("shipment.cards.costi.lock_client_lab")
          }}</span>
        </button>
        <button
          type="button"
          class="lock-toggle"
          :class="{ 'lock-toggle--on': costoPrevistoLk }"
          :title="
            costoPrevistoLk
              ? t('shipment.cards.costi.lock_supplier_on')
              : t('shipment.cards.costi.lock_supplier_off')
          "
          @click.stop="toggleLock('costo_previsto_lk')"
        >
          <v-icon
            :icon="
              costoPrevistoLk ? 'mdi-lock' : 'mdi-lock-open-variant-outline'
            "
            size="13"
          />
          <span class="lock-toggle__lab">{{
            t("shipment.cards.costi.lock_supplier_lab")
          }}</span>
        </button>
      </template>
    </CardHeader>
    <!-- The cost/charge/margin KPIs now live in MetricsCard (single source).
         This card focuses on the detailed price breakdown below. -->

    <!-- Desglose cargo/coste/margen directo bajo la cabecera del card. Antes
         iba dentro de un <details> con su propia sub-cabecera "Amount detail"
         (icono € repetido) → doble cabecera recargada. Aplanado a una sola. -->
    <div class="costi-body">
      <!-- Charge (client) | Cost (supplier) side by side — same full-width
           strategy as the addresses card, instead of two stacked blocks. -->
      <div class="costi-grid">
        <div class="costi-col">
          <div class="clab clab--charge">
            {{ t("shipment.cards.costi.charge_section") }}
          </div>
          <div class="linerow">
            <span>{{ t("shipment.cards.costi.net_price") }}</span
            ><b>{{ formatEur(num("carico")) }}</b>
          </div>
          <div v-if="num('fuel_surc') > 0" class="linerow">
            <span>{{ t("shipment.cards.costi.fuel") }}</span
            ><b>{{ formatEur(num("fuel_surc")) }}</b>
          </div>
          <div class="linerow tot">
            <span>{{ t("shipment.cards.costi.charge_total") }}</span
            ><b>{{ formatEur(charged) }}</b>
          </div>
        </div>
        <div class="costi-col">
          <div class="clab clab--cost">
            {{ t("shipment.cards.costi.cost_section") }}
          </div>
          <div class="linerow">
            <span>{{ t("shipment.cards.costi.net_net") }}</span
            ><b>{{ formatEur(num("costo")) }}</b>
          </div>
          <div v-if="num('fuel_surc_cst') > 0" class="linerow">
            <span>{{ t("shipment.cards.costi.fuel_src") }}</span
            ><b>{{ formatEur(num("fuel_surc_cst")) }}</b>
          </div>
          <div class="linerow tot">
            <span>{{ t("shipment.cards.costi.cost_total") }}</span
            ><b>{{ formatEur(cost) }}</b>
          </div>
        </div>
      </div>

      <!-- MarkUp (previsto) y Profit (real) por separado — paridad legacy
           spedy_form.php (utile_p / utile_r). MarkUp = carico+fuel − costo−fuel.
           Profit solo aparece cuando hay costo real (costor > 0). -->
      <div class="costi-margin" :class="markupBandClass">
        <span class="costi-margin__label">{{
          t("shipment.cards.costi.markup")
        }}</span>
        <span class="costi-margin__value">{{ formatEur(markup) }}</span>
      </div>
      <div v-if="profit !== null" class="costi-margin" :class="profitBandClass">
        <span class="costi-margin__label">{{
          t("shipment.cards.costi.profit")
        }}</span>
        <span class="costi-margin__value">{{ formatEur(profit) }}</span>
      </div>

      <!-- Invoicing / pricing actions, evenly laid out instead of crammed. -->
      <div class="costi-actions">
        <button
          type="button"
          class="postinv-link"
          @click="ui.openModal('post_invoice')"
        >
          <v-icon icon="mdi-receipt-text-edit-outline" size="14" class="me-1" />
          {{ t("shipment.cards.costi.post_invoice") }}
        </button>
        <button
          type="button"
          class="postinv-link"
          @click="ui.openModal('pricing_breakdown')"
        >
          <v-icon icon="mdi-calculator" size="14" class="me-1" />
          {{ t("shipment.cards.costi.pricing_details") }}
        </button>
        <!-- Bill the shipment (legacy fattsw3 → pp=fatt_m). Shown only when
                 not fully invoiced yet (id_fattura_a==0 || id_fattura_a2==0). -->
        <a
          v-if="canBill"
          :href="billUrl"
          target="_blank"
          rel="noopener"
          class="postinv-link"
        >
          <v-icon icon="mdi-receipt-text-plus-outline" size="14" class="me-1" />
          {{ t("shipment.cards.costi.bill_shipment") }}
        </a>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import { useToastStore } from "@shipment/stores/toast.store";
import { formatMoney } from "@shipment/utils/currency";
import { useMargin } from "@shipment/composables/useMargin";
import CardHeader from "@shipment/components/shell/CardHeader.vue";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const ui = useUiStore();
const toasts = useToastStore();

const { cost, charged, markup, profit } = useMargin();

function get<T = string>(field: string): T | undefined {
  return (shipment.value as unknown as Record<string, T> | null)?.[field];
}

const caricoLk = computed<boolean>(() => get<string>("carico_lk") === "S");
const costoPrevistoLk = computed<boolean>(
  () => get<string>("costo_previsto_lk") === "S",
);

// Bill the shipment (legacy fattsw3). Shown until the client invoicing is
// complete (id_fattura_a==0 OR id_fattura_a2==0). Abre la SPA invoicing en modo
// nueva factura CONTEXTUALIZADA a esta expedición + cliente (paridad legacy
// fattsw3 → cmqY_id_cliente + cmqY_id_spediz): el modal de generación se abre
// con el cliente preseleccionado y restringido a esta expedición.
const canBill = computed<boolean>(() => {
  const a1 = Number(get<string | number>("id_fattura_a") ?? 0);
  const a2 = Number(get<string | number>("id_fattura_a2") ?? 0);
  return a1 === 0 || a2 === 0;
});
const billUrl = computed<string>(() => {
  const base =
    (typeof window !== "undefined" && window.__TMWE_SHIPMENT__?.basePath) ||
    "/bff/v1";
  const client = Number(get<string | number>("id_cliente") ?? 0);
  const shipId = Number(get<string | number>("id") ?? 0);
  const qs = new URLSearchParams({ new: "1" });
  if (client > 0) qs.set("client", String(client));
  if (shipId > 0) {
    qs.set("shipment", String(shipId));
    qs.set("tipo", "express");
  }
  return `${base}/invoicing?${qs.toString()}`;
});

async function toggleLock(
  field: "carico_lk" | "costo_previsto_lk",
): Promise<void> {
  const current = get<string>(field) === "S";
  const next = current ? "N" : "S";
  await store.update({ [field]: next } as Record<string, "S" | "N">);
  const key =
    field === "carico_lk"
      ? next === "S"
        ? "shipment.cards.costi.toast_charge_locked"
        : "shipment.cards.costi.toast_charge_unlocked"
      : next === "S"
        ? "shipment.cards.costi.toast_cost_locked"
        : "shipment.cards.costi.toast_cost_unlocked";
  toasts.push("success", t(key));
}

function num(field: string): number {
  const v = (shipment.value as unknown as Record<string, unknown> | null)?.[
    field
  ];
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Tinte por signo de cada banda (MarkUp / Profit): positivo=verde, negativo=rojo.
function bandClass(value: number): string {
  if (value < 0) return "costi-margin--negative";
  return "costi-margin--positive";
}
const markupBandClass = computed<string>(() => bandClass(markup.value));
const profitBandClass = computed<string>(() =>
  profit.value === null ? "" : bandClass(profit.value),
);

// Shared money formatter (single source of truth) — alias kept for the template.
const formatEur = formatMoney;
</script>

<style scoped>
.costi-body {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lock-toggle {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 8px;
  margin-left: 4px;
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.4);
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-weight: 600;
}
.lock-toggle:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.lock-toggle--on {
  color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.1);
}
.lock-toggle--on:hover {
  background: rgba(var(--v-theme-warning), 0.18);
}
.lock-toggle__lab {
  letter-spacing: 0.2px;
}
.card-tmwe {
  container-type: inline-size;
}
/* Charge | cost side by side, hairline divider between (addresses pattern). */
.costi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 4px;
}
.costi-grid > .costi-col + .costi-col {
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  padding-left: 8px;
}
.costi-col {
  min-width: 0;
}
/* Collapse to stacked blocks when the card is narrow. */
@container (max-width: 380px) {
  .costi-grid {
    grid-template-columns: 1fr;
  }
  .costi-grid > .costi-col + .costi-col {
    border-left: 0;
    padding-left: 0;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
    margin-top: 6px;
    padding-top: 4px;
  }
}
.clab--charge {
  color: rgb(var(--v-theme-success));
}
.clab--cost {
  color: rgb(var(--v-theme-primary));
}

/* Margin band — the headline figure, in its own tinted strip. */
.costi-margin {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.costi-margin--positive {
  background: rgba(var(--v-theme-success), 0.1);
}
.costi-margin--negative {
  background: rgba(var(--v-theme-error), 0.1);
}
.costi-margin__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  opacity: 0.7;
}
.costi-margin__value {
  font-size: 14px;
  font-weight: 800;
  font-feature-settings: "tnum";
}
.costi-margin--positive .costi-margin__value {
  color: rgb(var(--v-theme-success));
}
.costi-margin--negative .costi-margin__value {
  color: rgb(var(--v-theme-error));
}

/* Invoicing actions — wrap evenly with a consistent gap (no cramped ms-3). */
.costi-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 10px;
  padding-top: 8px;
  /* Sin línea separadora interna (paridad con CargoCostiCard .cost-actions). */
}
.postinv-link {
  background: none;
  border: none;
  padding: 4px 0;
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: opacity 0.15s;
}
.postinv-link:hover {
  opacity: 0.8;
}
</style>
