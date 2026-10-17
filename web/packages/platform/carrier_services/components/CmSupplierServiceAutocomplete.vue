<template>
  <CmEntityAutocomplete
    :model-value="modelValue"
    :fetcher="fetch"
    :item-getter="getItem"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :initial-option="initialOption"
    :label="label || t('selectors.supplier_service')"
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
import { supplierServiceService, type CarrierService } from '../services/supplierService.service';

interface Props {
  modelValue: number | null;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
  initialOption?: CarrierService | null;
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
  select: [option: CarrierService | null];
}>();

const { t } = useI18n();

function fetch(q: string, perPage?: number): Promise<CarrierService[]> {
  return supplierServiceService.search(q, perPage ?? 25);
}

function getItem(id: number | string): Promise<CarrierService | null> {
  return supplierServiceService.getById(typeof id === 'number' ? id : parseInt(id, 10));
}

function formatPrimary(s: CarrierService): string {
  return s.descr || `#${s.id}`;
}

function formatSecondary(s: CarrierService): string | undefined {
  return [s.tipo, s.from_paese_iso].filter(Boolean).join(' · ') || undefined;
}

function onUpdate(v: number | string | null): void {
  emit('update:modelValue', typeof v === 'string' ? parseInt(v, 10) : v);
}

function onSelect(opt: CarrierService | null): void {
  emit('select', opt);
}
</script>
