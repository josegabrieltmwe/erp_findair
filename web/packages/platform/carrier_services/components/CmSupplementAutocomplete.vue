<template>
  <CmEntityAutocomplete
    :model-value="modelValue"
    :fetcher="fetch"
    :item-getter="getItem"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :initial-option="initialOption"
    :label="label || t('selectors.supplement')"
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
import CmEntityAutocomplete from '../../listini/components/CmEntityAutocomplete.vue';
import { supplementiService, type SupplementLite } from '../services/supplementi.service';

interface Props {
  modelValue: number | null;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
  initialOption?: SupplementLite | null;
}

withDefaults(defineProps<Props>(), {
  label: '',
  placeholder: undefined,
  hint: undefined,
  disabled: false,
  clearable: true,
  rules: () => [],
  initialOption: null,
});

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
  select: [option: SupplementLite | null];
}>();

const { t } = useI18n();

function fetch(q: string, perPage?: number): Promise<SupplementLite[]> {
  return supplementiService.search(q, perPage ?? 25);
}

function getItem(id: number | string): Promise<SupplementLite | null> {
  return supplementiService.getById(typeof id === 'number' ? id : parseInt(id, 10));
}

function formatPrimary(s: SupplementLite): string {
  return s.nome;
}

function formatSecondary(s: SupplementLite): string | undefined {
  return s.nome_EN && s.nome_EN !== s.nome ? s.nome_EN : undefined;
}

function onUpdate(v: number | string | null): void {
  emit('update:modelValue', typeof v === 'string' ? parseInt(v, 10) : v);
}

function onSelect(opt: SupplementLite | null): void {
  emit('select', opt);
}
</script>
