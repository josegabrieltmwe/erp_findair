<template>
  <CmEntityAutocomplete
    :model-value="modelValue"
    :fetcher="fetch"
    :item-getter="getItem"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :initial-option="initialOption"
    :label="label || t('selectors.oauth_client')"
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
import { oauthClientsService, type OAuthClientLite } from '../services/oauthClients.service';

interface Props {
  modelValue: number | null;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
  initialOption?: OAuthClientLite | null;
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
  select: [option: OAuthClientLite | null];
}>();

const { t } = useI18n();

function fetch(q: string, perPage?: number): Promise<OAuthClientLite[]> {
  return oauthClientsService.search(q, perPage ?? 25);
}

function getItem(id: number | string): Promise<OAuthClientLite | null> {
  return oauthClientsService.getById(typeof id === 'number' ? id : parseInt(id, 10));
}

function formatPrimary(c: OAuthClientLite): string {
  return c.client_name || c.client_id;
}

function formatSecondary(c: OAuthClientLite): string | undefined {
  if (c.description) return c.description;
  if (c.client_id && c.client_id !== c.client_name) return `client_id: ${c.client_id}`;
  return undefined;
}

function onUpdate(v: number | string | null): void {
  emit('update:modelValue', typeof v === 'string' ? parseInt(v, 10) : v);
}

function onSelect(opt: OAuthClientLite | null): void {
  emit('select', opt);
}
</script>
