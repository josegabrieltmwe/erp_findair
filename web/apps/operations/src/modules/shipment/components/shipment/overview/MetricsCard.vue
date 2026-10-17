<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-package-variant"
      :title="t('shipment.cards.misure.title')"
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

    <!-- Filas horizontales (icono + label a la izquierda, valor a la derecha),
         mismo componente (InfoRow) y estilo que la card Medidas del cargo
         (CargoMisureCard) y que su compañera Accesorios. Antes usaba tiles KPI
         verticales (KpiStat) que rompían la alineación con Accesorios. -->
    <div class="stat-grid">
      <InfoRow
        icon="mdi-package-variant-closed"
        :title="t('shipment.cards.misure.colli')"
        :value="colli"
        clickable
        @click="ui.openModal('colli')"
      />
      <InfoRow
        icon="mdi-weight-kilogram"
        :title="t('shipment.cards.misure.peso')"
        :value="`${pesoLabel} kg`"
        clickable
        @click="ui.openModal('colli')"
      />
      <InfoRow
        icon="mdi-weight"
        :title="t('shipment.cards.misure.tassabile')"
        :value="`${pesoTassatoLabel} kg`"
        clickable
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
import InfoRow from "@shipment/components/shell/InfoRow.vue";

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

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

const colli = computed<string>(() => String(num("colli")));
const pesoLabel = computed<string>(() => formatNum(num("peso")));
const pesoTassatoLabel = computed<string>(() => {
  const tassato = num("peso_tassato");
  return formatNum(tassato > 0 ? tassato : num("peso"));
});
</script>

<style scoped lang="scss">
/* La card se estira a la altura de Accesorios (pair-row align-items:stretch);
   flex-column permite que el bloque de filas ocupe todo el alto disponible.
   Paridad con CargoMisureCard. */
.card-tmwe {
  display: flex;
  flex-direction: column;
}
/* Filas (bultos/peso/tassabile) apiladas; se reparten el alto sobrante para que
   la card iguale la altura de Accesorios. */
.stat-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.stat-grid > * {
  flex: 1;
}
.stat-grid :deep(.inforow) {
  align-items: center;
}
/* Sin línea separadora entre filas (anula el separador global de mockup2). */
.stat-grid :deep(.inforow + .inforow) {
  border-top: 0;
}
</style>
