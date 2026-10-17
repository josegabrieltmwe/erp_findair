<template>
  <ModalWrapper
    name="pricing_breakdown"
    :title="t('cargo.pricing.title')"
    icon="mdi-calculator"
    :max-width="820"
  >
    <v-skeleton-loader v-if="loading" type="article, table-tbody" />

    <template v-else-if="breakdown">
      <!-- KPI row -->
      <v-row dense class="mb-2">
        <v-col cols="6" md="3">
          <div class="bd-kpi">
            <div class="bd-kpi__lbl">{{ t("cargo.pricing.cost") }}</div>
            <div class="bd-kpi__val">{{ fmt(breakdown.totals.costo) }}</div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="bd-kpi">
            <div class="bd-kpi__lbl">
              {{ t("cargo.pricing.charge_client") }}
            </div>
            <div class="bd-kpi__val">{{ fmt(breakdown.totals.carico) }}</div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="bd-kpi">
            <div class="bd-kpi__lbl">{{ t("cargo.pricing.profit_pct") }}</div>
            <div class="bd-kpi__val">
              {{ breakdown.totals.profit_perc.toFixed(1) }}%
            </div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="bd-kpi">
            <div class="bd-kpi__lbl">
              {{ t("cargo.pricing.expected_profit") }}
            </div>
            <div class="bd-kpi__val" :class="utileColorClass">
              {{ fmt(breakdown.totals.utile_previsto) }}
            </div>
          </div>
        </v-col>
      </v-row>

      <v-tabs v-model="tab" density="compact" color="primary">
        <v-tab value="costo">{{ t("cargo.pricing.cost") }}</v-tab>
        <v-tab value="carico">{{ t("cargo.pricing.charge") }}</v-tab>
        <v-tab value="conversione">{{ t("cargo.pricing.conversion") }}</v-tab>
        <v-tab value="note">{{ t("cargo.notes.title") }}</v-tab>
      </v-tabs>
      <v-divider />

      <v-window v-model="tab" class="mt-3">
        <!-- COSTO TAB — charge lines + surcharges -->
        <v-window-item value="costo">
          <div class="text-caption font-weight-bold mb-2">
            {{ t("cargo.pricing.charge_lines") }}
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>{{ t("cargo.col.type") }}</th>
                <th>{{ t("cargo.col.code") }}</th>
                <th>{{ t("cargo.col.description") }}</th>
                <th class="text-right">{{ t("cargo.pricing.unit") }}</th>
                <th class="text-right">{{ t("cargo.charges.min") }}</th>
                <th class="text-right">{{ t("cargo.charges.max") }}</th>
                <th class="text-center">Σ</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="l in breakdown.lines"
                :key="l.id"
                :class="{ 'is-included': l.somma === 'S' }"
              >
                <td>
                  <v-chip size="x-small" variant="tonal">{{ l.tipo }}</v-chip>
                </td>
                <td>
                  <code>{{ l.code }}</code>
                </td>
                <td>{{ l.nome }}</td>
                <td class="text-right">{{ fmt(l.costo_unit) }}</td>
                <td class="text-right">{{ fmtPlain(l.costo_min) }}</td>
                <td class="text-right">{{ fmtPlain(l.costo_max) }}</td>
                <td class="text-center">
                  <v-icon
                    v-if="l.somma === 'S'"
                    icon="mdi-check"
                    color="success"
                    size="14"
                  />
                  <span v-else class="text-disabled">—</span>
                </td>
              </tr>
            </tbody>
          </v-table>

          <div v-if="breakdown.surcharges.length" class="mt-3">
            <div class="text-caption font-weight-bold mb-2">
              {{ t("cargo.pricing.effective_surcharges") }}
            </div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>{{ t("cargo.col.code") }}</th>
                  <th class="text-right">{{ t("cargo.wcb.col_amount") }}</th>
                  <th>{{ t("cargo.col.currency") }}</th>
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
                  <td class="text-right">{{ fmtPlain(s.amount) }}</td>
                  <td>{{ s.valuta }}</td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-window-item>

        <!-- CARICO TAB — base + customer-side computation -->
        <v-window-item value="carico">
          <v-list density="compact" lines="two">
            <v-list-item>
              <v-list-item-title>{{
                t("cargo.pricing.chargeable_weight")
              }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ t("cargo.pricing.chargeable_weight_sub") }}
              </v-list-item-subtitle>
              <template #append>
                <span class="text-h6"
                  >{{ breakdown.base.peso_tassabile.toFixed(2) }} kg</span
                >
              </template>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>{{
                t("cargo.pricing.coefficient_vol")
              }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ t("cargo.pricing.coefficient_vol_sub") }}
              </v-list-item-subtitle>
              <template #append>
                <span class="text-h6">{{ breakdown.base.coeff_volm }}</span>
              </template>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>{{
                t("cargo.pricing.bracket")
              }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ t("cargo.pricing.bracket_sub") }}
              </v-list-item-subtitle>
              <template #append>
                <span class="text-h6">
                  {{ breakdown.base.scaglione_kg }} kg /
                  {{ breakdown.base.scaglione_pr }}%
                </span>
              </template>
            </v-list-item>
            <v-divider />
            <v-list-item v-if="breakdown.insurance">
              <v-list-item-title>{{
                t("cargo.accessori.insurance")
              }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ breakdown.insurance.perc.toFixed(2) }}% / min
                {{ breakdown.insurance.min }} {{ breakdown.insurance.valuta }}
              </v-list-item-subtitle>
              <template #append>
                <span class="text-h6">
                  {{ fmt(breakdown.insurance.amount) }}
                </span>
              </template>
            </v-list-item>
          </v-list>
        </v-window-item>

        <!-- CONVERSIONE TAB — currency chain -->
        <v-window-item value="conversione">
          <EmptyState
            v-if="!breakdown.currency_chain.length"
            icon="mdi-currency-eur"
            :title="t('cargo.pricing.single_currency')"
            :text="t('cargo.pricing.single_currency_text')"
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

        <!-- NOTE TAB — raw debug -->
        <v-window-item value="note">
          <p class="text-body-2 text-medium-emphasis">
            <code>debug_valori</code> {{ t("cargo.pricing.debug_note") }}
          </p>
          <pre class="bd-debug">{{
            debugValori || t("cargo.pricing.empty")
          }}</pre>
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
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import {
  cargoPricingService,
  type PricingBreakdown,
} from "@cargo/services/cargo_pricing.service";
import ModalWrapper from "../modals/ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const { cargo, id } = storeToRefs(cargoStore);

const breakdown = ref<PricingBreakdown | null>(null);
const loading = ref(false);
const tab = ref<"costo" | "carico" | "conversione" | "note">("costo");

const debugValori = computed(
  () =>
    (cargo.value as unknown as { debug_valori?: string } | null)
      ?.debug_valori ?? "",
);

const utileColorClass = computed(() => {
  const v = breakdown.value?.totals.utile_previsto ?? 0;
  if (v > 0) return "bd-pos";
  if (v < 0) return "bd-neg";
  return "";
});

async function load(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  try {
    breakdown.value = await cargoPricingService.breakdown(Number(id.value));
  } finally {
    loading.value = false;
  }
}

// Lazy-load when the modal opens.
watch(
  () => ui.activeModal,
  (n) => {
    if (n === "pricing_breakdown") {
      tab.value = "costo";
      void load();
    }
  },
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

function fmtPlain(v: number): string {
  if (v >= 9_999_999) return "∞";
  return v.toFixed(2);
}
</script>

<style scoped>
.bd-kpi {
  text-align: center;
  padding: 8px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-variant), 0.4);
}
.bd-kpi__lbl {
  font-size: 11px;
  opacity: 0.65;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.bd-kpi__val {
  font-size: 18px;
  font-weight: 700;
  margin-top: 2px;
  font-feature-settings: "tnum";
}
.bd-pos {
  color: rgb(var(--v-theme-success));
}
.bd-neg {
  color: rgb(var(--v-theme-error));
}
.is-included td {
  font-weight: 500;
}
.bd-debug {
  background: rgb(var(--v-theme-surface-variant), 0.3);
  padding: 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow: auto;
}
</style>
