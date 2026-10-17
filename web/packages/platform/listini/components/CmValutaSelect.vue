<template>
  <CmEntitySelect
    :model-value="modelValue"
    cache-key="valute"
    :fetcher="fetchValute"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :label="label || t('selectors.currency')"
    :placeholder="placeholder"
    :hint="hint"
    :disabled="disabled"
    :clearable="clearable"
    :rules="rules"
    @update:model-value="onUpdate"
    @select="onSelect"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CmEntitySelect from '../components/CmEntitySelect.vue';
import { valuteService, type ValutaLite } from '../services/valute.service';

interface Props {
  modelValue: number | null;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
}

withDefaults(defineProps<Props>(), {
  label: '',
  placeholder: undefined,
  hint: undefined,
  disabled: false,
  clearable: true,
  rules: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
  select: [option: ValutaLite | null];
}>();

const { t } = useI18n();

function fetchValute(): Promise<ValutaLite[]> {
  return valuteService.list();
}

function formatPrimary(v: ValutaLite): string {
  return `${v.sigla} — ${v.nome}`;
}

function formatSecondary(v: ValutaLite): string | undefined {
  return v.cambioEUR ? `1 EUR = ${v.cambioEUR} ${v.sigla}` : undefined;
}

function onUpdate(v: number | string | (number | string)[] | null): void {
  if (Array.isArray(v)) return;
  emit('update:modelValue', typeof v === 'string' ? parseInt(v, 10) : v);
}

function onSelect(opt: ValutaLite | ValutaLite[] | null): void {
  emit('select', Array.isArray(opt) ? (opt[0] ?? null) : opt);
}
</script>
