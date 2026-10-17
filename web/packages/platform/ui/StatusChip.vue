<template>
  <!--
    Chip de estado unificado. Recibe el valor de estado y un mapa
    `{ valor: { label, color } }`; renderiza un v-chip con el color y la
    etiqueta correspondientes. Centraliza el patrón repetido de
    `switch(estado){ color/label }` disperso por las SPAs (SDI, controllo_fatt,
    estados de cargo/shipment…).

    Las etiquetas se pasan ya resueltas (con t()) en el mapa, desde el
    consumidor — el componente no acopla i18n.
  -->
  <v-chip :color="entry.color" :size="size" label v-bind="$attrs">
    {{ entry.label }}
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface StatusEntry {
  label: string;
  color: string;
}

const props = withDefaults(
  defineProps<{
    /** Valor de estado actual (clave del mapa). */
    status: string | null | undefined;
    /** Mapa estado → { label, color }. */
    map: Record<string, StatusEntry>;
    /** Entry a usar cuando el estado no está en el mapa. */
    fallback?: StatusEntry;
    /** Tamaño del chip. */
    size?: string;
  }>(),
  {
    fallback: () => ({ label: '—', color: 'grey' }),
    size: 'small',
  },
);

const entry = computed<StatusEntry>(
  () => props.map[props.status ?? ''] ?? props.fallback,
);
</script>
