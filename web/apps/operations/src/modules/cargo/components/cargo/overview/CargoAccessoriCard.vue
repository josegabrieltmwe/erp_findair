<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-tag-multiple-outline"
      :title="t('cargo.accessori.title')"
    />

    <!-- Grilla 2 columnas para aprovechar el ancho (antes las 3 filas se
         apilaban en 1 columna dejando espacio muerto a la derecha). El bloque
         de aduana ocupa fila completa por su subtítulo (descripción larga). -->
    <div class="accessori-grid">
      <InfoRow
        icon="mdi-shield-check-outline"
        :title="t('cargo.accessori.insurance')"
        :value="insLabel"
        clickable
        @click="ui.openModal('insurance')"
      />
      <!-- Aduana: una sola fila (antes "Export/Import" y "Aduana" abrían el
           MISMO modal customs). El modal ya contiene los bloques EXPORT/IMPORT
           y el detalle export/import va en el subtítulo. -->
      <InfoRow
        class="accessori-grid__full"
        icon="mdi-file-document-outline"
        :title="t('cargo.accessori.customs')"
        :subtitle="customsSubtitle"
        :value="customsLabel"
        clickable
        @click="ui.openModal('customs')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import InfoRow from "@cargo/components/shell/InfoRow.vue";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const ui = useUiStore();

function fmtMoney(v: unknown, cur: string): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n === 0) return `${cur} 0,00`;
  const fixed = n.toFixed(2).replace(".", ",");
  return cur === "EUR" ? `€ ${fixed}` : `${cur} ${fixed}`;
}

const insLabel = computed<string>(() => {
  const v = cargo.value?.assicuraz_imp;
  const cur = (cargo.value?.id_valuta_assic as string | undefined) || "EUR";
  return fmtMoney(v, cur);
});

const customsLabel = computed<string>(() => {
  const v = Number(cargo.value?.dogana_imp ?? 0);
  const cur = (cargo.value?.id_valuta_dogana as string | undefined) || "EUR";
  return v > 0 ? fmtMoney(v, cur) : "—";
});
const customsSubtitle = computed<string>(() => {
  const desc = cargo.value?.dogana_descri || cargo.value?.contenuto;
  return desc ? String(desc).slice(0, 60) : "";
});
</script>

<style scoped lang="scss">
/* Grilla 2 columnas — aprovecha el ancho de la card (antes 1 columna dejaba
   espacio muerto). El bloque de aduana (subtítulo largo) ocupa fila completa. */
/* Filas apiladas: la card ahora vive a media anchura (junto a Medidas), así que
   una sola columna es lo legible; con `auto-fit` se reparte en 2 solo si hay
   ancho de sobra (p.ej. si el splitter da mucho espacio a la izquierda). */
.accessori-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 6px;
}
.accessori-grid__full {
  grid-column: 1 / -1;
}
/* Sin línea separadora entre filas (anula el separador global de mockup2). */
.accessori-grid :deep(.inforow + .inforow) {
  border-top: 0;
}
</style>
