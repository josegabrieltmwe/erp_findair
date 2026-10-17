<template>
  <ModalWrapper
    name="servizio"
    :title="t('common.sections.service')"
    icon="mdi-truck"
    size="sm"
  >
    <ShipmentServiceFornitoreBox />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentServiceFornitoreBox from "@shipment/components/shipment/ShipmentServiceFornitoreBox.vue";

const { t } = useI18n();
</script>
