<template>
  <ModalWrapper
    name="delivery"
    :title="t('cargo.modal.delivery')"
    icon="mdi-package-down"
    :max-width="640"
  >
    <CargoDeliveryBox />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import CargoDeliveryBox from "@cargo/components/cargo/CargoDeliveryBox.vue";

const { t } = useI18n();
</script>
