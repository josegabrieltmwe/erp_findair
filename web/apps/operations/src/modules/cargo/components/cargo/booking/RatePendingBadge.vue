<template>
  <v-chip
    v-if="store.cargo?.rate_pending"
    color="warning"
    size="small"
    variant="flat"
    class="ms-1"
    prepend-icon="mdi-progress-clock"
    :title="t('cargo.badge.rate_pending_hint')"
    @click="ui.openModal('flights')"
  >
    {{ t("cargo.badge.rate_pending") }}
  </v-chip>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";

const { t } = useI18n();
const store = useCargoStore();
const ui = useUiStore();
</script>
