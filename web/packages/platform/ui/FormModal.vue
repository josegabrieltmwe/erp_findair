<template>
  <AppDialog
    :open="open"
    :title="title"
    :icon="icon"
    :size="size"
    :max-width="maxWidth"
    persistent
    @close="requestClose"
  >
    <!-- Centralised validation feedback. Shown only on the default-footer
         path (custom-footer modals surface their own errors). -->
    <v-alert
      v-if="!hasActionsSlot && shownErrors.length"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      <ul class="ps-4 mb-0">
        <li v-for="(msg, i) in shownErrors" :key="i">{{ msg }}</li>
      </ul>
    </v-alert>
    <slot />

    <template v-if="hasActionsSlot" #actions>
      <!-- Preserve the historical leading spacer for custom footers (buttons
           grouped right); AppDialog no longer injects one. -->
      <v-spacer />
      <slot name="actions" />
    </template>
    <template v-else #actions>
      <v-spacer />
      <v-btn
        variant="text"
        :disabled="host.saving.value"
        @click="requestClose"
      >
        {{ cancelLabel }}
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-content-save-outline"
        :loading="host.saving.value"
        :disabled="host.saving.value"
        @click="onSave"
      >
        {{ saveLabel }}
      </v-btn>
    </template>
  </AppDialog>

  <!-- Discard-changes confirmation (shared ConfirmDialog). -->
  <ConfirmDialog
    v-model="confirmOpen"
    :title="unsavedTitle"
    :body="unsavedBody"
    :cancel-label="keepEditingLabel"
    :confirm-label="discardLabel"
    confirm-color="error"
    @confirm="confirmDiscard"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted, useSlots } from "vue";
import AppDialog, { type AppDialogSize } from "./AppDialog.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import type { ModalDraftHost } from "./form-modal-host";

/**
 * Shared modal frame for the expedition EDIT dialogs (courier + cargo).
 *
 * Composes the {@link AppDialog} chrome with edit-in-buffer draft logic. The
 * host app injects its draft store (adapted to the {@link ModalDraftHost}
 * contract) via `host`, and owns the open channel via `open` + `@close`.
 *
 * When the modal opens the host begins a draft; field commits inside are
 * buffered, not persisted. The default footer's "Salva" validates + commits the
 * whole draft; "Annulla" / X / ESC / click-outside discards it (confirming when
 * there are unsaved changes). Modals that provide their own `#actions` slot keep
 * a custom footer and drive their own persistence, closing via `@close`.
 */

const props = withDefaults(
  defineProps<{
    /** Whether the dialog is shown (owned by the caller / ui store). */
    open: boolean;
    /** Draft store adapted to the shared host contract. */
    host: ModalDraftHost;
    title: string;
    icon?: string;
    /** Fixed width scale. Ignored when `maxWidth` is set. */
    size?: AppDialogSize;
    /** Explicit width escape hatch (px). Overrides `size`. */
    maxWidth?: number;
    /**
     * Open a draft scope even for custom-footer (#actions) modals. Courier
     * modals open a draft unconditionally (custom footers still buffer via
     * useFieldBinding); cargo custom-footer modals opt out. Default false
     * (cargo behaviour).
     */
    alwaysDraft?: boolean;
    /** i18n-resolved labels (passed by the per-app wrapper). */
    cancelLabel?: string;
    saveLabel?: string;
    unsavedTitle?: string;
    unsavedBody?: string;
    keepEditingLabel?: string;
    discardLabel?: string;
  }>(),
  {
    icon: undefined,
    size: "md",
    maxWidth: undefined,
    alwaysDraft: false,
    cancelLabel: "Annulla",
    saveLabel: "Salva",
    unsavedTitle: "Modifiche non salvate",
    unsavedBody: "Ci sono modifiche non salvate. Vuoi scartarle?",
    keepEditingLabel: "Continua a modificare",
    discardLabel: "Scarta",
  },
);

const emit = defineEmits<{ (e: "close"): void }>();

const slots = useSlots();
const hasActionsSlot = computed(() => !!slots.actions);

const localErrors = ref<string[]>([]);
const shownErrors = computed(() =>
  localErrors.value.length ? localErrors.value : props.host.draftErrors.value,
);
const confirmOpen = ref(false);

// Default-footer modals always buffer. Custom-footer (#actions) modals buffer
// only when the host opts in via `alwaysDraft` (courier behaviour); otherwise
// they opt out entirely (cargo behaviour).
const usesDraft = computed(() => !hasActionsSlot.value || props.alwaysDraft);

// Begin / tidy the draft as this modal opens and closes.
watch(
  () => props.open,
  (open, wasOpen) => {
    if (open) {
      localErrors.value = [];
      if (usesDraft.value) props.host.beginDraft();
    } else if (wasOpen && props.host.draftActive.value) {
      // Custom-footer modals close via @close directly; resolve their draft.
      if (props.host.isDraftDirty.value) props.host.discardDraft();
      else props.host.clearDraft();
    }
  },
  { immediate: true },
);

async function onSave(): Promise<void> {
  localErrors.value = [];
  const res = await props.host.commitDraft();
  if (!res.ok) {
    if (res.errors.length) localErrors.value = res.errors;
    // Persist error (no validation errors): host already toasted; keep open.
    return;
  }
  emit("close");
}

function finishClose(): void {
  localErrors.value = [];
  if (usesDraft.value) props.host.discardDraft();
  emit("close");
}

function requestClose(): void {
  if (usesDraft.value && props.host.isDraftDirty.value) {
    confirmOpen.value = true;
    return;
  }
  finishClose();
}

function confirmDiscard(): void {
  confirmOpen.value = false;
  finishClose();
}

// If the modal unmounts while a draft is still open (e.g. route change), drop
// the buffered edits so they don't leak into the next expedition view.
onUnmounted(() => {
  if (usesDraft.value && props.host.draftActive.value) {
    props.host.discardDraft();
  }
});
</script>
