<template>
  <!-- Control de bloqueo minimalista: solo candado clicable + label.
       locked = candado CERRADO rojo + label rojo en negrita;
       libre  = candado ABIERTO verde + label normal.
       Tanto el icono como el texto son clicables (toda la fila alterna).
       El modelo usa el patrón enum('S','N') del ERP: 'S' = bloqueado. -->
  <div
    class="cm-lock-switch"
    :class="{ 'is-locked': isLocked }"
    role="button"
    tabindex="0"
    :aria-label="label"
    :aria-pressed="isLocked"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <v-icon
      :icon="isLocked ? mdiLock : mdiLockOpenVariant"
      :color="isLocked ? 'error' : 'success'"
      size="20"
      class="cm-lock-switch__icon"
    />
    <span class="cm-lock-switch__label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { mdiLock, mdiLockOpenVariant } from '@mdi/js';

const props = defineProps<{
  /**
   * Valor actual. Acepta el enum ERP 'S'/'N' o un boolean. Se tipa como
   * `unknown` porque los formularios usan `Record<string, unknown>`; la
   * coerción a estado bloqueado/libre se hace internamente.
   */
  modelValue: unknown;
  label: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string | boolean] }>();

// Detecta si el binding es booleano o el enum 'S'/'N', para emitir en el mismo tipo.
const isBool = computed(() => typeof props.modelValue === 'boolean');
const isLocked = computed(() =>
  isBool.value ? props.modelValue === true : props.modelValue === 'S',
);

function emitLocked(locked: boolean): void {
  emit('update:modelValue', isBool.value ? locked : locked ? 'S' : 'N');
}
function toggle(): void {
  emitLocked(!isLocked.value);
}
</script>

<style scoped>
.cm-lock-switch {
  display: flex;
  align-items: center;
  gap: var(--cm-space-sm, 8px);
  min-height: 40px;
  cursor: pointer;
  outline: none;
  border-radius: var(--cm-radius-sm, 4px);
  user-select: none;
}
.cm-lock-switch:focus-visible {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.4);
}
.cm-lock-switch__icon {
  flex: 0 0 auto;
}
.cm-lock-switch__label {
  font-size: var(--cm-fs-base, 13px);
  color: var(--cm-text-secondary, #4a4f57);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cm-lock-switch.is-locked .cm-lock-switch__label {
  color: var(--cm-danger, #a8231c);
  font-weight: var(--cm-fw-semibold, 600);
}
</style>
