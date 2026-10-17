<template>
  <ModalWrapper
    name="servizio"
    :title="t('cargo.modal.servizio')"
    icon="mdi-airplane"
    :max-width="720"
  >
    <CargoVettoriBox />
    <CargoDatesBox class="mt-3" />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import CargoVettoriBox from "@cargo/components/cargo/CargoVettoriBox.vue";
import CargoDatesBox from "@cargo/components/cargo/CargoDatesBox.vue";

const { t } = useI18n();
</script>
