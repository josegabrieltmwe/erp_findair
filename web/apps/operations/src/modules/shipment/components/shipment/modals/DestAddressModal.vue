<template>
  <ModalWrapper
    name="dest"
    :title="t('shipment.modals.dest.title')"
    icon="mdi-map-marker-outline"
    :max-width="720"
  >
    <ShipmentAddressBlock
      ref="blockRef"
      tipo="D"
      :title="t('shipment.modals.dest.block_title')"
    />
    <template #actions>
      <v-btn variant="text" :disabled="store.saving" @click="onCancel">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="store.saving"
        :disabled="store.saving"
        @click="onSave"
      >
        {{ t("common.save") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentAddressBlock from "@shipment/components/shipment/ShipmentAddressBlock.vue";

const { t } = useI18n();
const ui = useUiStore();
const store = useShipmentStore();
const blockRef = ref<{ save: () => Promise<boolean>; dirty: boolean } | null>(
  null,
);

async function onSave(): Promise<void> {
  const ok = await blockRef.value?.save();
  if (ok) ui.closeModal();
}

function onCancel(): void {
  // Address edits live in the block's local buffer; closing discards them
  // (nothing was persisted). The block re-syncs from the store on reopen.
  ui.closeModal();
}
</script>
