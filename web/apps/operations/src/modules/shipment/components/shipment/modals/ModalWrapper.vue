<template>
  <FormModal
    :open="isOpen"
    :host="host"
    :title="title"
    :icon="icon"
    :size="size"
    :max-width="maxWidth"
    always-draft
    :cancel-label="t('common.cancel')"
    :save-label="t('common.save')"
    :unsaved-title="t('shipment.modals.wrapper.unsaved_title')"
    :unsaved-body="t('shipment.modals.wrapper.unsaved_body')"
    :keep-editing-label="t('shipment.modals.wrapper.keep_editing')"
    :discard-label="t('shipment.modals.wrapper.discard')"
    @close="ui.closeModal()"
  >
    <slot />
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </FormModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FormModal from "@shared/ui/FormModal.vue";
import { useUiStore, type ModalName } from "@shipment/stores/ui.store";
import { useModalDraftHost } from "@shipment/composables/useModalDraftHost";

/**
 * Courier modal frame — thin app-specific wrapper over the shared
 * `@shared/ui/FormModal`. It binds the open state to the ui store's
 * activeModal channel and adapts the shipment store to the FormModal draft
 * host, so callers keep the exact same API (`<ModalWrapper name="…" …>`) while
 * the actual frame is now shared with cargo.
 *
 * `maxWidth` remains supported for retro-compat; new modals should prefer the
 * `size` scale ("sm" | "md" | "lg" | "xl").
 */
const props = defineProps<{
  name: Exclude<ModalName, null>;
  title: string;
  icon?: string;
  size?: "sm" | "md" | "lg" | "xl" | "confirm";
  maxWidth?: number;
}>();

const { t } = useI18n();
const ui = useUiStore();
const host = useModalDraftHost();

const isOpen = computed(() => ui.activeModal === props.name);
</script>
