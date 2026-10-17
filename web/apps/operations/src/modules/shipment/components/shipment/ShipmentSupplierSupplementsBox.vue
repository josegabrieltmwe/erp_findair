<template>
  <!-- Embedded in the supplements modal tab: ModalWrapper already provides the
       card + title, so render plain with just an action bar. -->
  <component
    :is="embedded ? 'div' : VCard"
    v-bind="embedded ? {} : { border: true, rounded: 'lg' }"
  >
    <v-card-title v-if="!embedded" class="d-flex align-center">
      <v-icon icon="mdi-truck-plus-outline" class="me-2" />
      {{ t("shipment.modals.supplements.supplier_title") }}
      <v-badge :content="activeCount" color="primary" inline class="ms-2" />
      <v-spacer />
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-plus"
        @click="addDialog = true"
      >
        {{ t("shipment.modals.supplements.add") }}
      </v-btn>
    </v-card-title>
    <div v-else class="d-flex align-center mb-2">
      <v-spacer />
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-plus"
        @click="addDialog = true"
      >
        {{ t("shipment.modals.supplements.add") }}
      </v-btn>
    </div>

    <ShipmentAddSupplementDialog v-model="addDialog" mode="supplier" />

    <v-data-table
      :headers="headers"
      :items="supplierSupplements"
      :items-per-page="-1"
      hide-default-footer
      density="compact"
    >
      <template #item.attivo="{ item, index }">
        <v-switch
          :model-value="item.attivo === 'S'"
          color="success"
          hide-details
          density="compact"
          @update:model-value="(v: any) => toggleAt(index, !!v)"
        />
      </template>
      <template #item.descrizione="{ item }">
        <div class="text-body-2">
          {{
            item.descrizione ||
            t("shipment.modals.supplements.suppl_n", {
              id: item.id_supplementi,
            })
          }}
        </div>
      </template>
      <!-- El eje FORNITORE/courier es SOLO activación (paridad legacy fsupplz):
           checkbox de activar/desactivar, SIN edición de precio. El precio del
           fornitore no vive en spedizioni_suppl (se calcula por listino); solo
           el eje cliente edita precio. -->
      <template #item.breakdown="{ item }">
        <SupplementPriceBreakdown :supplement-id="item.id_supplementi" />
      </template>
      <template #no-data>
        <EmptyState
          icon="mdi-truck-outline"
          :title="t('shipment.modals.supplements.none_supplier_title')"
          :text="t('shipment.modals.supplements.none_supplier_text')"
        />
      </template>
    </v-data-table>
  </component>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { VCard } from "vuetify/components";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import ShipmentAddSupplementDialog from "./ShipmentAddSupplementDialog.vue";
import SupplementPriceBreakdown from "./SupplementPriceBreakdown.vue";
import type { ShipmentSupplement } from "@shipment/services/shipment.types";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const { supplements } = storeToRefs(store);

const addDialog = ref(false);

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
  { title: "", key: "breakdown", width: 40, sortable: false },
]);

const localList = ref<ShipmentSupplement[]>([]);

watch(
  supplements,
  (list) => {
    localList.value = list.map((s) => ({ ...s }));
  },
  { immediate: true },
);

const supplierSupplements = computed(() =>
  localList.value.filter((s) => s.delta === "S"),
);
const activeCount = computed(
  () => supplierSupplements.value.filter((s) => s.attivo === "S").length,
);

/**
 * Toggling a supplier supplement persists IMMEDIATELY — no Save button.
 * Mirrors the client box: activating/deactivating IS the action. On failure
 * the switch rolls back to the server state so the UI never claims a change
 * that did not land.
 */
async function toggleAt(_idx: number, active: boolean): Promise<void> {
  const target = supplierSupplements.value[_idx];
  if (!target) return;
  const original = localList.value.find((s) => s.id === target.id);
  if (!original) return;

  const previous = original.attivo;
  original.attivo = active ? "S" : "N";

  const ok = await store.saveSupplements(localList.value);
  if (!ok) {
    original.attivo = previous;
  }
}
</script>
