<template>
  <ModalWrapper
    name="colli"
    :title="t('cargo.modal.colli')"
    icon="mdi-package-variant"
    :max-width="980"
  >
    <CargoPackagesBox />
    <CargoExtraWeightsBox class="mt-3" />
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
import CargoPackagesBox from "@cargo/components/cargo/CargoPackagesBox.vue";
import CargoExtraWeightsBox from "@cargo/components/cargo/CargoExtraWeightsBox.vue";
const { t } = useI18n();
const ui = useUiStore();
</script>
