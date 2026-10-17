<template>
  <ModalWrapper
    name="costi"
    :title="t('cargo.modal.costi')"
    icon="mdi-currency-eur"
    size="lg"
  >
    <!-- Split the two heavy blocks (money flows vs the 17-row charge table)
         across tabs so neither pushes the other out of view. -->
    <v-tabs v-model="tab" density="compact" color="primary" class="mb-2">
      <v-tab value="flows" prepend-icon="mdi-cash-multiple">
        {{ t("cargo.money.title") }}
      </v-tab>
      <v-tab value="details" prepend-icon="mdi-table-edit">
        {{ t("cargo.charges.title") }}
        <v-chip size="x-small" color="primary" variant="tonal" class="ms-2">
          {{ chargesStore.total }}
        </v-chip>
      </v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="flows">
        <CargoMoneyFlowsBox embedded />
      </v-window-item>
      <v-window-item value="details">
        <CargoChargesTableV2 embedded />
      </v-window-item>
    </v-window>

    <template #actions>
      <v-btn variant="text" size="small" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoChargesStore } from "@cargo/stores/cargo_charges.store";
import ModalWrapper from "./ModalWrapper.vue";
import CargoMoneyFlowsBox from "@cargo/components/cargo/CargoMoneyFlowsBox.vue";
import CargoChargesTableV2 from "@cargo/components/cargo/charges/CargoChargesTableV2.vue";

const { t } = useI18n();
const ui = useUiStore();
const chargesStore = useCargoChargesStore();

const tab = ref<"flows" | "details">("flows");
</script>
