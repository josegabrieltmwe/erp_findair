<template>
  <!--
    "INSERT THIS TAG" — paridad con legacy `spedyc_mawb_form.php` (AwbSetTxt).
    Compact select that appends a predefined phrase to a target MAWB field.
    It never holds state: on pick it emits `insert` with the chosen phrase and
    resets, so the parent appends it (with the legacy separator) and PATCHes.
  -->
  <v-select
    :model-value="null"
    :items="items"
    :label="t('cargo.mawbv2.insert_tag')"
    :disabled="disabled"
    density="compact"
    hide-details
    class="mt-1"
    @update:model-value="onPick"
  />
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

const props = defineProps<{
  /** Predefined phrases to offer. */
  items: string[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ (e: "insert", phrase: string): void }>();

const { t } = useI18n();

function onPick(phrase: string | null): void {
  if (props.disabled || !phrase) return;
  emit("insert", phrase);
}
</script>
