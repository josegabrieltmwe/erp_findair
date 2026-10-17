<template>
  <v-card
    :variant="flat ? 'flat' : 'outlined'"
    :class="['form-section', { 'mb-3': !last, 'form-section--flat': flat }]"
  >
    <v-card-title
      class="form-section__title text-subtitle-2 font-weight-medium px-3 py-2 d-flex align-center"
    >
      <v-icon v-if="icon" :icon="icon" size="16" class="me-2" />
      <span>{{ title }}</span>
      <template v-if="$slots.actions">
        <v-spacer />
        <slot name="actions" />
      </template>
    </v-card-title>
    <v-divider />
    <v-card-text class="pa-3">
      <slot />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
/**
 * Field-group primitive for expedition modals (courier + cargo). Wraps a
 * labelled `v-card outlined` (icon + title, optional header actions) so every
 * modal groups its fields the same way instead of dumping loose `v-row`s.
 *
 * Factored from the good-but-ad-hoc pattern in WifiScaleDialog / DgrDeclaration
 * / HawbFormModal so it becomes the shared default. Stack several inside a
 * modal body; mark the last one `last` to drop the trailing margin.
 *
 * Usage:
 *   <FormSection :title="t('…')" icon="mdi-account">
 *     <v-row dense> … campos … </v-row>
 *   </FormSection>
 */
defineProps<{
  title: string;
  icon?: string;
  /** Drop the bottom margin (for the last section in a modal body). */
  last?: boolean;
  /**
   * Borderless variant: keep the titled header + divider but drop the card
   * outline, so stacked sections read as one flat form (used by the address
   * blocks) instead of a set of boxed cards.
   */
  flat?: boolean;
}>();
</script>

<style scoped>
.form-section__title {
  line-height: 1.3;
}
/* Flat variant: no card outline/background, tighter padding — the header +
   divider alone carry the grouping. */
.form-section--flat {
  background: transparent;
}
.form-section--flat :deep(.v-card-text) {
  padding-inline: 0;
}
</style>
