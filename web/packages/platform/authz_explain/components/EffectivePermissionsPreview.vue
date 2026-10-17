<template>
  <div class="effective-perms-preview">
    <div v-if="loading" class="epp-loading">
      <v-progress-circular indeterminate size="20" width="2" color="primary" />
      <span class="ml-2 text-caption">{{ t('common.loading') }}</span>
    </div>

    <v-alert
      v-else-if="error"
      type="error"
      variant="tonal"
      density="compact"
    >
      {{ error }}
    </v-alert>

    <div v-else-if="!hasTarget" class="epp-empty">
      {{ t('authz_explain.effective_perms.no_target') }}
    </div>

    <div v-else class="epp-body">
      <div class="epp-header">
        <v-icon size="small" :icon="mdiKeyVariant" class="mr-1" />
        <span class="epp-title">{{ t('authz_explain.effective_perms.title') }}</span>
        <v-chip size="x-small" variant="tonal" class="ml-2">
          {{ t('authz_explain.effective_perms.scope_count', { n: effectiveScopes.length }) }}
        </v-chip>
      </div>

      <div v-if="resultLabel" class="epp-result">
        <v-icon
          :icon="result?.allowed ? mdiCheckCircle : mdiCloseCircle"
          :color="result?.allowed ? 'success' : 'error'"
          size="small"
          class="mr-1"
        />
        <span :class="result?.allowed ? 'text-success' : 'text-error'">
          {{ resultLabel }}
        </span>
        <span v-if="result" class="epp-reason"> · {{ result.reason }} </span>
      </div>

      <div v-if="effectiveScopes.length > 0" class="epp-scope-list">
        <div class="epp-section-label">{{ t('authz_explain.effective_perms.scopes') }}</div>
        <div class="epp-chips-row">
          <v-chip
            v-for="scope in effectiveScopes"
            :key="scope"
            size="x-small"
            variant="tonal"
            color="primary"
            class="epp-scope-chip"
          >
            {{ scope }}
          </v-chip>
        </div>
      </div>

      <div v-else-if="!loading" class="epp-empty">
        {{ t('authz_explain.effective_perms.no_scopes') }}
      </div>

      <div v-if="contributingFlags.length > 0" class="epp-contribution">
        <div class="epp-section-label">{{ t('authz_explain.effective_perms.contributed_by') }}</div>
        <div class="epp-chips-row">
          <v-chip
            v-for="flag in contributingFlags"
            :key="flag"
            size="x-small"
            variant="outlined"
            color="warning"
            class="epp-flag-chip"
          >
            {{ flag }}
          </v-chip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * EffectivePermissionsPreview — muestra los scopes efectivos y la decisión
 * de authz para un target (user humano u oauth_client) sobre un endpoint
 * específico.
 *
 * Si no se proporciona endpoint, hace un "snapshot" usando un endpoint
 * neutral (`ext_my_shipments` GET) solo para obtener la lista de scopes
 * intersectados — sin probar acceso real.
 *
 * Debounce de 500ms para re-cómputo cuando cambian los inputs (p. ej. el
 * operador toca un checkbox en AuthFlagsEditor).
 *
 * NOTA: el cómputo del backend es dry-run; nunca causa side-effects.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiKeyVariant,
  mdiCheckCircle,
  mdiCloseCircle,
} from '@mdi/js';
import {
  authzExplainService,
  type AuthzExplainResult,
  type AuthzTargetType,
  type HttpMethod,
} from '../services/authzExplain.service';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    targetType: AuthzTargetType | null;
    targetId: number | null;
    /** Endpoint a evaluar. Si se omite, hace snapshot con endpoint neutral. */
    endpoint?: string;
    method?: HttpMethod;
    /** Token de re-fetch — cambia para forzar refetch (p. ej. tras guardar). */
    refreshKey?: number | string;
  }>(),
  {
    endpoint: 'ext_my_shipments',
    method: 'GET',
    refreshKey: 0,
  },
);

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<AuthzExplainResult | null>(null);

const hasTarget = computed(
  () => props.targetType !== null && (props.targetId ?? 0) > 0,
);

const effectiveScopes = computed(() => result.value?.effective_scopes ?? []);

const contributingFlags = computed(() => {
  const c = result.value?.auth_flags_contribution ?? {};
  return Object.keys(c);
});

const resultLabel = computed(() => {
  if (!result.value) return null;
  return result.value.allowed
    ? t('authz_explain.effective_perms.allowed')
    : t('authz_explain.effective_perms.denied');
});

let debounceHandle: number | null = null;

async function fetchExplain(): Promise<void> {
  if (!hasTarget.value || props.targetId === null || props.targetType === null) {
    result.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    result.value = await authzExplainService.explain({
      targetType: props.targetType,
      targetId: props.targetId,
      endpoint: props.endpoint,
      method: props.method,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    error.value = msg;
    result.value = null;
  } finally {
    loading.value = false;
  }
}

function scheduleFetch(): void {
  if (debounceHandle !== null) {
    window.clearTimeout(debounceHandle);
  }
  debounceHandle = window.setTimeout(() => {
    debounceHandle = null;
    void fetchExplain();
  }, 500);
}

watch(
  () => [props.targetType, props.targetId, props.endpoint, props.method, props.refreshKey],
  () => scheduleFetch(),
  { immediate: true },
);
</script>

<style scoped>
.effective-perms-preview {
  padding: 0.75rem 1rem;
  background-color: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 6px;
  border-left: 3px solid rgb(var(--v-theme-primary));
}

.epp-loading,
.epp-empty {
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  display: flex;
  align-items: center;
}

.epp-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.epp-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.epp-result {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.epp-reason {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.75rem;
  opacity: 0.8;
}

.epp-section-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 0.35rem;
  margin-top: 0.5rem;
}

.epp-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.epp-scope-chip,
.epp-flag-chip {
  font-family: ui-monospace, SFMono-Regular, monospace !important;
  font-size: 0.7rem !important;
}
</style>
