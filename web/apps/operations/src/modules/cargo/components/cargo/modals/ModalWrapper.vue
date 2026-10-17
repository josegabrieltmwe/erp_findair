<template>
  <FormModal
    :open="isOpen"
    :host="host"
    :title="title"
    :icon="icon"
    :size="size"
    :max-width="maxWidth"
    :cancel-label="t('common.cancel')"
    :save-label="t('common.save')"
    :unsaved-title="t('cargo.modalwrap.unsaved_title')"
    :unsaved-body="t('cargo.modalwrap.unsaved_body')"
    :keep-editing-label="t('cargo.modalwrap.keep_editing')"
    :discard-label="t('cargo.modalwrap.discard')"
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
import { useUiStore, type ModalName } from "@cargo/stores/ui.store";
import { useModalDraftHost } from "@cargo/composables/useModalDraftHost";

/**
 * Cargo modal frame — thin app-specific wrapper over the shared
 * `@shared/ui/FormModal`. Binds the open state to the ui store's activeModal
 * channel and adapts the cargo store to the FormModal draft host, so callers
 * keep the exact same API (`<ModalWrapper name="…" …>`) while the frame is now
 * shared with courier.
 *
 * Cargo custom-footer (#actions) modals opt out of the draft (no `always-draft`
 * here), matching the previous behaviour.
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
