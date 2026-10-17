<template>
  <div class="authz-explain-page">
    <CmSectionHeader
      :title="t('authz_explain.title')"
      :subtitle="t('authz_explain.subtitle')"
    />

    <!-- Snapshot de salud -->
    <v-card class="mb-4" variant="outlined">
      <v-card-text class="py-3">
        <div class="aep-health-row">
          <div class="aep-health-item">
            <div class="aep-health-label">{{ t('authz_explain.health_oauth_clients') }}</div>
            <div class="aep-health-value">{{ health.oauth_clients_active ?? '—' }}</div>
          </div>
          <div class="aep-health-item">
            <div class="aep-health-label">{{ t('authz_explain.health_with_role') }}</div>
            <div class="aep-health-value">
              {{ health.oauth_clients_with_role ?? '—' }}
              <span v-if="health.oauth_clients_active" class="aep-health-pct">
                ({{ rolePercentage }}%)
              </span>
            </div>
          </div>
          <div class="aep-health-item">
            <div class="aep-health-label">{{ t('authz_explain.health_capabilities') }}</div>
            <div class="aep-health-value">{{ health.capabilities ?? '—' }}</div>
          </div>
          <div class="aep-health-item">
            <div class="aep-health-label">{{ t('authz_explain.health_audit_24h') }}</div>
            <div class="aep-health-value">{{ health.audit_24h ?? '—' }}</div>
          </div>
          <div class="aep-health-spacer" />
          <v-btn
            size="x-small"
            variant="text"
            :prepend-icon="mdiRefresh"
            :loading="healthLoading"
            @click="loadHealth"
          >
            {{ t('common.refresh') }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card class="mb-4" variant="outlined">
      <v-card-text>
        <v-form @submit.prevent="onExplain">
          <v-row dense>
            <!-- Tipo de target -->
            <v-col cols="12" md="3">
              <v-select
                v-model="targetType"
                :items="targetTypeItems"
                :label="t('authz_explain.target_type')"
                density="comfortable"
                variant="outlined"
                @update:model-value="onTargetTypeChange"
              />
            </v-col>

            <!-- Selector de target (client o user) -->
            <v-col cols="12" md="5">
              <CmOAuthClientAutocomplete
                v-if="targetType === 'client'"
                v-model="targetIdClient"
                :label="t('authz_explain.target_client')"
                clearable
              />
              <CmUserAutocomplete
                v-else
                v-model="targetIdUser"
                :label="t('authz_explain.target_user')"
                clearable
              />
            </v-col>

            <!-- Método -->
            <v-col cols="6" md="2">
              <v-select
                v-model="method"
                :items="methodItems"
                :label="t('authz_explain.method')"
                density="comfortable"
                variant="outlined"
              />
            </v-col>

            <!-- Enviar -->
            <v-col cols="6" md="2" class="d-flex align-center">
              <v-btn
                color="primary"
                :loading="loading"
                :disabled="!canSubmit"
                block
                :prepend-icon="mdiMagnify"
                @click="onExplain"
              >
                {{ t('authz_explain.explain_button') }}
              </v-btn>
            </v-col>

            <!-- Endpoint -->
            <v-col cols="12">
              <v-text-field
                v-model="endpoint"
                :label="t('authz_explain.endpoint')"
                :hint="t('authz_explain.endpoint_hint')"
                persistent-hint
                density="comfortable"
                variant="outlined"
                :prepend-inner-icon="mdiApi"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>

    <!-- Resultado -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
      closable
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>

    <v-card v-if="result" :variant="result.allowed ? 'tonal' : 'outlined'">
      <v-card-title>
        <v-icon
          :icon="result.allowed ? mdiCheckCircle : mdiCloseCircle"
          :color="result.allowed ? 'success' : 'error'"
          class="mr-2"
        />
        {{
          result.allowed
            ? t('authz_explain.result_allowed')
            : t('authz_explain.result_denied')
        }}
        <v-chip size="small" variant="tonal" class="ml-3">
          {{ result.reason }}
        </v-chip>
        <v-spacer />
        <v-chip size="small" variant="tonal" class="ml-1">
          {{ t('authz_explain.via', { layer: result.via }) }}
        </v-chip>
      </v-card-title>

      <v-card-text>
        <!-- Subject -->
        <div class="aep-section">
          <div class="aep-section-title">{{ t('authz_explain.subject') }}</div>
          <div class="aep-subject">{{ result.subject.label }}</div>
          <div class="aep-meta">
            <span>auth_mode: <code>{{ result.subject.auth_mode }}</code></span>
            <span v-if="result.subject.user_id"
              >· user_id: <code>{{ result.subject.user_id }}</code></span
            >
            <span v-if="result.subject.anagrafica_id"
              >· anag: <code>{{ result.subject.anagrafica_id }}</code></span
            >
          </div>
        </div>

        <!-- Endpoint -->
        <div class="aep-section">
          <div class="aep-section-title">{{ t('authz_explain.endpoint_info') }}</div>
          <div class="aep-endpoint">
            <code>{{ result.endpoint.method }} {{ result.endpoint.action }}</code>
            <v-chip size="x-small" variant="tonal" class="ml-2">
              {{ result.endpoint.audience }}
            </v-chip>
          </div>
          <div class="aep-meta">
            policy:
            <code>{{ formatPolicy(result.endpoint.policy) }}</code>
          </div>
        </div>

        <!-- Cadena de decisión -->
        <div class="aep-section">
          <div class="aep-section-title">{{ t('authz_explain.decision_chain') }}</div>
          <div class="aep-chain">
            <div
              v-for="(step, idx) in result.chain"
              :key="idx"
              class="aep-chain-step"
              :class="`aep-step-${step.result}`"
            >
              <div class="aep-step-icon">
                <v-icon size="small" :icon="iconForResult(step.result)" />
              </div>
              <div class="aep-step-body">
                <div class="aep-step-layer">
                  {{ idx + 1 }}. {{ step.layer }}
                </div>
                <div class="aep-step-reason">{{ step.reason }}</div>
              </div>
              <v-chip
                size="x-small"
                :color="colorForResult(step.result)"
                variant="tonal"
              >
                {{ step.result }}
              </v-chip>
            </div>
          </div>
        </div>

        <!-- Scopes efectivos -->
        <div v-if="result.effective_scopes.length > 0" class="aep-section">
          <div class="aep-section-title">{{ t('authz_explain.effective_scopes') }}</div>
          <div class="aep-chips-row">
            <v-chip
              v-for="scope in result.effective_scopes"
              :key="scope"
              size="x-small"
              variant="tonal"
              color="primary"
              class="aep-scope-chip"
            >
              {{ scope }}
            </v-chip>
          </div>
        </div>

        <!-- Requerido -->
        <div class="aep-section">
          <div class="aep-section-title">{{ t('authz_explain.required') }}</div>
          <pre class="aep-json">{{ formatPolicy(result.required) }}</pre>
        </div>

        <!-- Pista de cómo arreglar (cuando se deniega) -->
        <v-alert
          v-if="!result.allowed && fixHint"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-3"
          :icon="mdiLightbulbOutline"
        >
          <strong>{{ t('authz_explain.how_to_fix') }}:</strong>
          {{ fixHint }}
        </v-alert>
      </v-card-text>
    </v-card>

    <v-card v-else-if="!loading && !error" variant="outlined">
      <v-card-text class="text-medium-emphasis text-center py-8">
        <v-icon :icon="mdiTextSearch" size="48" class="mb-2 opacity-60" />
        <div>{{ t('authz_explain.idle_hint') }}</div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
/**
 * Herramienta de debugging de autorización — Fase A4 del plan de
 * deprecación de `admin_config` (docs/plan-deprecacion-admin-config.md).
 * Portado desde `admin_config/src/features/authz_explain/
 * AuthzExplainPage.vue`. UI de debugging admin para responder "¿por qué
 * este cliente/usuario tiene/no tiene acceso al endpoint X?".
 *
 * Solo accesible para TMWE admin (gating en backend).
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiMagnify,
  mdiCheckCircle,
  mdiCloseCircle,
  mdiApi,
  mdiLightbulbOutline,
  mdiTextSearch,
  mdiSkipNext,
  mdiCheckBold,
  mdiCancel,
  mdiAlertCircle,
  mdiRefresh,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmUserAutocomplete from '../../oauth_clients/components/CmUserAutocomplete.vue';
import CmOAuthClientAutocomplete from '../../oauth_clients/components/CmOAuthClientAutocomplete.vue';
import {
  authzExplainService,
  type AuthzExplainResult,
  type AuthzTargetType,
  type HttpMethod,
} from '../services/authzExplain.service';
import { oauthClientsService } from '../../oauth_clients/services/oauthClients.service';
import { oauthRolesService } from '../../oauth_roles/services/oauthRoles.service';

const { t } = useI18n();

const targetType = ref<AuthzTargetType>('client');
const targetIdClient = ref<number | null>(null);
const targetIdUser = ref<number | null>(null);
const endpoint = ref<string>('ext_my_shipments');
const method = ref<HttpMethod>('GET');

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<AuthzExplainResult | null>(null);

// Snapshot de salud
interface HealthSnapshot {
  oauth_clients_active: number | null;
  oauth_clients_with_role: number | null;
  capabilities: number | null;
  audit_24h: number | null;
}
const health = ref<HealthSnapshot>({
  oauth_clients_active: null,
  oauth_clients_with_role: null,
  capabilities: null,
  audit_24h: null,
});
const healthLoading = ref(false);

const rolePercentage = computed(() => {
  const active = health.value.oauth_clients_active ?? 0;
  const withRole = health.value.oauth_clients_with_role ?? 0;
  if (active === 0) return 0;
  return Math.round((withRole / active) * 100);
});

async function loadHealth(): Promise<void> {
  healthLoading.value = true;
  try {
    // Consultas en paralelo a endpoints ya existentes (sin backend nuevo).
    const [allClients, rolesList] = await Promise.all([
      oauthClientsService.list({ status: 'active' }),
      oauthRolesService.list(),
    ]);
    health.value.oauth_clients_active = allClients.length;
    health.value.oauth_clients_with_role = allClients.filter(
      (c) => (c.role_id ?? null) !== null,
    ).length;
    health.value.capabilities = rolesList.filter((r) => r.stato !== 'O').length;
    // Conteo de auditoría últimas 24h: el backend aún no expone una query
    // de conteo. Se omite el número (renderiza '—') en vez de correr un
    // proxy engañoso.
    health.value.audit_24h = null;
  } catch (e) {
    // Soft-fail: la salud es informativa, no bloqueante.
    console.warn('[AuthzExplainPage] health snapshot failed', e);
  } finally {
    healthLoading.value = false;
  }
}

void loadHealth();

const targetTypeItems = computed(() => [
  { title: t('authz_explain.target_type_client'), value: 'client' as AuthzTargetType },
  { title: t('authz_explain.target_type_user'), value: 'user' as AuthzTargetType },
]);

const methodItems: { title: string; value: HttpMethod }[] = [
  { title: 'GET', value: 'GET' },
  { title: 'POST', value: 'POST' },
  { title: 'PUT', value: 'PUT' },
  { title: 'PATCH', value: 'PATCH' },
  { title: 'DELETE', value: 'DELETE' },
];

const currentTargetId = computed(() =>
  targetType.value === 'client' ? targetIdClient.value : targetIdUser.value,
);

const canSubmit = computed(
  () =>
    !loading.value &&
    (currentTargetId.value ?? 0) > 0 &&
    endpoint.value.trim().length > 0,
);

function onTargetTypeChange(): void {
  result.value = null;
  error.value = null;
}

async function onExplain(): Promise<void> {
  if (!canSubmit.value || currentTargetId.value === null) return;
  loading.value = true;
  error.value = null;
  try {
    result.value = await authzExplainService.explain({
      targetType: targetType.value,
      targetId: currentTargetId.value,
      endpoint: endpoint.value.trim(),
      method: method.value,
    });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e);
    result.value = null;
  } finally {
    loading.value = false;
  }
}

const fixHint = computed<string | null>(() => {
  if (!result.value || result.value.allowed) return null;
  switch (result.value.reason) {
    case 'oauth_insufficient_scope':
      return t('authz_explain.fix_hint_oauth_scope');
    case 'admin_only_endpoint':
      return t('authz_explain.fix_hint_admin_only');
    case 'endpoint_blacklisted':
      return t('authz_explain.fix_hint_endpoint_blacklisted');
    case 'endpoint_not_in_whitelist':
      return t('authz_explain.fix_hint_endpoint_not_whitelisted');
    case 'override_deny':
      return t('authz_explain.fix_hint_override_deny');
    case 'no_grant':
      return t('authz_explain.fix_hint_no_grant');
    default:
      return null;
  }
});

function iconForResult(r: string): string {
  switch (r) {
    case 'grant':
      return mdiCheckBold;
    case 'deny':
      return mdiCancel;
    case 'error':
      return mdiAlertCircle;
    case 'pass':
      return mdiCheckCircle;
    case 'skip':
    default:
      return mdiSkipNext;
  }
}

function colorForResult(r: string): string {
  switch (r) {
    case 'grant':
    case 'pass':
      return 'success';
    case 'deny':
      return 'error';
    case 'error':
      return 'warning';
    case 'skip':
    default:
      return 'grey';
  }
}

function formatPolicy(p: unknown): string {
  return JSON.stringify(p, null, 2);
}
</script>

<style scoped>
.authz-explain-page {
  max-width: 1100px;
}

.aep-section {
  margin-top: 1rem;
}

.aep-section-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 0.35rem;
}

.aep-subject,
.aep-endpoint {
  font-size: 0.9rem;
}

.aep-meta {
  font-size: 0.78rem;
  opacity: 0.7;
  margin-top: 0.15rem;
}

.aep-meta code,
.aep-endpoint code {
  font-family: ui-monospace, SFMono-Regular, monospace;
  background: rgba(var(--v-theme-on-surface), 0.06);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-size: 0.78rem;
}

.aep-chain {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.aep-chain-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  border-left: 3px solid transparent;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.aep-step-grant {
  border-left-color: rgb(var(--v-theme-success));
}

.aep-step-deny {
  border-left-color: rgb(var(--v-theme-error));
}

.aep-step-pass {
  border-left-color: rgb(var(--v-theme-success));
  opacity: 0.85;
}

.aep-step-skip {
  border-left-color: rgba(var(--v-theme-on-surface), 0.15);
  opacity: 0.6;
}

.aep-step-error {
  border-left-color: rgb(var(--v-theme-warning));
}

.aep-step-icon {
  flex: 0 0 auto;
}

.aep-step-body {
  flex: 1 1 auto;
}

.aep-step-layer {
  font-weight: 500;
  font-size: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.aep-step-reason {
  font-size: 0.78rem;
  opacity: 0.7;
}

.aep-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.aep-scope-chip {
  font-family: ui-monospace, SFMono-Regular, monospace !important;
  font-size: 0.7rem !important;
}

.aep-json {
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.aep-health-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.aep-health-item {
  min-width: 110px;
}

.aep-health-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.aep-health-value {
  font-size: 1.4rem;
  font-weight: 500;
}

.aep-health-pct {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-left: 0.25rem;
}

.aep-health-spacer {
  flex: 1 1 auto;
}
</style>
