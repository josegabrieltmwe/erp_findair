<template>
  <CmEntitySelect
    :model-value="modelValue"
    cache-key="internal_roles"
    :fetcher="fetchRoles"
    :format-primary="formatPrimary"
    :format-secondary="formatSecondary"
    :label="label || t('internal_roles.selector_label')"
    :placeholder="placeholder"
    :hint="hint"
    :disabled="disabled"
    :clearable="clearable"
    :multiple="multiple"
    :rules="rules"
    show-id
    @update:model-value="onUpdate"
    @select="onSelect"
  />
</template>

<script setup lang="ts">
/**
 * CmInternalRoleSelect — selector de rol interno (RBAC). Carga todos los
 * roles vía caché compartida. Soporta selección única o múltiple (p. ej.
 * asignar varios roles a un usuario).
 */
import { useI18n } from 'vue-i18n';
import CmEntitySelect from '../../listini/components/CmEntitySelect.vue';
import { internalRolesService, type InternalRoleLite } from '../services/internalRoles.service';

interface Props {
  modelValue: number | number[] | null;
  multiple?: boolean;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  rules?: Array<(v: unknown) => boolean | string>;
}

withDefaults(defineProps<Props>(), {
  multiple: false,
  label: '',
  placeholder: undefined,
  hint: undefined,
  disabled: false,
  clearable: true,
  rules: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: number | number[] | null];
  select: [option: InternalRoleLite | InternalRoleLite[] | null];
}>();

const { t } = useI18n();

function fetchRoles(): Promise<InternalRoleLite[]> {
  return internalRolesService.list();
}

function formatPrimary(r: InternalRoleLite): string {
  return r.name;
}

function formatSecondary(r: InternalRoleLite): string | undefined {
  return r.description || r.slug;
}

function onUpdate(v: number | string | (number | string)[] | null): void {
  if (Array.isArray(v)) {
    emit('update:modelValue', v.map((x) => (typeof x === 'string' ? parseInt(x, 10) : x)));
  } else {
    emit('update:modelValue', typeof v === 'string' ? parseInt(v, 10) : v);
  }
}

function onSelect(opt: InternalRoleLite | InternalRoleLite[] | null): void {
  emit('select', opt);
}
</script>
