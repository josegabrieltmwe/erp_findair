<template>
  <ModalWrapper
    name="flags"
    :title="t('shipment.flags.title')"
    icon="mdi-flag-outline"
    size="md"
  >
    <ShipmentFlagsBox />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentFlagsBox from "@shipment/components/shipment/ShipmentFlagsBox.vue";

const { t } = useI18n();
</script>
