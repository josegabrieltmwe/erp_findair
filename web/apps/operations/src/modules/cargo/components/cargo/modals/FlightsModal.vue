<template>
  <ModalWrapper
    name="flights"
    :title="t('cargo.modal.flights')"
    icon="mdi-airplane"
    :max-width="980"
  >
    <CargoFlightLegList />
    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useUiStore } from "@cargo/stores/ui.store";
import ModalWrapper from "./ModalWrapper.vue";
import CargoFlightLegList from "@cargo/components/cargo/CargoFlightLegList.vue";
const { t } = useI18n();
const ui = useUiStore();
</script>
