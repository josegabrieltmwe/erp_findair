<template>
  <ModalWrapper
    name="post_invoice"
    :title="t('cargo.modal.post_invoice')"
    icon="mdi-receipt-text-edit-outline"
    :max-width="640"
  >
    <CargoPostInvoiceBox embedded />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import CargoPostInvoiceBox from "@cargo/components/cargo/CargoPostInvoiceBox.vue";

const { t } = useI18n();
</script>
