<template>
  <ModalWrapper
    name="partners"
    :title="t('shipment.modals.partners.title')"
    icon="mdi-account-multiple-outline"
    :max-width="640"
  >
    <ShipmentPartnersBox embedded />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentPartnersBox from "@shipment/components/shipment/ShipmentPartnersBox.vue";

const { t } = useI18n();
</script>
