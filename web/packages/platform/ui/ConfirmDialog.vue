<template>
  <!--
    Diálogo de confirmación reutilizable. Centraliza el patrón repetido
    (descartar cambios, borrar, confirmar acción) que hoy se reimplementa
    inline en ModalWrapper de cargo/shipment y en varias páginas de admin.

    Textos ya resueltos (con t()) desde el consumidor. Emite `confirm`/`cancel`
    y sincroniza la visibilidad por v-model.
  -->
  <v-dialog v-model="open" :max-width="maxWidth" persistent>
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold py-3 px-4">
        {{ title }}
      </v-card-title>
      <!--
        El slot permite añadir un control a la confirmación (un selector, una
        casilla) sin escribir un v-dialog a mano y perder el patrón. Sin slot se
        comporta igual que antes: `body` como texto plano.
      -->
      <v-card-text v-if="body || $slots.default" class="pa-4">
        <template v-if="body">{{ body }}</template>
        <slot />
      </v-card-text>
      <v-card-actions class="pa-3">
        <v-spacer />
        <v-btn variant="text" :disabled="loading" @click="onCancel">
          {{ cancelLabel }}
        </v-btn>
        <v-btn
          :color="confirmColor"
          variant="text"
          :loading="loading"
          @click="onConfirm"
        >
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    body?: string;
    confirmLabel: string;
    cancelLabel: string;
    /** Color del botón de confirmar (p. ej. 'error' para borrados). */
    confirmColor?: string;
    /** Spinner + bloqueo mientras se ejecuta la acción async. */
    loading?: boolean;
    maxWidth?: number | string;
  }>(),
  {
    body: '',
    confirmColor: 'primary',
    loading: false,
    maxWidth: 420,
  },
);
const emit = defineEmits<{
  'update:modelValue': [boolean];
  confirm: [];
  cancel: [];
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

function onConfirm(): void {
  emit('confirm');
}
function onCancel(): void {
  emit('cancel');
  open.value = false;
}
</script>
