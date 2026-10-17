<template>
  <ModalWrapper
    name="cotizacion"
    :title="t('cargo.cotizacion.title')"
    icon="mdi-tag-multiple-outline"
    size="xl"
  >
    <!-- Two conceptual sides of a cargo quote:
         · carriers → what it COSTS us (RFQ offers table)
         · client   → what we OFFER the client (offer status + send)
         The cost side feeds the price side, so they live together. -->
    <v-tabs v-model="tab" density="compact" color="primary" class="mb-2">
      <v-tab value="carriers" prepend-icon="mdi-airplane">
        {{ t("cargo.cotizacion.tab_carriers") }}
      </v-tab>
      <v-tab value="client" prepend-icon="mdi-account-tie-outline">
        {{ t("cargo.cotizacion.tab_client") }}
      </v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="carriers">
        <CargoOffersTable embedded />
      </v-window-item>
      <v-window-item value="client">
        <CargoOfferteBox embedded />
      </v-window-item>
    </v-window>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import ModalWrapper from "./ModalWrapper.vue";
import CargoOffersTable from "@cargo/components/cargo/offers/CargoOffersTable.vue";
import CargoOfferteBox from "@cargo/components/cargo/CargoOfferteBox.vue";

const { t } = useI18n();
const ui = useUiStore();
const { activeModal, pendingCotizacionTab } = storeToRefs(ui);

const tab = ref<"carriers" | "client">("carriers");

// Sync the active tab from the deep-link intent each time the modal opens,
// so the Azioni InfoRow lands on the client tab and the summary card on
// carriers, without resetting while the user switches tabs manually.
watch(activeModal, (name) => {
  if (name === "cotizacion") tab.value = pendingCotizacionTab.value;
});
</script>
