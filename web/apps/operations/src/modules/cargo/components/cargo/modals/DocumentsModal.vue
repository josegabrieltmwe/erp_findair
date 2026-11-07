<template>
  <!-- Documentos del cargo en un MODAL (antes un panel lateral con pestaña fija en el borde derecho). -->
  <ModalWrapper
    name="documents"
    :title="t('cargo.azioni.documents')"
    icon="mdi-file-upload-outline"
    :max-width="720"
  >
    <CargoFilesBox />
    <template #actions>
      <v-spacer />
      <v-btn
        variant="text"
        data-testid="documents-close"
        @click="ui.closeModal()"
        >{{ t("common.close") }}</v-btn
      >
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useUiStore } from "@cargo/stores/ui.store";
import CargoFilesBox from "@cargo/components/cargo/CargoFilesBox.vue";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
</script>
