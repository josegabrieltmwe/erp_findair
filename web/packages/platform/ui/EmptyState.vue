<template>
  <!--
    Estado vacío unificado para todas las SPAs. Envuelve `v-empty-state` de
    Vuetify fijando el tamaño y el tono "medium-emphasis" coherentes con el
    resto del ERP, y deja pasar el slot #actions (CTA opcional).

    Textos: se pasan ya resueltos (con t()) desde el consumidor — el componente
    es agnóstico de i18n para no acoplar el namespace de cada app.
  -->
  <v-empty-state
    :icon="icon"
    :title="title || undefined"
    :text="text || undefined"
    :size="size"
    class="ui-empty-state"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </v-empty-state>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Título principal (ya traducido por el consumidor). Opcional: algunos
     *  estados vacíos compactos muestran solo texto+icono. */
    title?: string;
    /** Texto secundario opcional. */
    text?: string;
    /** Icono mdi; por defecto un "sin resultados" neutro. */
    icon?: string;
    /** Tamaño del icono/estado: px (number) o token Vuetify ('small'…). */
    size?: number | string;
  }>(),
  {
    title: '',
    text: '',
    icon: 'mdi-tray-remove',
    size: 64,
  },
);
</script>

<style scoped>
.ui-empty-state {
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
