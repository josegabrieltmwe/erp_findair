<template>
  <div class="cardh" :class="{ 'cardh--alt': alt }">
    <v-icon v-if="icon" :icon="icon" size="16" color="primary" />
    <h3 class="cardh-title">{{ title }}</h3>
    <slot name="badge" />
    <span class="cardh-spacer" />
    <slot name="actions">
      <button
        v-if="editable"
        type="button"
        class="cardh-edit"
        :title="`Modifica ${title}`"
        @click="$emit('edit')"
      >
        <v-icon icon="mdi-pencil-outline" size="14" />
      </button>
    </slot>
  </div>
</template>

<script setup lang="ts">
/**
 * Card-header band — matches the Mockup 2 `.cardh` rule
 * pixel-for-pixel:
 *   - 9px 14px padding
 *   - margin 0 -14px 12px so the band extends to the card edges
 *   - font-size 11px uppercase, letter-spacing .06em
 *   - h3 colored with on-surface-variant (muted), NOT primary
 *   - edit button 26x26 round 8px with bg-surface on hover.
 *
 * Renders raw HTML rather than Vuetify components so it does not
 * inherit any defaults from vuetify.ts (no rounded:lg, etc).
 */
defineProps<{
  icon?: string;
  title: string;
  editable?: boolean;
  /** `alt` flag makes the band slightly darker (pairs with surface-bright cards). */
  alt?: boolean;
}>();
defineEmits<{ (e: 'edit'): void }>();
</script>

<style scoped lang="scss">
.cardh {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 -14px 12px;
  /* Altura uniforme para TODOS los headers, tengan o no botones embebidos.
     Antes los headers con botones (v-btn/menús en #actions) crecían a ~44px
     mientras los sin botón medían ~32px. La banda se fija a 34px y los botones
     del slot se recortan a 22px (regla .cardh :deep(.v-btn) más abajo), así
     TODOS los headers miden lo mismo. */
  padding: 0 14px;
  /* Altura FIJA (no solo min-height): así un botón/menú alto del slot #actions
     no puede estirar la banda. Vale para headers con y sin botón por igual. */
  height: 34px;
  overflow: hidden;
  box-sizing: border-box;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 14px 14px 0 0;
}
/* Neutraliza el alto extra que meten los botones/menús Vuetify del slot
   #actions: se dimensionan al header (22px) en vez de estirarlo. No afecta al
   icono de título ni a los chips de badge.

   Vuetify fija la altura del botón vía la variable `--v-btn-height` y clases
   de tamaño (`.v-btn--size-*`) con alta especificidad; un `height` simple no
   siempre gana. Se sobrescribe la variable Y las dimensiones (incl. el
   contenido interno) para que el botón NUNCA estire la banda. */
.cardh :deep(.v-btn),
.cardh :deep(.v-btn.v-btn--density-default),
.cardh :deep(.v-btn.v-btn--density-comfortable),
.cardh :deep(.v-btn.v-btn--density-compact) {
  --v-btn-height: 22px;
  height: 22px !important;
  min-height: 22px !important;
  min-width: 22px !important;
  width: 22px;
}
.cardh :deep(.v-btn__content) {
  height: 22px;
}
/* Los menús/tooltips envuelven su activador en un wrapper inline; que no
   herede altura del contenido y desalinee la banda. */
.cardh :deep(.v-menu),
.cardh :deep(.v-tooltip) {
  display: inline-flex;
  align-items: center;
}
.cardh--alt {
  background: rgb(var(--v-theme-surface-light));
}
.cardh-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0;
  line-height: 1.3;
}
.cardh-spacer { flex: 1; }
.cardh-edit {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: .55;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: background .12s, color .12s, opacity .12s;
}
.cardh-edit:hover {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  opacity: 1;
}
</style>
