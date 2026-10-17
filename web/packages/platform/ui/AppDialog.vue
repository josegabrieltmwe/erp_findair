<template>
  <v-dialog
    :model-value="open"
    :max-width="resolvedWidth"
    :persistent="persistent"
    scrollable
    @update:model-value="onUpdate"
  >
    <!-- autofocus moves focus into the dialog on open; v-dialog already traps
         focus and restores it to the trigger on close (Vuetify retain-focus). -->
    <v-card autofocus :class="cardClass">
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          v-if="icon"
          :icon="icon"
          size="20"
          :color="iconColor"
          class="me-2"
        />
        <span class="text-subtitle-1 font-weight-bold">{{ title }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          :disabled="closeDisabled"
          @click="emit('close')"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-4">
        <slot />
      </v-card-text>

      <template v-if="$slots.actions">
        <v-divider />
        <!-- No leading spacer: callers control alignment (buttons-right is the
             common case; a leading <v-spacer/> in the slot achieves it, while
             cancel-left / primary-right layouts put the spacer between buttons). -->
        <v-card-actions class="pa-3">
          <slot name="actions" />
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";

/**
 * Shared dialog CHROME for the expedition SPAs (courier + cargo) — title with
 * icon + close X, dividers, a fixed width scale, and an optional actions
 * footer. No draft/buffer logic: use this for action, preview and info dialogs
 * (generate AWB, label gallery, confirmations with custom markup). For shipment
 * edit dialogs that buffer field changes, use {@link FormModal}, which composes
 * this chrome with a draft host.
 *
 * Width comes from a fixed 5-step scale so every dialog across both apps shares
 * the same rhythm; `maxWidth` remains an explicit escape hatch.
 */

export type AppDialogSize = "sm" | "md" | "lg" | "xl" | "confirm";

const SIZE_MAP: Record<AppDialogSize, number> = {
  confirm: 440,
  sm: 560,
  md: 720,
  lg: 960,
  xl: 1040,
};

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    icon?: string;
    iconColor?: string;
    size?: AppDialogSize;
    maxWidth?: number;
    persistent?: boolean;
    cardClass?: string;
    /** Disable the title-bar close X (e.g. during an in-flight batch op). */
    closeDisabled?: boolean;
  }>(),
  {
    icon: undefined,
    iconColor: "primary",
    size: "md",
    maxWidth: undefined,
    persistent: false,
    cardClass: undefined,
    closeDisabled: false,
  },
);

const emit = defineEmits<{ (e: "close"): void }>();

const resolvedWidth = computed(
  () => props.maxWidth ?? SIZE_MAP[props.size] ?? SIZE_MAP.md,
);

function onUpdate(v: boolean): void {
  if (!v) emit("close");
}
</script>
