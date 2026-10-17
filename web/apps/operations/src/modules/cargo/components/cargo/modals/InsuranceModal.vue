<template>
  <ModalWrapper
    name="insurance"
    :title="t('cargo.modal.insurance')"
    icon="mdi-shield-check-outline"
    :max-width="640"
  >
    <CargoInsuranceBox />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import CargoInsuranceBox from "@cargo/components/cargo/CargoInsuranceBox.vue";

const { t } = useI18n();
</script>
