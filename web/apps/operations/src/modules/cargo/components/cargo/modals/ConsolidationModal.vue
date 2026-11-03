<template>
  <ModalWrapper
    name="consolidation"
    :title="t('cargo.voli.consolidation')"
    icon="mdi-set-merge"
    size="lg"
  >
    <ConsolidataCargoProjectCard :cargo-id="cargo.id" />
    <CargoConsolidationPanel />
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
import CargoConsolidationPanel from "@cargo/components/cargo/consolidation/CargoConsolidationPanel.vue";
import ConsolidataCargoProjectCard from "@/modules/consolidata/components/ConsolidataCargoProjectCard.vue";
import { useCargoStore } from "@cargo/stores/cargo.store";

const { t } = useI18n();
const ui = useUiStore();
const cargo = useCargoStore();
</script>
