<template>
  <div class="cols" :style="{ '--p': String(ui.splitterPct) }">
    <div class="col">
      <IndirizziCard />
      <!-- Medidas (izq) y Accesorios (der) lado a lado: dos bloques compactos
           que juntos aprovechan el ancho mejor que apilados. Paridad con el
           overview de cargo (CargoOverviewV2 .pair-row). -->
      <div class="pair-row">
        <MetricsCard />
        <AccessoriCard />
      </div>
      <!-- COD, factura proforma y suplementos en card independiente. -->
      <AddebitiCard />
      <NoteCard />
      <MetadatiCard />
    </div>
    <Splitter />
    <div class="col">
      <ServizioCard />
      <CostiCard />
      <ShipmentRelationsCard />
      <VerificheCard />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from "@shipment/stores/ui.store";
import Splitter from "@shipment/components/shell/Splitter.vue";
import IndirizziCard from "./IndirizziCard.vue";
import MetricsCard from "./MetricsCard.vue";
import AccessoriCard from "./AccessoriCard.vue";
import AddebitiCard from "./AddebitiCard.vue";
import NoteCard from "./NoteCard.vue";
import MetadatiCard from "./MetadatiCard.vue";
import ServizioCard from "./ServizioCard.vue";
import CostiCard from "./CostiCard.vue";
import VerificheCard from "./VerificheCard.vue";
import ShipmentRelationsCard from "../relations/ShipmentRelationsCard.vue";

/**
 * Overview panel v2 — 2 column grid with a resizable splitter between
 * them. Left column carries the entity-management cards (indirizzi /
 * misure / accessori); right column carries the commercial cards
 * (servizio / costi / verifiche). The grid template is owned by
 * mockup2.scss (.cols), and the splitter percentage drives the
 * `--p` CSS variable consumed by the grid template.
 */
const ui = useUiStore();
</script>

<style scoped>
/* Fila de dos bloques lado a lado (Medidas | Accesorios). En columna angosta
   cae a apilado. Cada card ocupa su celda a ancho completo. Paridad con
   CargoOverviewV2. */
.pair-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
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
