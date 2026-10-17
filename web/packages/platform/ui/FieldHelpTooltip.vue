<template>
  <!-- Wraps a form field and shows `text` as a floating tooltip after the
       pointer rests on it for `openDelay` ms (default 1000). No help → renders
       the field bare (no wrapper tooltip). Mirrors the legacy "i" help bubble
       of the classic forms, but sourced from the modern field-help map. -->
  <div v-if="text" class="field-help-wrap">
    <slot />
    <v-tooltip
      activator="parent"
      location="top"
      :open-delay="openDelay"
      max-width="340"
    >
      <span class="field-help-text">{{ text }}</span>
    </v-tooltip>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
/**
 * FieldHelpTooltip — hover/focus tooltip for a single form field.
 *
 * Usage:
 *   <FieldHelpTooltip :text="fieldHelp.helpText('presa_stato')">
 *     <v-select … />
 *   </FieldHelpTooltip>
 *
 * The tooltip opens on the wrapped field via `activator="parent"` so it also
 * triggers on keyboard focus, not only mouse hover. Empty text = no tooltip.
 */
withDefaults(
  defineProps<{
    /** Help text to show. Empty/undefined → the field is rendered without a tooltip. */
    text?: string;
    /** Hover delay before the tooltip appears, in ms. */
    openDelay?: number;
  }>(),
  { text: "", openDelay: 1000 },
);
</script>

<style scoped>
.field-help-wrap {
  /* Keep the field's own block layout; the wrapper must not alter width. */
  display: block;
}
.field-help-text {
  white-space: pre-line;
}
</style>
