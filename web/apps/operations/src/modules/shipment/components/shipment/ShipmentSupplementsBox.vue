<template>
  <!-- When embedded in a modal/tab, ModalWrapper already provides the dialog
       card + title, so we render plain and only keep an action bar. -->
  <component
    :is="embedded ? 'div' : VCard"
    v-bind="
      embedded
        ? {}
        : {
            border: true,
            rounded: 'lg',
            density: 'compact',
            class: 'box-compact',
          }
    "
  >
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-2"
    >
      <v-icon icon="mdi-plus-circle-multiple-outline" class="me-2" size="18" />
      {{ t("shipment.modals.supplements.client_title") }}
      <v-badge :content="activeCount" color="primary" inline class="ms-2" />
      <v-card-subtitle class="pa-0 ms-2 text-caption text-medium-emphasis">
        {{ t("shipment.modals.supplements.client_sub") }}
      </v-card-subtitle>
      <v-spacer />
      <!-- No Save button: toggling a supplement persists on the spot
           (see toggleAt), price edits persist debounced. -->
      <!-- Reserved slot: the spinner fades in place instead of being inserted
           into the flow, so the toolbar does not shift on every autosave. -->
      <span
        class="save-indicator"
        :class="{ 'save-indicator--on': store.saving }"
      >
        <v-progress-circular
          indeterminate
          size="16"
          width="2"
          color="primary"
        />
      </span>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-plus"
        @click="addDialog = true"
      >
        {{ t("shipment.modals.supplements.add") }}
      </v-btn>
    </v-card-title>
    <!-- Embedded: compact action bar (the modal title carries the heading). -->
    <div v-else class="d-flex align-center mb-2">
      <span class="text-caption text-medium-emphasis">{{
        t("shipment.modals.supplements.client_sub")
      }}</span>
      <v-spacer />
      <!-- Reserved slot: the spinner fades in place instead of being inserted
           into the flow, so the toolbar does not shift on every autosave. -->
      <span
        class="save-indicator"
        :class="{ 'save-indicator--on': store.saving }"
      >
        <v-progress-circular
          indeterminate
          size="16"
          width="2"
          color="primary"
        />
      </span>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-plus"
        @click="addDialog = true"
      >
        {{ t("shipment.modals.supplements.add") }}
      </v-btn>
    </div>
    <v-divider v-if="!embedded" />

    <ShipmentAddSupplementDialog v-model="addDialog" mode="client" />

    <!-- Save feedback: a 2px bar pinned over the top edge of the table. It is
         always in the DOM (only its opacity changes), so it never reflows the
         content below — the point is to signal the autosave without the page
         moving under the pointer. -->
    <div class="suppl-progress">
      <v-progress-linear
        :active="store.saving"
        indeterminate
        height="2"
        color="primary"
      />
    </div>

    <v-data-table
      :headers="headers"
      :items="clientSupplements"
      :items-per-page="-1"
      hide-default-footer
      density="compact"
    >
      <template #item.attivo="{ item, index }">
        <v-switch
          :model-value="item.attivo === 'S'"
          :disabled="item.supplierOnly"
          color="success"
          hide-details
          density="compact"
          @update:model-value="(v: any) => toggleAt(index, !!v)"
        />
      </template>
      <template #item.descrizione="{ item }">
        <div class="text-body-2 d-flex align-center">
          {{
            item.descrizione ||
            t("shipment.modals.supplements.suppl_n", {
              id: item.id_supplementi,
            })
          }}
          <v-tooltip v-if="item.supplierOnly" location="top" max-width="320">
            <template #activator="{ props: tipProps }">
              <v-chip
                v-bind="tipProps"
                size="x-small"
                variant="tonal"
                color="warning"
                class="ms-2"
              >
                {{ t("shipment.modals.supplements.supplier_only_badge") }}
              </v-chip>
            </template>
            {{ t("shipment.modals.supplements.supplier_only_tooltip") }}
          </v-tooltip>
        </div>
      </template>
      <!-- Un suplemento, DOS precios: lo que cuesta (fornitore) y lo que se
           cobra (cliente). Ambos viven en la misma fila de spedizioni_suppl
           (fix_priceF / fix_priceC), como en el panel "P" del legacy. -->
      <template #item.fix_priceF="{ item, index }">
        <v-text-field
          :model-value="item.fix_priceF ?? ''"
          :disabled="item.supplierOnly"
          type="number"
          min="0"
          step="0.01"
          density="compact"
          variant="plain"
          hide-details
          prefix="€"
          :placeholder="t('shipment.modals.supplements.auto')"
          style="max-width: 110px"
          @blur="(e: any) => updatePriceAt(index, e.target.value, 'F')"
        />
      </template>
      <template #item.fix_priceC="{ item, index }">
        <v-text-field
          :model-value="item.fix_priceC ?? ''"
          :disabled="item.supplierOnly"
          type="number"
          min="0"
          step="0.01"
          density="compact"
          variant="plain"
          hide-details
          prefix="€"
          :placeholder="t('shipment.modals.supplements.auto')"
          style="max-width: 110px"
          @blur="(e: any) => updatePriceAt(index, e.target.value, 'C')"
        />
      </template>
      <!-- Margen: sólo informativo, y sólo cuando ambos importes existen. -->
      <template #item.margine="{ item }">
        <span
          v-if="marginOf(item) !== null"
          class="text-caption"
          :class="marginOf(item)! < 0 ? 'text-error' : 'text-medium-emphasis'"
        >
          {{ formatMargin(marginOf(item)!) }}
        </span>
      </template>
      <template #item.breakdown="{ item }">
        <SupplementPriceBreakdown :supplement-id="item.id_supplementi" />
      </template>
      <template #item.recalc="{ item }">
        <v-btn
          v-if="!item.supplierOnly"
          icon="mdi-calculator-variant-outline"
          size="x-small"
          variant="text"
          :loading="recalcLoading === item.id_supplementi"
          :title="t('shipment.modals.supplements.recompute')"
          @click="recalc(item)"
        />
      </template>
      <template #no-data>
        <EmptyState
          icon="mdi-plus-circle-outline"
          :title="t('shipment.modals.supplements.none_title')"
          :text="t('shipment.modals.supplements.none_client_text')"
        />
      </template>
    </v-data-table>
  </component>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { VCard } from "vuetify/components";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import { supplementsService } from "@shipment/services/supplements.service";
import { formatMoney } from "@shipment/utils/currency";
import ShipmentAddSupplementDialog from "./ShipmentAddSupplementDialog.vue";
import SupplementPriceBreakdown from "./SupplementPriceBreakdown.vue";
import type { ShipmentSupplement } from "@shipment/services/shipment.types";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const toasts = useToastStore();
const { supplements } = storeToRefs(store);

const addDialog = ref(false);
const recalcLoading = ref<number | string | null>(null);

const headers = computed(() => [
  {
    title: t("shipment.modals.supplements.col_active"),
    key: "attivo",
    width: 80,
    sortable: false,
  },
  {
    title: t("shipment.modals.supplements.col_description"),
    key: "descrizione",
  },
  {
    title: t("shipment.modals.supplements.col_cost"),
    key: "fix_priceF",
    width: 130,
    sortable: false,
    align: "end" as const,
  },
  {
    title: t("shipment.modals.supplements.col_price"),
    key: "fix_priceC",
    width: 130,
    sortable: false,
    align: "end" as const,
  },
  {
    title: t("shipment.modals.supplements.col_margin"),
    key: "margine",
    width: 90,
    sortable: false,
    align: "end" as const,
  },
  { title: "", key: "breakdown", width: 40, sortable: false },
  { title: "", key: "recalc", width: 40, sortable: false },
]);

/** Margen = precio cliente − coste. Null si falta alguno de los dos. */
function marginOf(item: ShipmentSupplement): number | null {
  const c = item.fix_priceC;
  const f = item.fix_priceF;
  if (c === null || c === undefined || c === "") return null;
  if (f === null || f === undefined || f === "") return null;
  return Number(c) - Number(f);
}

function formatMargin(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)} €`;
}

const localList = ref<ShipmentSupplement[]>([]);
const initialSnapshot = ref<string>("");

watch(
  supplements,
  (list) => {
    localList.value = list.map((s) => ({ ...s }));
    initialSnapshot.value = JSON.stringify(localList.value);
  },
  { immediate: true },
);

/** A row shown in this box that only exists on the supplier/courier axis
 *  (no `delta='N'` counterpart) — read-only here, see `clientSupplements`. */
type ClientRow = ShipmentSupplement & { supplierOnly?: boolean };

/**
 * One row per supplement — a supplement is a single thing carrying two prices
 * (cost and client), not two entries.
 *
 * Historically the same supplement could be stored as TWO rows (delta='N' for
 * the client axis, delta='S' for the supplier one); 1.357 shipments still look
 * like that against 376.041 with a single row. Those legacy pairs are merged
 * here so the operator sees one line, with the supplier row contributing its
 * `fix_priceF`.
 *
 * A supplement that exists ONLY on the supplier axis (added from the COURIER
 * tab, no client counterpart) is still shown here — dropping it would hide a
 * cost that was already recorded — but flagged `supplierOnly` so the template
 * renders it read-only. Collaudo 20/11: antes se mostraba como una fila normal
 * y editable; activarla desde esta caja (pestaña Cliente) escribía `attivo`
 * sobre esa misma fila `delta='S'`, sin crear nunca el eje cliente — quedaba
 * registrada como suplemento de courier/postfacturación aunque el operador
 * creyera estar marcando algo "de cara al cliente".
 */
const clientSupplements = computed<ClientRow[]>(() => {
  const byId = new Map<string, ShipmentSupplement[]>();
  for (const row of localList.value) {
    const key = String(row.id_supplementi);
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key)!.push(row);
  }

  const out: ClientRow[] = [];
  for (const rows of byId.values()) {
    const clientRow = rows.find((r) => r.delta !== "S");
    const supplierRow = rows.find((r) => r.delta === "S");

    if (!clientRow) {
      // Solo existe en el eje fornitore: visible por el coste, no editable.
      if (supplierRow) out.push({ ...supplierRow, supplierOnly: true });
      continue;
    }

    const merged: ClientRow = { ...clientRow };
    if (supplierRow) {
      if (merged.fix_priceC === null || merged.fix_priceC === undefined) {
        merged.fix_priceC = supplierRow.fix_priceC;
      }
      if (merged.fix_priceF === null || merged.fix_priceF === undefined) {
        merged.fix_priceF = supplierRow.fix_priceF;
      }
      // Active on either axis means the supplement applies.
      if (supplierRow.attivo === "S") merged.attivo = "S";
    }
    out.push(merged);
  }
  return out;
});
/** Counts only genuine client-axis rows — a supplier-only row being active
 *  on the courier side doesn't mean a client supplement is active. */
const activeCount = computed(
  () =>
    clientSupplements.value.filter((s) => s.attivo === "S" && !s.supplierOnly)
      .length,
);
const dirty = computed(
  () => JSON.stringify(localList.value) !== initialSnapshot.value,
);

/**
 * Toggling a supplement persists immediately — there is no Save button.
 * Activating/deactivating IS the action, so waiting for a second confirmation
 * only invited the "I unticked it and it stayed" confusion.
 *
 * On failure the switch is rolled back to the server state, so the UI never
 * claims a change that did not land.
 */
async function toggleAt(_idx: number, active: boolean): Promise<void> {
  // The data-table index refers to the filtered list (clientSupplements).
  // Find the underlying entry by id_supplementi instead.
  const target = clientSupplements.value[_idx];
  if (!target) return;
  // Guard, in case the disabled switch is ever bypassed: a supplier-only row
  // has no client (delta='N') counterpart, so toggling it here would just
  // flip `attivo` on the delta='S' row — persisting as a courier supplement,
  // not a client one. Use the COURIER tab for this row instead.
  if (target.supplierOnly) return;
  const original = localList.value.find((s) => s.id === target.id);
  if (!original) return;

  const previous = original.attivo;
  original.attivo = active ? "S" : "N";

  const ok = await store.saveSupplements(localList.value);
  if (!ok) {
    original.attivo = previous;
  }
}

/**
 * Price edits also persist on their own (no Save button), but debounced:
 * a number field fires on every keystroke and one PUT per digit would be
 * both wasteful and racy.
 */
let priceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Edit one of the two prices of a supplement.
 *
 * `side` selects the column: 'F' = what the supplier charges us (fix_priceF),
 * 'C' = what we charge the client (fix_priceC). They are two fields of the SAME
 * row — a supplement is one thing with two amounts, not two separate entries.
 *
 * An empty input clears the override (null) so the engine prices it from the
 * listino again; a typed 0 is a real "charge nothing".
 */
function updatePriceAt(_idx: number, raw: string, side: "C" | "F"): void {
  const target = clientSupplements.value[_idx];
  if (!target) return;
  if (target.supplierOnly) return; // read-only here — see toggleAt.
  const original = localList.value.find((s) => s.id === target.id);
  if (!original) return;

  const trimmed = (raw ?? "").trim();
  // Money: normalise to 2 decimals so the field shows what will be stored
  // (the column is double(12,4) and the backend rounds to cents anyway).
  const value = trimmed === "" ? null : (Number(trimmed) || 0).toFixed(2);

  if (side === "C") {
    original.fix_priceC = value;
    // `prezzo` is the generic alias the backend routes by `delta`; keep it in
    // sync with the client side so the existing write path stays valid.
    original.prezzo = value;
  } else {
    original.fix_priceF = value;
  }

  if (priceTimer) clearTimeout(priceTimer);
  priceTimer = setTimeout(() => {
    void store.saveSupplements(localList.value);
  }, 600);
}

onBeforeUnmount(() => {
  if (priceTimer) clearTimeout(priceTimer);
});

/**
 * Recompute one supplement amount via /supplcalcola (legacy parity
 * with the "P" icon on spedy_form). Writes the result back into the
 * local row + flags it as manual-locked so the user sees the override.
 *
 * N26 (collaudo 16/11): escribia en `original.prezzo`, un alias que ni la
 * tabla (pinta fix_priceC/fix_priceF) ni el guardado (Shipment_Supplements_
 * Controller lee fix_priceC/fix_priceF) usan -- resto de antes de separar el
 * precio en dos columnas. Ademas nunca llamaba a saveSupplements, as; que
 * aunque escribiera en el campo correcto no se habria persistido. El boton
 * calculaba bien (se veia en el toast) pero la columna "Prezzo cliente"
 * seguia vacia siempre. calculate() sin tercer argumento siempre cotiza el
 * lado cliente (quale='C'), por eso aqui se escribe fix_priceC.
 */
async function recalc(item: ClientRow): Promise<void> {
  if (!store.id || item.supplierOnly) return;
  recalcLoading.value = item.id_supplementi;
  try {
    const r = await supplementsService.calculate(
      store.id,
      Number(item.id_supplementi),
    );
    if (r.success && typeof r.prezzo === "number") {
      const original = localList.value.find((s) => s.id === item.id);
      if (original) {
        original.fix_priceC = String(r.prezzo);
      }
      toasts.push(
        "success",
        `${item.descrizione || t("shipment.modals.supplements.supplement")}: ${formatMoney(r.prezzo)}`,
      );
      await store.saveSupplements(localList.value);
    } else {
      toasts.push(
        "error",
        r.error ?? t("shipment.modals.supplements.recompute_failed"),
      );
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    recalcLoading.value = null;
  }
}
</script>

<style scoped>
/* Fixed-height rail for the save bar: reserving the 2px up front means the
   table never shifts when the bar appears or disappears. */
.suppl-progress {
  height: 2px;
  overflow: hidden;
}

/* The toolbar spinner keeps its slot at all times and only fades, so the
   buttons beside it never jump on autosave. */
.save-indicator {
  display: inline-flex;
  align-items: center;
  width: 16px;
  margin-inline-end: 8px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.save-indicator--on {
  opacity: 1;
}
</style>
