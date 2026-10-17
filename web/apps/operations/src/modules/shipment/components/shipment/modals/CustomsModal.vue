<template>
  <ModalWrapper
    name="customs"
    :title="t('shipment.modals.customs.title')"
    icon="mdi-file-document-outline"
    :max-width="640"
  >
    <ShipmentCustomsBox embedded />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentCustomsBox from "@shipment/components/shipment/ShipmentCustomsBox.vue";

const { t } = useI18n();
</script>
