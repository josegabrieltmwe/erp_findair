<template>
  <v-text-field
    :model-value="modelValue"
    :label="label"
    :type="visible ? 'text' : 'password'"
    :hint="hint"
    :persistent-hint="!!hint"
    :placeholder="stored ? placeholder : undefined"
    :rules="rules"
    :error-messages="errorMessages"
    :append-inner-icon="visible ? mdiEyeOff : mdiEye"
    autocomplete="new-password"
    spellcheck="false"
    @update:model-value="emit('update:modelValue', $event ?? '')"
    @click:append-inner="visible = !visible"
  />
</template>

<script setup lang="ts">
/**
 * Campo de secreto de SOLO ESCRITURA (contraseña, API key): oculto por defecto, con ojo para
 * revisar lo que se escribe. Nunca recibe el valor guardado: con `stored` (ya hay uno) deja el
 * campo vacío y el `placeholder` avisa de que vacío = se conserva. Es la pieza común de los
 * formularios de credenciales; el contrato de cada API decide qué hace un vacío.
 */
import { ref } from 'vue';
import { mdiEye, mdiEyeOff } from '@mdi/js';

withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    hint?: string;
    /** Ya hay un valor guardado en el servidor (edición). */
    stored?: boolean;
    /** Texto del campo vacío cuando `stored` (p. ej. «Déjalo vacío para conservarlo»). */
    placeholder?: string;
    rules?: Array<(v: unknown) => boolean | string>;
    errorMessages?: string | string[];
  }>(),
  { hint: undefined, stored: false, placeholder: undefined, rules: () => [], errorMessages: undefined },
);
const emit = defineEmits<{ 'update:modelValue': [string] }>();
const visible = ref(false);
</script>
