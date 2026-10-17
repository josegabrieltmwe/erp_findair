<template>
  <CmEntitySelect
    :model-value="modelValue"
    cache-key="oauth_roles"
    :fetcher="fetchRoles"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :filter="filterRole"
    :item-disabled="isRoleDisabled"
    :label="label || t('oauth_clients.form_oauth_role')"
    :placeholder="placeholder"
    :hint="hint"
    :disabled="disabled"
    :clearable="clearable"
    :multiple="multiple"
    :rules="rules"
    @update:model-value="onUpdate"
    @select="onSelect"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CmEntitySelect from '../../listini/components/CmEntitySelect.vue';
import {
  oauthRolesService,
  isInternalOnlyRole,
  type OAuthRoleLite,
} from '../services/oauthRoles.service';

interface Props {
  modelValue: number | number[] | null;
  multiple?: boolean;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
  /**
   * Roles con scopes restringidos (`internal_only`): `show` los lista sin
   * más, `disable` los deja visibles pero no seleccionables (con la marca
   * "solo clients internos"), `hide` los quita de la lista. Para clients
   * OAuth externos usar `disable`; para contactos que no son de TMWE, `hide`.
   */
  internalOnly?: 'show' | 'disable' | 'hide';
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  label: '',
  placeholder: undefined,
  hint: undefined,
  disabled: false,
  clearable: true,
  rules: () => [],
  internalOnly: 'show',
});

const emit = defineEmits<{
  'update:modelValue': [value: number | number[] | null];
  select: [option: OAuthRoleLite | OAuthRoleLite[] | null];
}>();

const { t } = useI18n();

function fetchRoles(): Promise<OAuthRoleLite[]> {
  return oauthRolesService.list();
}

function formatPrimary(r: OAuthRoleLite): string {
  return r.display_name || r.role_name;
}

function formatSecondary(r: OAuthRoleLite): string | undefined {
  const base = r.description || r.role_name;
  if (props.internalOnly === 'disable' && isInternalOnlyRole(r)) {
    return `${base} · ${t('oauth_roles.internal_only_badge')}`;
  }
  return base;
}

function filterRole(r: OAuthRoleLite): boolean {
  return props.internalOnly === 'hide' ? !isInternalOnlyRole(r) : true;
}

function isRoleDisabled(r: OAuthRoleLite): boolean {
  return props.internalOnly === 'disable' && isInternalOnlyRole(r);
}

function onUpdate(v: number | string | (number | string)[] | null): void {
  if (Array.isArray(v)) {
    emit('update:modelValue', v.map((x) => (typeof x === 'string' ? parseInt(x, 10) : x)));
  } else {
    emit('update:modelValue', typeof v === 'string' ? parseInt(v, 10) : v);
  }
}

function onSelect(opt: OAuthRoleLite | OAuthRoleLite[] | null): void {
  emit('select', opt);
}
</script>
