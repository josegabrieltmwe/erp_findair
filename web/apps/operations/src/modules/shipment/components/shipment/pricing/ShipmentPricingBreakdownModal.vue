<template>
  <ModalWrapper
    name="pricing_breakdown"
    :title="t('shipment.modals.pricing.title')"
    icon="mdi-calculator"
    :max-width="820"
  >
    <v-skeleton-loader v-if="loading" type="article, table-tbody" />

    <v-alert
      v-else-if="loadError"
      type="error"
      density="compact"
      variant="tonal"
      class="mb-3"
    >
      {{ loadError }}
    </v-alert>

    <template v-else-if="breakdown">
      <!-- KPI row -->
      <v-row dense class="mb-2">
        <v-col cols="6" md="3">
          <div class="pb-kpi">
            <div class="pb-kpi__lbl">
              {{ t("shipment.modals.pricing.costo") }}
            </div>
            <div class="pb-kpi__val">{{ fmt(breakdown.totals.costo) }}</div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="pb-kpi">
            <div class="pb-kpi__lbl">
              {{ t("shipment.modals.pricing.carico_client") }}
            </div>
            <div class="pb-kpi__val">{{ fmt(breakdown.totals.carico) }}</div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="pb-kpi">
            <div class="pb-kpi__lbl">
              {{ t("shipment.modals.pricing.profit_perc") }}
            </div>
            <div class="pb-kpi__val">
              {{ breakdown.totals.profit_perc.toFixed(1) }}%
            </div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="pb-kpi">
            <div class="pb-kpi__lbl">
              {{ t("shipment.modals.pricing.expected_profit") }}
            </div>
            <div class="pb-kpi__val" :class="utileColorClass">
              {{ fmt(breakdown.totals.utile_previsto) }}
            </div>
          </div>
        </v-col>
      </v-row>

      <v-tabs v-model="tab" density="compact" color="primary">
        <v-tab value="costo">{{
          t("shipment.modals.pricing.tab_costo")
        }}</v-tab>
        <v-tab value="carico">{{
          t("shipment.modals.pricing.tab_carico")
        }}</v-tab>
        <v-tab value="conversione">{{
          t("shipment.modals.pricing.tab_conversion")
        }}</v-tab>
      </v-tabs>
      <v-divider />

      <v-window v-model="tab" class="mt-3">
        <!-- COSTO TAB — supplier side -->
        <v-window-item value="costo">
          <div class="text-caption font-weight-bold mb-2">
            {{ t("shipment.modals.pricing.supplier_supplements") }}
          </div>
          <EmptyState
            v-if="!breakdown.supplier_supplements.length"
            icon="mdi-package-variant-closed"
            :title="t('shipment.modals.pricing.no_supplier_supplements')"
            density="compact"
          />
          <v-table v-else density="compact">
            <thead>
              <tr>
                <th>{{ t("shipment.modals.pricing.col_code") }}</th>
                <th>{{ t("shipment.modals.pricing.col_description") }}</th>
                <th class="text-right">
                  {{ t("shipment.modals.pricing.col_amount") }}
                </th>
                <th class="text-center">Σ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in breakdown.supplier_supplements" :key="s.id">
                <td>
                  <code>{{ s.code }}</code>
                </td>
                <td>{{ s.description }}</td>
                <td class="text-right">{{ fmt(s.amount, s.valuta) }}</td>
                <td class="text-center">
                  <v-icon
                    v-if="s.attivo === 'S'"
                    icon="mdi-check"
                    color="success"
                    size="14"
                  />
                  <span v-else class="text-disabled">—</span>
                </td>
              </tr>
            </tbody>
          </v-table>

          <div class="mt-3 text-caption font-weight-bold mb-2">
            {{ t("shipment.modals.pricing.fuel_surcharges") }}
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>{{ t("shipment.modals.pricing.col_code") }}</th>
                <th class="text-right">
                  {{ t("shipment.modals.pricing.col_amount") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(s, idx) in breakdown.surcharges"
                :key="`${s.code}-${idx}`"
              >
                <td>
                  <code>{{ s.code }}</code>
                </td>
                <td class="text-right">{{ fmt(s.amount, s.valuta) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>

        <!-- CARICO TAB — client side -->
        <v-window-item value="carico">
          <v-list density="compact" lines="two">
            <v-list-item>
              <v-list-item-title>{{
                t("shipment.modals.pricing.taxable_weight")
              }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ t("shipment.modals.pricing.taxable_weight_sub") }}
              </v-list-item-subtitle>
              <template #append>
                <span class="text-h6"
                  >{{ breakdown.base.peso_tassabile.toFixed(2) }} kg</span
                >
              </template>
            </v-list-item>
            <v-list-item v-if="breakdown.insurance">
              <v-list-item-title>{{
                t("shipment.modals.pricing.insurance")
              }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ breakdown.insurance.amount.toFixed(2) }}
                {{ breakdown.insurance.valuta }}
              </v-list-item-subtitle>
              <template #append>
                <span class="text-h6">{{
                  fmt(breakdown.insurance.amount, breakdown.insurance.valuta)
                }}</span>
              </template>
            </v-list-item>
            <v-list-item v-if="breakdown.shipment.giac_ricons > 0">
              <v-list-item-title>{{
                t("shipment.modals.pricing.storage_recognition")
              }}</v-list-item-title>
              <template #append>
                <span class="text-h6">{{
                  fmt(breakdown.shipment.giac_ricons)
                }}</span>
              </template>
            </v-list-item>
            <v-list-item v-if="breakdown.shipment.postfatt > 0">
              <v-list-item-title>{{
                t("shipment.modals.pricing.post_invoicing")
              }}</v-list-item-title>
              <template #append>
                <span class="text-h6">{{
                  fmt(breakdown.shipment.postfatt)
                }}</span>
              </template>
            </v-list-item>
          </v-list>

          <div class="mt-3 text-caption font-weight-bold mb-2">
            {{ t("shipment.modals.pricing.client_supplements") }}
          </div>
          <EmptyState
            v-if="!breakdown.client_supplements.length"
            icon="mdi-package-variant-closed"
            :title="t('shipment.modals.pricing.no_client_supplements')"
            density="compact"
          />
          <v-table v-else density="compact">
            <thead>
              <tr>
                <th>{{ t("shipment.modals.pricing.col_code") }}</th>
                <th>{{ t("shipment.modals.pricing.col_description") }}</th>
                <th class="text-right">
                  {{ t("shipment.modals.pricing.col_amount") }}
                </th>
                <th class="text-center">Σ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in breakdown.client_supplements" :key="s.id">
                <td>
                  <code>{{ s.code }}</code>
                </td>
                <td>{{ s.description }}</td>
                <td class="text-right">{{ fmt(s.amount, s.valuta) }}</td>
                <td class="text-center">
                  <v-icon
                    v-if="s.attivo === 'S'"
                    icon="mdi-check"
                    color="success"
                    size="14"
                  />
                  <span v-else class="text-disabled">—</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>

        <!-- CONVERSIONE TAB -->
        <v-window-item value="conversione">
          <EmptyState
            v-if="!breakdown.currency_chain.length"
            icon="mdi-currency-eur"
            :title="t('shipment.modals.pricing.single_currency')"
            :text="t('shipment.modals.pricing.single_currency_text')"
            density="compact"
          />
          <v-list v-else density="compact">
            <v-list-item
              v-for="(step, idx) in breakdown.currency_chain"
              :key="idx"
            >
              <template #prepend>
                <v-icon icon="mdi-arrow-right" size="16" />
              </template>
              <v-list-item-title>{{ step }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-window-item>
      </v-window>
    </template>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import {
  shipmentPricingService,
  type ShipmentPricingBreakdown,
} from "@shipment/services/shipment_pricing.service";
import ModalWrapper from "../modals/ModalWrapper.vue";
import { formatMoney } from "@shipment/utils/currency";

const { t } = useI18n();
const ui = useUiStore();
const store = useShipmentStore();
const { id } = storeToRefs(store);

const breakdown = ref<ShipmentPricingBreakdown | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);
const tab = ref<"costo" | "carico" | "conversione">("costo");

const utileColorClass = computed(() => {
  const v = breakdown.value?.totals.utile_previsto ?? 0;
  if (v > 0) return "pb-pos";
  if (v < 0) return "pb-neg";
  return "";
});

async function load(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  loadError.value = null;
  try {
    breakdown.value = await shipmentPricingService.breakdown(Number(id.value));
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

watch(
  () => ui.activeModal,
  (n) => {
    if (n === "pricing_breakdown") {
      tab.value = "costo";
      void load();
    }
  },
);

function fmt(v: number, valuta = "EUR"): string {
  return formatMoney(v, valuta);
}
</script>

<style scoped>
.pb-kpi {
  text-align: center;
  padding: 8px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-variant), 0.4);
}
.pb-kpi__lbl {
  font-size: 11px;
  opacity: 0.65;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pb-kpi__val {
  font-size: 18px;
  font-weight: 700;
  margin-top: 2px;
  font-feature-settings: "tnum";
}
.pb-pos {
  color: rgb(var(--v-theme-success));
}
.pb-neg {
  color: rgb(var(--v-theme-error));
}
</style>
