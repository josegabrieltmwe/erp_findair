<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="inforow"
    :class="{ 'inforow--clickable': clickable }"
    @click="clickable && $emit('click')"
  >
    <!-- `prepend` permite sustituir el icono por contenido propio
         (p.ej. el logo/cola de la aerolínea). Fallback: el v-icon. -->
    <slot name="prepend">
      <v-icon v-if="icon" :icon="icon" size="18" />
    </slot>
    <div class="inforow-content">
      <div class="inforow-title">{{ title }}</div>
      <div v-if="subtitle" class="inforow-sub">{{ subtitle }}</div>
    </div>
    <div v-if="value !== undefined && value !== null" class="inforow-val">
      {{ value }}
    </div>
    <slot name="append" />
  </component>
</template>

<script setup lang="ts">
/**
 * Mockup .inforow — icon + title + sub + right value.
 * Renders as <button> when clickable, otherwise <div>.
 * All styling lives in styles/mockup2.scss (.inforow).
 */
defineProps<{
  icon?: string;
  title: string;
  subtitle?: string;
  value?: string | number | null;
  clickable?: boolean;
}>();
defineEmits<{ (e: "click"): void }>();
</script>

<style scoped lang="scss">
.inforow-content {
  flex: 1;
  min-width: 0;
}
</style>
