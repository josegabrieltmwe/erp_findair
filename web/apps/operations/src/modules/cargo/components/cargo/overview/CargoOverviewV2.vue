<template>
  <div class="cols" :style="{ '--p': String(ui.splitterPct) }">
    <div class="col">
      <CargoIndirizziCard />
      <!-- Medidas (izq) y Accesorios (der) lado a lado: dos bloques compactos
           que juntos aprovechan el ancho mejor que apilados. -->
      <div class="pair-row">
        <CargoMisureCard />
        <CargoAccessoriCard />
      </div>
      <!-- Flags accesoriales del legacy (Pallet / Dang. goods / Dry Ice) +
           banner DGR/UNR. -->
      <CargoComplianceCard />
      <!-- CustomsIstruzioniCard eliminada: era un RESUMEN read-only (sdoganam
           E/I, dazi) redundante con el modal de Aduanas (CargoCustomsBox), que
           ya es editable y accesible desde la card de Accesorios. -->
      <CargoAzioniCard />
    </div>
    <Splitter />
    <div class="col">
      <CargoVoliCard />
      <CargoCostiCard />
      <CargoProfitCard />
      <!-- CargoOffersSummaryCard eliminada: la cotización (RFQ a vettori +
           oferta al cliente) es COMUNICACIÓN y vive ahora en el menú
           `CargoQuoteMenu` de la barra superior, junto a chat/documentos.
           La card gastaba una franja del Overview para dos cifras y dos
           accesos que el propio modal ya repetía. -->
      <CargoRelationsCard />
      <CargoVerificheCard />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from "@cargo/stores/ui.store";
import Splitter from "@cargo/components/shell/Splitter.vue";
import CargoIndirizziCard from "./CargoIndirizziCard.vue";
import CargoMisureCard from "./CargoMisureCard.vue";
import CargoAccessoriCard from "./CargoAccessoriCard.vue";
import CargoComplianceCard from "../accessori/CargoAccessoriCard.vue";
import CargoAzioniCard from "./CargoAzioniCard.vue";
import CargoVoliCard from "./CargoVoliCard.vue";
import CargoCostiCard from "./CargoCostiCard.vue";
import CargoVerificheCard from "./CargoVerificheCard.vue";
import CargoProfitCard from "../profit/CargoProfitCard.vue";
import CargoRelationsCard from "../relations/CargoRelationsCard.vue";

/**
 * Cargo overview V2 — same two-column layout as ShipmentOverviewV2 with
 * a resizable splitter. The right column carries an additional
 * CargoVoliCard (flight legs + MAWB) which is unique to air freight.
 */
const ui = useUiStore();
</script>

<style scoped>
/* Fila de dos bloques lado a lado (Medidas | Accesorios). En columna angosta
   cae a apilado. Cada card ocupa su celda a ancho completo. */
.pair-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  /* stretch: ambas cards (Medidas | Accesorios) igualan su altura a la más
     alta de la fila. */
  align-items: stretch;
}
.pair-row > * {
  min-width: 0;
}
@media (max-width: 760px) {
  .pair-row {
    grid-template-columns: 1fr;
  }
}
</style>
