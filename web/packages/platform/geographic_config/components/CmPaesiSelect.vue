<template>
  <CmEntitySelect
    :model-value="modelValue"
    cache-key="paesi"
    :fetcher="fetchPaesi"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :label="label || t('selectors.country')"
    :placeholder="placeholder"
    :hint="hint"
    :disabled="disabled"
    :clearable="clearable"
    :rules="rules"
    @update:model-value="onUpdate"
    @select="onSelect"
  >
    <template #item="{ item, props: itemProps }">
      <v-list-item v-bind="itemProps" :title="undefined">
        <div class="cm-paese-row">
          <CmCountryFlag :iso="(item as PaeseLite).ISO" :size="18" />
          <span>{{ formatPrimary(item as PaeseLite) }}</span>
        </div>
      </v-list-item>
    </template>
  </CmEntitySelect>
</template>

<script setup lang="ts">
/**
 * CmPaesiSelect — Country selector (paesi_iso).
 *
 * Loads all active countries once via shared cache. Uses Italian name
 * as primary label by default; pass `language="en"` to use nomeEN.
 */
import { useI18n } from 'vue-i18n';
import CmEntitySelect from '../../listini/components/CmEntitySelect.vue';
import CmCountryFlag from './CmCountryFlag.vue';
import { paesiService, type PaeseLite } from '../services/paesi.service';

interface Props {
  modelValue: number | null;
  language?: 'it' | 'en';
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
}

const props = withDefaults(defineProps<Props>(), {
  language: 'it',
  label: '',
  placeholder: undefined,
  hint: undefined,
  disabled: false,
  clearable: true,
  rules: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
  select: [option: PaeseLite | null];
}>();

const { t } = useI18n();

function fetchPaesi(): Promise<PaeseLite[]> {
  return paesiService.list();
}

function formatPrimary(p: PaeseLite): string {
  const name = props.language === 'en' && p.nomeEN ? p.nomeEN : p.nome;
  // NOTE: in paesi_iso the 2-letter country code lives in `ISO` (AL, IT, NL...).
  // `ISO2` is a secondary subdivision code (US states) and is NULL for countries
  // — hence the old "null — Albania". Use ISO for the country code.
  return p.ISO ? `${p.ISO} — ${name}` : name;
}

function formatSecondary(): string | undefined {
  return undefined;
}

function onUpdate(v: number | string | (number | string)[] | null): void {
  if (Array.isArray(v)) return; // single-select only
  emit('update:modelValue', typeof v === 'string' ? parseInt(v, 10) : v);
}

function onSelect(opt: PaeseLite | PaeseLite[] | null): void {
  emit('select', Array.isArray(opt) ? (opt[0] ?? null) : opt);
}
</script>

<style scoped>
.cm-paese-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
