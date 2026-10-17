<template>
  <div class="capability-selector">
    <v-select
      :model-value="modelValue"
      :items="items"
      :label="label || t('client_onboarding.capability_label')"
      :placeholder="placeholder || t('client_onboarding.capability_placeholder')"
      item-title="display_name"
      item-value="id"
      :loading="loading"
      :disabled="disabled"
      :clearable="clearable"
      :rules="rules"
      :hint="selectedHint"
      :persistent-hint="!!selectedHint"
      density="comfortable"
      variant="outlined"
      @update:model-value="onChange"
    >
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" :title="undefined">
          <template #title>
            <div class="cs-item-title">
              <span class="cs-item-name">{{ item.raw.display_name }}</span>
              <v-chip size="x-small" variant="tonal" class="ml-2">
                {{ item.raw.role_name }}
              </v-chip>
            </div>
          </template>
          <template #subtitle>
            <div class="cs-item-subtitle">
              <span v-if="item.raw.description" class="cs-item-desc">
                {{ item.raw.description }}
              </span>
              <div class="cs-item-meta">
                <span>{{
                  t('client_onboarding.capability_scope_count', {
                    n: scopesOf(item.raw).length,
                  })
                }}</span>
                <span class="mx-1">·</span>
                <span>{{
                  t('client_onboarding.capability_endpoint_count', {
                    n: endpointsOf(item.raw).length,
                  })
                }}</span>
              </div>
            </div>
          </template>
        </v-list-item>
      </template>

      <template #selection="{ item }">
        <span class="cs-selected">
          {{ item.raw.display_name }}
          <v-chip size="x-small" variant="tonal" class="ml-1">
            {{ item.raw.role_name }}
          </v-chip>
        </span>
      </template>
    </v-select>

    <!-- Preview opcional de la capability seleccionada -->
    <div v-if="selectedRole && showPreview" class="cs-preview">
      <div class="cs-preview-header">
        <v-icon size="x-small" :icon="mdiKeyVariant" class="mr-1" />
        <span class="cs-preview-title">
          {{ t('client_onboarding.capability_preview_scopes') }}
        </span>
      </div>
      <div class="cs-preview-chips">
        <v-chip
          v-for="scope in selectedScopes"
          :key="scope"
          size="x-small"
          variant="tonal"
          color="primary"
          class="cs-scope-chip"
        >
          {{ scope }}
        </v-chip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiKeyVariant } from '@mdi/js';
import { oauthRolesService, type OAuthRole } from '../../oauth_roles/services/oauthRoles.service';

/**
 * CapabilitySelector — dropdown semántico de capabilities (oauth_roles) con
 * preview de scopes. Reemplaza la selección manual de scopes uno-por-uno en
 * el wizard de onboarding (client_onboarding, Fase A3).
 *
 * El operador ve "Cargo Full Operator" (display_name) en lugar de
 * "cargo_full_operator" (slug técnico) o checkboxes individuales.
 */

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    modelValue: number | null;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    showPreview?: boolean;
    /** Filtra por audience (informativo en oauth_roles vía tag/categoría) */
    audience?: 'external_client' | 'internal_user' | 'all';
    /** Reglas Vuetify (p. ej. required) */
    rules?: Array<(v: unknown) => boolean | string>;
  }>(),
  {
    label: '',
    placeholder: '',
    disabled: false,
    clearable: true,
    showPreview: true,
    audience: 'all',
    rules: () => [],
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void;
  (e: 'capability-changed', role: OAuthRole | null): void;
}>();

const allRoles = ref<OAuthRole[]>([]);
const loading = ref(false);

const items = computed(() => {
  // Roles de sistema activos primero, luego custom; alfabético dentro del grupo.
  return allRoles.value
    .filter((r) => r.stato !== 'O')
    .sort((a, b) => {
      const sysA = a.is_system ? 0 : 1;
      const sysB = b.is_system ? 0 : 1;
      if (sysA !== sysB) return sysA - sysB;
      return (a.display_name || a.role_name).localeCompare(b.display_name || b.role_name);
    });
});

const selectedRole = computed<OAuthRole | null>(() => {
  if (props.modelValue === null) return null;
  return allRoles.value.find((r) => r.id === props.modelValue) ?? null;
});

const selectedScopes = computed(() => scopesOf(selectedRole.value));

const selectedHint = computed(() => {
  if (!selectedRole.value) return '';
  return selectedRole.value.description ?? '';
});

function scopesOf(role: OAuthRole | null): string[] {
  if (!role) return [];
  return Array.isArray(role.scopes) ? role.scopes : [];
}

function endpointsOf(role: OAuthRole): string[] {
  if (Array.isArray(role.allowed_endpoints)) return role.allowed_endpoints;
  return [];
}

function onChange(v: number | null): void {
  emit('update:modelValue', v);
  emit('capability-changed', selectedRole.value);
}

onMounted(async () => {
  loading.value = true;
  try {
    allRoles.value = await oauthRolesService.list();
  } catch (e) {
    console.error('CapabilitySelector: failed to load roles', e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.cs-item-title {
  display: flex;
  align-items: center;
}

.cs-item-name {
  font-weight: 500;
}

.cs-item-subtitle {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.cs-item-desc {
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  white-space: normal;
}

.cs-item-meta {
  font-size: 0.7rem;
  opacity: 0.6;
}

.cs-selected {
  display: inline-flex;
  align-items: center;
}

.cs-preview {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 4px;
}

.cs-preview-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.35rem;
}

.cs-preview-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.cs-preview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.cs-scope-chip {
  font-family: ui-monospace, SFMono-Regular, monospace !important;
  font-size: 0.65rem !important;
}
</style>
