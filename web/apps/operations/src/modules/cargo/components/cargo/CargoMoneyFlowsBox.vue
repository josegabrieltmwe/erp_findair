<template>
  <v-card :border="!embedded" :flat="embedded" rounded="lg">
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-cash-multiple" size="18" class="me-2" />
      {{ t("cargo.money.title") }}
      <v-spacer />
      <v-btn
        size="x-small"
        variant="text"
        icon="mdi-currency-eur"
        :title="t('cargo.money.daily_exchange')"
        @click="ui.openModal('currency_day')"
      />
      <v-chip size="x-small" variant="tonal" :title="curr.name.value">
        {{ prefix }}
      </v-chip>
    </v-card-title>
    <v-divider v-if="!embedded" />

    <!-- Embedded (tab) mode: header lives in the modal frame, so surface just
         the currency chip + daily-exchange shortcut as a slim toolbar. -->
    <div v-if="embedded" class="d-flex align-center justify-end px-1 pb-2">
      <v-btn
        size="x-small"
        variant="text"
        icon="mdi-currency-eur"
        :title="t('cargo.money.daily_exchange')"
        @click="ui.openModal('currency_day')"
      />
      <v-chip size="x-small" variant="tonal" :title="curr.name.value">
        {{ prefix }}
      </v-chip>
    </div>

    <v-card-text :class="embedded ? 'pa-0' : ''">
      <!-- ── Group 1: what the client is charged ─────────────────────── -->
      <div class="mf-group__label">
        <v-icon
          icon="mdi-arrow-down-bold-circle-outline"
          size="14"
          class="me-1"
        />
        {{ t("cargo.money.group_charged") }}
      </div>
      <v-row dense class="mb-1">
        <v-col v-for="f in chargeFields" :key="f.key" cols="12" md="4">
          <v-text-field
            v-model="f.binding.local"
            :label="f.label"
            type="number"
            min="0"
            step="0.01"
            :prefix="prefix"
            :readonly="readonly(f.key)"
            @blur="f.binding.commit"
          >
            <template #append-inner>
              <FieldHistoryPopover
                :label="f.label"
                :fetcher="histFetcher(f.key)"
              />
            </template>
          </v-text-field>
          <p
            v-if="fieldHelp.helpText(f.key)"
            class="mf-help-text"
            :class="{ 'mf-help-text--open': expanded.has(f.key) }"
            role="button"
            tabindex="0"
            :title="t('cargo.money.help_toggle')"
            @click="toggleHelp(f.key)"
            @keydown.enter.prevent="toggleHelp(f.key)"
          >
            {{ fieldHelp.helpText(f.key) }}
          </p>
        </v-col>
      </v-row>

      <!-- ── Group 2: what the supplier costs us ─────────────────────── -->
      <div class="mf-group__label mt-3">
        <v-icon
          icon="mdi-arrow-up-bold-circle-outline"
          size="14"
          class="me-1"
        />
        {{ t("cargo.money.group_cost") }}
      </div>
      <v-row dense>
        <v-col v-for="f in costFields" :key="f.key" cols="12" md="6">
          <v-text-field
            v-model="f.binding.local"
            :label="f.label"
            type="number"
            min="0"
            step="0.01"
            :prefix="prefix"
            :readonly="readonly(f.key)"
            @blur="f.binding.commit"
          >
            <template #append-inner>
              <FieldHistoryPopover
                :label="f.label"
                :fetcher="histFetcher(f.key)"
              />
            </template>
          </v-text-field>
          <p
            v-if="fieldHelp.helpText(f.key)"
            class="mf-help-text"
            :class="{ 'mf-help-text--open': expanded.has(f.key) }"
            role="button"
            tabindex="0"
            :title="t('cargo.money.help_toggle')"
            @click="toggleHelp(f.key)"
            @keydown.enter.prevent="toggleHelp(f.key)"
          >
            {{ fieldHelp.helpText(f.key) }}
          </p>
        </v-col>
      </v-row>

      <!-- ── Result: two calm stat tiles instead of loose text ───────── -->
      <div class="mf-stats mt-4">
        <div class="mf-stat">
          <div class="mf-stat__label">{{ t("cargo.money.total_charged") }}</div>
          <div class="mf-stat__value">
            {{ prefix }} {{ formatMoney(totalCharged) }}
          </div>
        </div>
        <div
          class="mf-stat"
          :class="margin >= 0 ? 'mf-stat--pos' : 'mf-stat--neg'"
        >
          <div class="mf-stat__label">{{ t("cargo.money.margin") }}</div>
          <div class="mf-stat__value">
            {{ prefix }} {{ formatMoney(margin) }}
            <span class="mf-stat__pct">({{ marginPct.toFixed(1) }}%)</span>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import { useTargetCurrency } from "@cargo/composables/useTargetCurrency";
import { useMoneyFieldBinding } from "@cargo/composables/useMoneyFieldBinding";
import { cargoAuditService } from "@cargo/services/cargo_pricing.service";
import { useFieldHelp } from "@cargo/composables/useFieldHelp";
import FieldHistoryPopover from "@shared/detail/FieldHistoryPopover.vue";

withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });

const { t } = useI18n();
const store = useCargoStore();
const ui = useUiStore();
const { cargo } = storeToRefs(store);
const { readonly } = useCargoState(cargo);

// Per-field modification history (legacy log_modifiche / ShowLogMod).
const histFetcher = (campo: string) => () =>
  cargoAuditService.fieldHistory(Number(cargo.value?.id ?? 0), campo);

// Per-field help (legacy itxt.php). Loaded once; the explanations are shown
// inline under each field (clamped to 2 lines), and click/Enter expands the
// full text — so the guidance stays visible without walling off the layout.
const fieldHelp = useFieldHelp();
onMounted(() => {
  void fieldHelp.load();
});

const expanded = ref<Set<string>>(new Set());
function toggleHelp(key: string): void {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
}

// Target currency layer: amounts are stored in EUR but shown/entered in the
// client's target currency (legacy parity). The chip + prefix reflect it.
const curr = useTargetCurrency();
const sigla = () => curr.sigla.value;
const prefix = computed(() => curr.sigla.value || "EUR");

const caricoExport = useMoneyFieldBinding(
  "carico_export",
  curr.toDisplay,
  sigla,
);
const caricoImport = useMoneyFieldBinding(
  "carico_import",
  curr.toDisplay,
  sigla,
);
const caricoVolo = useMoneyFieldBinding("carico_volo", curr.toDisplay, sigla);
const costoPrevisto = useMoneyFieldBinding(
  "costo_volo_previsto",
  curr.toDisplay,
  sigla,
);
const costoReale = useMoneyFieldBinding(
  "costo_volo_reale",
  curr.toDisplay,
  sigla,
);

// Fields grouped by meaning so the template renders two labelled sections
// (charged to client vs supplier cost) with a single v-for each.
const chargeFields = computed(() => [
  {
    key: "carico_export",
    label: t("cargo.money.export_charge"),
    binding: caricoExport,
  },
  {
    key: "carico_import",
    label: t("cargo.money.import_charge"),
    binding: caricoImport,
  },
  {
    key: "carico_volo",
    label: t("cargo.money.flight_charge"),
    binding: caricoVolo,
  },
]);
const costFields = computed(() => [
  {
    key: "costo_volo_previsto",
    label: t("cargo.money.forecast_cost"),
    binding: costoPrevisto,
  },
  {
    key: "costo_volo_reale",
    label: t("cargo.money.real_cost"),
    binding: costoReale,
  },
]);

// Totals computed in display (target) currency from the stored EUR values.
const totalCharged = computed(() => {
  const e = curr.toDisplay(cargo.value?.carico_export ?? 0);
  const i = curr.toDisplay(cargo.value?.carico_import ?? 0);
  const v = curr.toDisplay(cargo.value?.carico_volo ?? 0);
  return e + i + v;
});

const margin = computed(() => {
  const real = curr.toDisplay(cargo.value?.costo_volo_reale ?? 0);
  const forecast = curr.toDisplay(cargo.value?.costo_volo_previsto ?? 0);
  const cost = real > 0 ? real : forecast;
  return totalCharged.value - cost;
});

const marginPct = computed(() => {
  if (totalCharged.value === 0) return 0;
  return (margin.value / totalCharged.value) * 100;
});

function formatMoney(v: number): string {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
</script>

<style scoped>
/* Section labels group the fields conceptually (charged vs cost) so the
   panel reads as two short lists instead of five loose inputs. */
.mf-group__label {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 6px;
}

/* Inline help kept visible (the explanations are needed) but contained:
   clamped to 2 lines so it never walls off the grid, and click/Enter
   expands the full text. */
.mf-help-text {
  margin: 4px 4px 0;
  font-size: 11px;
  line-height: 1.35;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color 0.12s ease;
}
.mf-help-text::before {
  /* Small info glyph so it reads as guidance, not a data value. */
  content: "ⓘ";
  margin-right: 4px;
  opacity: 0.7;
}
.mf-help-text:hover,
.mf-help-text:focus-visible {
  color: rgb(var(--v-theme-on-surface));
  outline: none;
}
.mf-help-text--open {
  -webkit-line-clamp: unset;
  overflow: visible;
}

/* Result tiles — total charged + margin as two calm cards, clearly set
   apart from the editable fields above. */
.mf-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.mf-stat {
  border-radius: 10px;
  padding: 10px 14px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.mf-stat__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 2px;
}
.mf-stat__value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
}
.mf-stat__pct {
  font-size: 14px;
  font-weight: 500;
}
/* Margin tile takes a success/error tint on its value + a matching edge. */
.mf-stat--pos {
  background: rgba(var(--v-theme-success), 0.08);
  border-color: rgba(var(--v-theme-success), 0.35);
}
.mf-stat--pos .mf-stat__value {
  color: rgb(var(--v-theme-success));
}
.mf-stat--neg {
  background: rgba(var(--v-theme-error), 0.08);
  border-color: rgba(var(--v-theme-error), 0.35);
}
.mf-stat--neg .mf-stat__value {
  color: rgb(var(--v-theme-error));
}

@media (max-width: 600px) {
  .mf-stats {
    grid-template-columns: 1fr;
  }
}
</style>
