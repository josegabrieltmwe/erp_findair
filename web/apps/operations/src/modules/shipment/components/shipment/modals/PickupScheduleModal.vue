<template>
  <ModalWrapper
    name="pickup_schedule"
    :title="t('shipment.pickup.title')"
    icon="mdi-clock-time-eight-outline"
    :max-width="820"
  >
    <ShipmentPickupScheduleBox />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentPickupScheduleBox from "@shipment/components/shipment/ShipmentPickupScheduleBox.vue";

const { t } = useI18n();
</script>
