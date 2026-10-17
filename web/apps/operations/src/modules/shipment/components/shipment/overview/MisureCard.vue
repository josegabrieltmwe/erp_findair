<template>
  <section class="card-tmwe card-tmwe--alt">
    <CardHeader
      icon="mdi-package-variant"
      :title="t('shipment.cards.misure.title')"
      editable
      alt
      @edit="ui.openModal('colli')"
    >
      <template #actions>
        <v-btn
          icon="mdi-scale"
          variant="text"
          size="x-small"
          density="comfortable"
          :title="t('shipment.cards.misure.wifi_scale')"
          @click="ui.openModal('wifi_scale')"
        />
        <v-btn
          icon="mdi-pencil-outline"
          variant="text"
          size="x-small"
          density="comfortable"
          :title="t('shipment.cards.misure.edit_colli')"
          @click="ui.openModal('colli')"
        />
      </template>
    </CardHeader>
    <div class="stats">
      <KpiStat
        icon="mdi-package-variant"
        :caption="t('shipment.cards.misure.colli')"
        :value="colli"
        @click="ui.openModal('colli')"
      />
      <KpiStat
        icon="mdi-scale"
        :caption="t('shipment.cards.misure.peso')"
        :value="formatNum(peso)"
        unit="kg"
        @click="ui.openModal('colli')"
      />
      <KpiStat
        icon="mdi-weight"
        :caption="t('shipment.cards.misure.tassabile')"
        :value="formatNum(pesoTassato)"
        unit="kg"
        @click="ui.openModal('colli')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import CardHeader from "@shipment/components/shell/CardHeader.vue";
import KpiStat from "@shipment/components/shell/KpiStat.vue";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const ui = useUiStore();

function num(field: string): number {
  const v = (shipment.value as unknown as Record<string, unknown> | null)?.[
    field
  ];
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const colli = computed<number>(() => num("colli"));
const peso = computed<number>(() => num("peso"));
const pesoTassato = computed<number>(() => {
  const t = num("peso_tassato");
  return t > 0 ? t : num("peso");
});

function formatNum(n: number): string {
  // Italian style: comma decimal, 1 decimal if not integer.
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
</script>
