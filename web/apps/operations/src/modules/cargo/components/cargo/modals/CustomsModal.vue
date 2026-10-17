<template>
  <!--
    Modal de aduanas con TABS: concentra TODO el trabajo de aduanas en un punto.
    - "Aduana": bloques EXPORT/IMPORT (CargoCustomsBox).
    - "Notificar agencias": envío de email a las agencias (antes era un modal
      aparte mail_agenzie, abierto desde Azioni).
    El tab inicial lo fija ui.openCustomsModal('customs'|'notify').
  -->
  <ModalWrapper
    name="customs"
    :title="t('cargo.modal.customs')"
    icon="mdi-file-document-outline"
    :max-width="760"
  >
    <v-tabs v-model="tab" density="compact" color="primary" class="mb-3">
      <v-tab value="customs" prepend-icon="mdi-passport">
        {{ t("cargo.customs.title") }}
      </v-tab>
      <v-tab value="notify" prepend-icon="mdi-email-multiple-outline">
        {{ t("cargo.mailag.tab") }}
      </v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="customs">
        <CargoCustomsBox embedded />
      </v-window-item>
      <v-window-item value="notify">
        <CargoAgencyNotifyPanel />
      </v-window-item>
    </v-window>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "@cargo/stores/ui.store";
import ModalWrapper from "./ModalWrapper.vue";
import CargoCustomsBox from "@cargo/components/cargo/CargoCustomsBox.vue";
import CargoAgencyNotifyPanel from "@cargo/components/cargo/customs/CargoAgencyNotifyPanel.vue";

const { t } = useI18n();
const ui = useUiStore();

// El tab vive en el ui store para poder deep-linkear (Azioni / botón notify).
const tab = computed({
  get: () => ui.customsTab,
  set: (v: "customs" | "notify") => {
    ui.customsTab = v;
  },
});
</script>
