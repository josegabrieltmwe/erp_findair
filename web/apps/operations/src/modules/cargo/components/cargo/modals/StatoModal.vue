<template>
  <ModalWrapper
    name="stato"
    :title="t('cargo.modal.stato')"
    icon="mdi-clock-outline"
    :max-width="720"
  >
    <CargoTimelineCard />
    <CargoFlagsBox class="mt-3" />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import CargoTimelineCard from "@cargo/components/cargo/CargoTimelineCard.vue";
import CargoFlagsBox from "@cargo/components/cargo/CargoFlagsBox.vue";

const { t } = useI18n();
</script>
