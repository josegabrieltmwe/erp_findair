<template>
  <div class="ctp">
    <div class="text-caption text-medium-emphasis mb-1">{{ label }}</div>
    <div class="ctp__chips">
      <v-chip
        v-for="tok in specialTokens"
        :key="tok.value"
        size="small"
        :variant="stateOf(tok.value) ? 'flat' : 'outlined'"
        :color="chipColor(tok.value)"
        :disabled="disabled"
        @click="cycle(tok.value)"
      >
        {{ tok.label }}
      </v-chip>
    </div>

    <v-combobox
      :model-value="isoTokens"
      :items="countries"
      :label="isoHint"
      :disabled="disabled"
      multiple chips closable-chips
      density="compact" variant="outlined" hide-details
      class="mt-2"
      @update:model-value="onIsoInput"
    >
      <template #chip="{ item, props: chipProps }">
        <v-chip
          v-bind="chipProps"
          size="small"
          :color="String(item.value).startsWith('-') ? 'error' : 'success'"
          variant="flat"
        >
          {{ item.value }}
        </v-chip>
      </template>
    </v-combobox>
    <div class="text-caption text-medium-emphasis mt-1">{{ isoInstructions }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * Picker de tres estados (sin selección / incluir / excluir) para los
 * campos iso_from/iso_to de fatture_causali_new. Sintaxis de tokens:
 * `+ALL`/`-ALL`, `+CEE`/`-CEE`, `+XX`/`-XX` (ISO2). Réplica moderna de
 * GrpChg() en fatt_causali.php (toggle verde=incluir/rojo=excluir), sin
 * exponer entrada de texto libre para +ALL/+CEE — solo países concretos
 * se escriben a mano, con validación de formato ISO2.
 */

const props = defineProps<{
  modelValue: string[];
  countries: string[];
  disabled?: boolean;
  label: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [string[]] }>();

const { t } = useI18n();

const specialTokens = [
  { value: 'ALL', label: 'ALL' },
  { value: 'CEE', label: 'CEE' },
];

// Estado de un token especial: null=sin seleccionar, '+'=incluir, '-'=excluir.
function stateOf(base: string): '+' | '-' | null {
  if (props.modelValue.includes(`+${base}`)) return '+';
  if (props.modelValue.includes(`-${base}`)) return '-';
  return null;
}
function chipColor(base: string): string {
  const s = stateOf(base);
  return s === '+' ? 'success' : s === '-' ? 'error' : 'default';
}
function cycle(base: string): void {
  if (props.disabled) return;
  const current = stateOf(base);
  const rest = props.modelValue.filter((tk) => tk !== `+${base}` && tk !== `-${base}`);
  const next = current === null ? `+${base}` : current === '+' ? `-${base}` : null;
  emit('update:modelValue', next ? [...rest, next] : rest);
}

// Tokens ISO2 concretos (todo lo que no sea +ALL/-ALL/+CEE/-CEE).
const isoTokens = computed(() =>
  props.modelValue.filter((tk) => !/^[+-](ALL|CEE)$/.test(tk)),
);
function onIsoInput(values: unknown[]): void {
  const cleaned = values
    .map((v) => String(v).trim().toUpperCase())
    .filter((v) => /^[+-][A-Z]{2}$/.test(v));
  const special = props.modelValue.filter((tk) => /^[+-](ALL|CEE)$/.test(tk));
  emit('update:modelValue', [...special, ...cleaned]);
}

const isoHint = computed(() => t('invoice_causals.iso_picker_hint'));
const isoInstructions = computed(() => t('invoice_causals.iso_picker_instructions'));
</script>

<style scoped>
.ctp__chips { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
