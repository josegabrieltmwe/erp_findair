<template>
  <CmEntityAutocomplete
    :model-value="modelValue"
    :fetcher="fetch"
    :item-getter="getItem"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :initial-option="initialOption"
    :parent-id="anagraficaId ?? null"
    :label="label || t('oauth_clients.form_user')"
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
/**
 * CmUserAutocomplete — selector de usuario para el diálogo de provisión de
 * OAuth clients (Fase A1). Usa `/api_admin_users?search=` (nome, mail,
 * loginn, anagrafica.rag_soc). Cuando `anagraficaId` está presente, filtra
 * por ese partner.
 */
import { useI18n } from 'vue-i18n';
import CmEntityAutocomplete from '../../listini/components/CmEntityAutocomplete.vue';
import { usersService, type UserLite } from '../services/users.service';

interface Props {
  modelValue: number | null;
  anagraficaId?: number | null;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
  initialOption?: UserLite | null;
}

const props = withDefaults(defineProps<Props>(), {
  anagraficaId: null,
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
  select: [option: UserLite | null];
}>();

const { t } = useI18n();

function fetch(q: string, perPage?: number): Promise<UserLite[]> {
  const partnerId = props.anagraficaId ?? undefined;
  return usersService.search(q, perPage ?? 25, partnerId ?? undefined);
}

function getItem(id: number | string): Promise<UserLite | null> {
  return usersService.getById(typeof id === 'number' ? id : parseInt(id, 10));
}

function formatPrimary(u: UserLite): string {
  return u.nome || u.loginn || u.mail || `User #${u.id}`;
}

function formatSecondary(u: UserLite): string | undefined {
  const parts: string[] = [];
  if (u.mail && u.mail !== formatPrimary(u)) parts.push(u.mail);
  if (u.rag_soc) parts.push(u.rag_soc);
  return parts.length ? parts.join(' · ') : undefined;
}

function onUpdate(v: number | string | null): void {
  emit('update:modelValue', typeof v === 'string' ? parseInt(v, 10) : v);
}

function onSelect(opt: UserLite | null): void {
  emit('select', opt);
}
</script>
