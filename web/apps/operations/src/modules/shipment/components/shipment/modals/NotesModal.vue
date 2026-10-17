<template>
  <ModalWrapper
    name="note"
    :title="t('shipment.modals.note.title')"
    icon="mdi-note-text-outline"
    :max-width="720"
  >
    <ShipmentNotesBox embedded />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentNotesBox from "@shipment/components/shipment/ShipmentNotesBox.vue";

const { t } = useI18n();
</script>
