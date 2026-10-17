<template>
  <ModalWrapper
    name="dates"
    :title="t('shipment.modals.dates.title')"
    icon="mdi-calendar-multiple"
    :max-width="680"
  >
    <ShipmentDatesBoxV2 />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentDatesBoxV2 from "@shipment/components/shipment/ShipmentDatesBoxV2.vue";

const { t } = useI18n();
</script>
