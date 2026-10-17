<template>
  <ModalWrapper
    name="cliente"
    :title="t('cargo.modal.client')"
    icon="mdi-account-outline"
    :max-width="640"
  >
    <CargoClientHeader />
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
import CargoClientHeader from "@cargo/components/cargo/CargoClientHeader.vue";
const { t } = useI18n();
const ui = useUiStore();
</script>
