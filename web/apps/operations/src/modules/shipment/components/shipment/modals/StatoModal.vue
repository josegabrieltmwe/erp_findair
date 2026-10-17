<template>
  <ModalWrapper
    name="stato"
    :title="t('shipment.modals.stato.title')"
    icon="mdi-clock-outline"
    :max-width="720"
  >
    <LifecycleFlow />
    <v-divider class="my-4" />
    <!-- Delivery status + delivered-mail trigger (legacy Consegnato). -->
    <ShipmentDeliveryBox class="mb-4" embedded />
    <ShipmentTimelineCard />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import LifecycleFlow from "@shipment/components/shell/LifecycleFlow.vue";
import ShipmentDeliveryBox from "@shipment/components/shipment/ShipmentDeliveryBox.vue";
import ShipmentTimelineCard from "@shipment/components/shipment/ShipmentTimelineCard.vue";

const { t } = useI18n();
</script>
