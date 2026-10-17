<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-tag-multiple-outline"
      :title="t('shipment.cards.accessori.title')"
    />
    <!-- Solo Seguro y Aduana: COD, proforma y suplementos se movieron a la card
         "COD y suplementos" (AddebitiCard). -->
    <div class="acc-grid">
      <InfoRow
        icon="mdi-shield-check-outline"
        :title="t('shipment.cards.accessori.insurance')"
        :value="insValue"
        clickable
        @click="ui.openModal('insurance')"
      />
      <InfoRow
        icon="mdi-file-document-outline"
        :title="t('shipment.cards.accessori.customs')"
        :value="customsValue"
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
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import { formatMoney } from "@shipment/utils/currency";
import CardHeader from "@shipment/components/shell/CardHeader.vue";
import InfoRow from "@shipment/components/shell/InfoRow.vue";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const ui = useUiStore();

function get<T = string>(field: string): T | undefined {
  return (shipment.value as unknown as Record<string, T> | null)?.[field];
}

// `id_valuta_*` es un FK int a valute.id (p.ej. 1=EUR), NO una sigla ISO. El
// backend ya resuelve la sigla en un campo aparte (contras_valuta / dogana_valuta;
// para el seguro la propia columna id_valuta_assic ya es la sigla varchar). Usar
// el id crudo hacía que formatEur('1') imprimiera "1 0,00" en vez de "€ 0,00".
// resolveCurrency prefiere la sigla resuelta y descarta cualquier valor numérico
// que se cuele (id sin resolver) → fallback EUR.
function resolveCurrency(resolvedField: string, rawField: string): string {
  const resolved = get(resolvedField);
  if (resolved && !/^\d+$/.test(String(resolved))) return String(resolved);
  const raw = get(rawField);
  if (raw && !/^\d+$/.test(String(raw))) return String(raw);
  return "EUR";
}

const insImp = computed<number>(() => Number(get("assicuraz_imp") ?? 0));
const insCurrency = computed<string>(() =>
  resolveCurrency("assic_valuta", "id_valuta_assic"),
);
const insValue = computed<string>(() =>
  insImp.value > 0 ? formatEur(insImp.value, insCurrency.value) : "—",
);

const customsValue = computed<string>(() => {
  const v = Number(get("dogana_imp") ?? 0);
  const cur = resolveCurrency("dogana_valuta", "id_valuta_dogana");
  return v > 0 ? formatEur(v, cur) : "—";
});

// Shared money formatter (single source of truth) — alias kept for the template.
const formatEur = formatMoney;
</script>

<style scoped lang="scss">
/* COD / insurance / customs / proforma packed 2×2: short values sit next to
   their label instead of floating across a full-width row. */
.acc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 4px;
}
/* Collapse to one column when the card itself is narrow. */
.card-tmwe {
  container-type: inline-size;
}
@container (max-width: 440px) {
  .acc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
