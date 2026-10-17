<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-currency-eur"
      :title="t('cargo.costi.title')"
      editable
      alt
      @edit="ui.openModal('costi')"
    />

    <div class="stat-grid">
      <KpiStat
        icon="mdi-cash-multiple"
        :caption="t('cargo.costi.charge')"
        :value="caricoTotal"
        :unit="currency"
        @click="ui.openModal('costi')"
      />
      <KpiStat
        icon="mdi-receipt"
        :caption="t('cargo.costi.flight_cost')"
        :value="costoVoloLabel"
        :unit="currency"
        @click="ui.openModal('costi')"
      />
      <!--
        El margen abre su propia explicación, no el modal de edición: es el
        KPI sobre el que más se pregunta "¿de dónde sale este número?", y el
        mismo envío puede mostrar dos porcentajes distintos según la pantalla.
      -->
      <KpiStat
        icon="mdi-trending-up"
        :caption="t('cargo.costi.margin')"
        :value="marginLabel"
        :variant="marginVariant"
        @click="explainOpen = true"
      />
    </div>

    <details class="cost-breakdown">
      <summary class="text-caption text-medium-emphasis">
        {{ t("cargo.costi.loads_detail") }}
      </summary>
      <div class="cb-rows">
        <div class="cb-row">
          <span>{{ t("cargo.costi.export") }}</span>
          <span>{{ fmt(cargo?.carico_export) }}</span>
        </div>
        <div class="cb-row">
          <span>{{ t("cargo.costi.import") }}</span>
          <span>{{ fmt(cargo?.carico_import) }}</span>
        </div>
        <div class="cb-row">
          <span>{{ t("cargo.costi.flight") }}</span>
          <span>{{ fmt(cargo?.carico_volo) }}</span>
        </div>
        <div v-if="Number(cargo?.carico_extra ?? 0) > 0" class="cb-row">
          <span>{{ t("cargo.costi.extra") }}</span>
          <span>{{ fmt(cargo?.carico_extra) }}</span>
        </div>
      </div>
    </details>

    <div class="cost-actions">
      <!-- Post-fatturazione (legacy pfattz box): only relevant once a first
           invoice exists. Holds carico_extra + postfatt_txt. -->
      <v-btn
        v-if="showPostInvoice"
        size="small"
        variant="tonal"
        color="warning"
        prepend-icon="mdi-receipt-text-edit-outline"
        @click="ui.openModal('post_invoice')"
      >
        {{ t("cargo.costi.post_invoice") }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-calculator"
        @click="ui.openModal('pricing_breakdown')"
      >
        {{ t("cargo.costi.pricing_details") }}
      </v-btn>
      <!-- Cómo se llega al precio y al %, no sólo cuánto suma cada línea. -->
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-help-circle-outline"
        @click="explainOpen = true"
      >
        {{ t("cargo.margin_explain.button") }}
      </v-btn>
    </div>

    <MarginExplainDialog v-model="explainOpen" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import KpiStat from "@cargo/components/shell/KpiStat.vue";
import MarginExplainDialog from "@cargo/components/cargo/pricing/MarginExplainDialog.vue";

/** Diálogo "de dónde sale este %". Local a la tarjeta: no es un modal de la
    ficha (ui.openModal), sólo una explicación de este KPI. */
const explainOpen = ref(false);

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const ui = useUiStore();

const currency = computed<string>(
  () => (cargo.value?.id_valuta_cliente as string | undefined) || "EUR",
);

// Post-invoice flow applies once a first client invoice is issued, or when a
// post-invoice extra/note already exists (so it stays reachable to edit/clear).
const showPostInvoice = computed<boolean>(
  () =>
    Number(cargo.value?.id_fattura_a ?? 0) > 0 ||
    Number(cargo.value?.id_fattura_a2 ?? 0) > 0 ||
    Number(cargo.value?.carico_extra ?? 0) > 0 ||
    (cargo.value?.postfatt_txt ?? "") !== "",
);

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}
function fmt(v: unknown): string {
  return `${currency.value} ${n(v).toFixed(2).replace(".", ",")}`;
}

const caricoTotal = computed<string>(() => {
  const total =
    n(cargo.value?.carico_export) +
    n(cargo.value?.carico_import) +
    n(cargo.value?.carico_volo) +
    n(cargo.value?.carico_extra);
  return total.toFixed(2);
});

const costoVoloLabel = computed<string>(() => {
  const real = n(cargo.value?.costo_volo_reale);
  const prev = n(cargo.value?.costo_volo_previsto);
  return (real > 0 ? real : prev).toFixed(2);
});

const marginLabel = computed<string>(() => {
  const totalIn =
    n(cargo.value?.carico_export) +
    n(cargo.value?.carico_import) +
    n(cargo.value?.carico_volo) +
    n(cargo.value?.carico_extra);
  const totalOut =
    n(cargo.value?.costo_volo_reale) || n(cargo.value?.costo_volo_previsto);
  if (totalIn === 0) return "—";
  const margin = totalIn - totalOut;
  const pct = (margin / totalIn) * 100;
  return `${pct.toFixed(1)}%`;
});

const marginVariant = computed<"default" | "success" | "warning" | "error">(
  () => {
    const totalIn =
      n(cargo.value?.carico_export) +
      n(cargo.value?.carico_import) +
      n(cargo.value?.carico_volo) +
      n(cargo.value?.carico_extra);
    const totalOut =
      n(cargo.value?.costo_volo_reale) || n(cargo.value?.costo_volo_previsto);
    if (totalIn === 0) return "default";
    const pct = ((totalIn - totalOut) / totalIn) * 100;
    if (pct >= 15) return "success";
    if (pct >= 5) return "warning";
    return "error";
  },
);
</script>

<style scoped lang="scss">
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.cost-breakdown {
  margin-top: 8px;
  padding: 4px 8px;
}
.cb-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  font-size: 12px;
}
.cb-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.cost-actions {
  padding: 8px 12px 4px;
  display: flex;
  justify-content: flex-end;
}
</style>
