<template>
  <ModalWrapper
    name="handler"
    :title="t('cargo.modal.handler')"
    icon="mdi-warehouse"
    :max-width="720"
  >
    <!-- Paridad legacy xhandlerz: el handler SOLO tiene los desplegables
         handler_id/handler_id_sede + fechas + nota. NO tiene bloque de dirección
         ni contacto (eso no existe en el legacy ni tiene columnas destino en
         spedizioni_cargo; iba a spedizioni_indirizzi tipo='H', huérfano). Los 6
         campos se persisten campo a campo (on-blur/change), así que el modal
         solo necesita cerrar. -->
    <CargoHandlerSection />
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
import CargoHandlerSection from "@cargo/components/cargo/CargoHandlerSection.vue";

const { t } = useI18n();
const ui = useUiStore();
</script>
