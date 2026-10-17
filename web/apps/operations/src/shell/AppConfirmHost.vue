<template>
  <v-dialog
    :model-value="!!confirm.active"
    max-width="420"
    persistent
    @update:model-value="(v: boolean) => !v && confirm.answer(false)"
  >
    <v-card v-if="confirm.active">
      <v-card-title v-if="confirm.active.title" class="cm-confirm-title">
        {{ confirm.active.title }}
      </v-card-title>
      <v-card-text class="cm-confirm-message">{{
        confirm.active.message
      }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirm.answer(false)">
          {{ confirm.active.cancelLabel ?? t("common.cancel") }}
        </v-btn>
        <v-btn
          :color="confirm.active.variant === 'danger' ? 'error' : 'primary'"
          variant="flat"
          @click="confirm.answer(true)"
        >
          {{ confirm.active.confirmLabel ?? t("common.confirm") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";

const confirm = useConfirmStore();
const { t } = useI18n();
</script>

<style scoped>
.cm-confirm-title {
  font-size: var(--cm-fs-md);
  font-weight: 500;
  padding: var(--cm-space-lg) var(--cm-space-lg) var(--cm-space-sm);
}
.cm-confirm-message {
  padding: var(--cm-space-sm) var(--cm-space-lg) var(--cm-space-md);
  font-size: var(--cm-fs-base);
  color: var(--cm-text-secondary);
}
</style>
