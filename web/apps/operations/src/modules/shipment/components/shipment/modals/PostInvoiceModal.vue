<template>
  <ModalWrapper
    name="post_invoice"
    :title="t('shipment.modals.post_invoice.title')"
    icon="mdi-receipt-text-edit-outline"
    :max-width="820"
  >
    <ShipmentPostInvoiceBox embedded />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentPostInvoiceBox from "@shipment/components/shipment/ShipmentPostInvoiceBox.vue";

const { t } = useI18n();
</script>
