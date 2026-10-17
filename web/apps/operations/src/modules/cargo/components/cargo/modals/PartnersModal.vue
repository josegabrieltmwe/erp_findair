<template>
  <ModalWrapper
    name="partners"
    :title="t('cargo.modal.partners')"
    icon="mdi-account-multiple"
    :max-width="640"
  >
    <CargoPartnersBox />
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
import CargoPartnersBox from "@cargo/components/cargo/CargoPartnersBox.vue";
const { t } = useI18n();
const ui = useUiStore();
</script>
