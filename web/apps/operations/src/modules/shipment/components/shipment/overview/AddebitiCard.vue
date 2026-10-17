<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-cash-multiple"
      :title="t('shipment.cards.addebiti.title')"
    />

    <div class="add-grid">
      <InfoRow
        icon="mdi-currency-eur"
        :title="t('shipment.cards.accessori.cod')"
        :value="codValue"
        clickable
        @click="ui.openModal('cod')"
      />
      <InfoRow
        icon="mdi-file-document-multiple-outline"
        :title="t('shipment.cards.accessori.proforma')"
        :value="proformaValue"
        clickable
        @click="ui.openModal('proforma')"
      />
    </div>

    <!-- Suplementos a ancho completo: lleva subtítulo (nombres activos). -->
    <InfoRow
      icon="mdi-tag-plus-outline"
      :title="t('shipment.cards.accessori.supplements')"
      :value="supplementsLabel"
      :subtitle="supplementsSubtitle"
      clickable
      @click="ui.openModal('supplements')"
    />

    <!-- Banner UNR: solo se revela cuando hay un suplemento DGR/relacionado
         activo que amerita el número UN. NO reemplaza el flag DGR; ofrece la
         gestión estructurada de las sustancias (número UN, clase, PG, régimen
         LQ). Se persiste aparte, en spedizioni_dgr, vía DgrDeclarationDialog. -->
    <v-alert
      v-if="dgrUnrActive"
      type="warning"
      variant="tonal"
      density="compact"
      icon="mdi-hazard-lights"
      class="mt-2 dgr-banner"
    >
      <div class="d-flex align-center flex-wrap ga-2">
        <span class="flex-grow-1">{{ t("shipment.dgr.banner") }}</span>
        <v-btn
          size="small"
          variant="flat"
          color="warning"
          prepend-icon="mdi-clipboard-edit-outline"
          @click="ui.openModal('dgr')"
        >
          {{ t("shipment.dgr.manage") }}
        </v-btn>
      </div>
    </v-alert>
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
const { shipment, supplements } = storeToRefs(store);
const ui = useUiStore();

function get<T = string>(field: string): T | undefined {
  return (shipment.value as unknown as Record<string, T> | null)?.[field];
}

// `id_valuta_*` es un FK int a valute.id (p.ej. 1=EUR), NO una sigla ISO. El
// backend ya resuelve la sigla en un campo aparte (contras_valuta; para el
// seguro id_valuta_assic ya es la sigla varchar). Usar el id crudo hacía que
// formatEur('1') imprimiera "1 0,00" en vez de "€ 0,00". resolveCurrency
// prefiere la sigla resuelta y descarta cualquier valor numérico (id sin
// resolver) → fallback EUR.
function resolveCurrency(resolvedField: string, rawField: string): string {
  const resolved = get(resolvedField);
  if (resolved && !/^\d+$/.test(String(resolved))) return String(resolved);
  const raw = get(rawField);
  if (raw && !/^\d+$/.test(String(raw))) return String(raw);
  return "EUR";
}

const codImp = computed<number>(() => Number(get("contras_imp") ?? 0));
const codCurrency = computed<string>(() =>
  resolveCurrency("contras_valuta", "id_valuta_contras"),
);
// COD sin importe → "—"; no mostrar "€ 0,00" que insinúa un contrassegno
// inexistente.
const codValue = computed<string>(() =>
  codImp.value > 0 ? formatEur(codImp.value, codCurrency.value) : "—",
);

// Proforma — backend hydrates `proforma_items_count` on the shipment payload
// (Spedizioni::get_by_id_full join). If absent we show "Modifica" instead of a
// fake "0 items" to avoid implying it's been checked.
const proformaValue = computed<string>(() => {
  const raw = get<string | number>("proforma_items_count");
  const n = raw != null ? Number(raw) : null;
  if (n == null || Number.isNaN(n))
    return t("shipment.cards.accessori.proforma_edit");
  if (n === 0) return t("shipment.cards.accessori.proforma_empty");
  return t("shipment.cards.accessori.proforma_rows", { n }, n);
});

const activeSupplements = computed(() => {
  return (supplements.value ?? []).filter(
    (s) => s.attivo === "S" && s.delta !== "S",
  );
});

// Suplementos que ameritan datos UNR (número UN + clase/PG). Cuando alguno está
// activo, se REVELA el acceso a la declaración DGR — sin reemplazar el flag
// booleano DGR. Cubre: ADR (6/7/138), DGR (94/95/141), baterías litio
// (124/139) y dry ice (14). Ids del catálogo `supplementi`.
const DGR_UNR_SUPPLEMENT_IDS = new Set([6, 7, 14, 94, 95, 124, 138, 139, 141]);

const dgrUnrActive = computed<boolean>(() =>
  (supplements.value ?? []).some(
    (s) =>
      s.attivo === "S" && DGR_UNR_SUPPLEMENT_IDS.has(Number(s.id_supplementi)),
  ),
);

const supplementsLabel = computed<string>(() => {
  const n = activeSupplements.value.length;
  if (n === 0) return "—";
  return t("shipment.cards.accessori.supplements_active", { n }, n);
});

const supplementsSubtitle = computed<string>(() => {
  const names = activeSupplements.value
    .map(
      (s) =>
        s.descrizione ||
        t("shipment.cards.accessori.supplements_fallback", {
          id: s.id_supplementi,
        }),
    )
    .slice(0, 3)
    .join(", ");
  const more = activeSupplements.value.length - 3;
  return more > 0 ? `${names} +${more}` : names;
});

// Shared money formatter (single source of truth) — alias kept for the template.
const formatEur = formatMoney;
</script>

<style scoped lang="scss">
/* COD / proforma packed 2×2: short values sit next to their label instead of
   floating across a full-width row. */
.add-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 4px;
}
.card-tmwe {
  container-type: inline-size;
}
@container (max-width: 440px) {
  .add-grid {
    grid-template-columns: 1fr;
  }
}
</style>
