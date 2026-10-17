<template>
  <div>
    <CmSectionHeader
      :title="t('client_onboarding.title')"
      :subtitle="t('client_onboarding.subtitle')"
    />

    <v-stepper v-model="step" alt-labels>
      <v-stepper-header>
        <v-stepper-item :complete="step > 1" :value="1" :title="t('client_onboarding.step1')" />
        <v-divider />
        <v-stepper-item :complete="step > 2" :value="2" :title="t('client_onboarding.step2')" />
        <v-divider />
        <v-stepper-item :complete="step > 3" :value="3" :title="t('client_onboarding.step3')" />
        <v-divider />
        <v-stepper-item :complete="step > 4" :value="4" :title="t('client_onboarding.step4_confirm')" />
        <v-divider />
        <v-stepper-item :complete="step > 5" :value="5" :title="t('client_onboarding.step5_test')" />
      </v-stepper-header>

      <v-stepper-window>
        <!-- Paso 1: elegir empresa -->
        <v-stepper-window-item :value="1">
          <v-card variant="outlined" class="pa-4">
            <CmAnagraficaAutocomplete
              v-model="anagraficaId"
              :label="t('client_onboarding.search_company')"
            />
            <div class="d-flex justify-end mt-4">
              <v-btn color="primary" :disabled="!anagraficaId" @click="goToUsers">
                {{ t('client_onboarding.continue') }}
              </v-btn>
            </div>
          </v-card>
        </v-stepper-window-item>

        <!-- Paso 2: elegir o crear usuario -->
        <v-stepper-window-item :value="2">
          <CmAsyncSection
            :loading="loadingUsers"
            :error="usersError"
            :empty="!loadingUsers && !usersError && users.length === 0"
            :data="users"
            @clear-error="usersError = null"
          >
            <template #empty>
              <CmEmptyState :icon="mdiAccount" :title="t('client_onboarding.no_users_title')">
                <p>{{ t('client_onboarding.no_users_message') }}</p>
              </CmEmptyState>
            </template>

            <template #default>
              <v-card variant="outlined">
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th></th>
                      <th>{{ t('client_onboarding.col_name') }}</th>
                      <th>{{ t('client_onboarding.col_email') }}</th>
                      <th>{{ t('client_onboarding.col_login') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="u in users"
                      :key="u.id"
                      class="cm-row-clickable"
                      :class="{ 'cm-row-selected': selectedUserId === u.id }"
                      @click="selectedUserId = u.id"
                    >
                      <td>
                        <v-radio-group v-model="selectedUserId" hide-details density="compact">
                          <v-radio :value="u.id" />
                        </v-radio-group>
                      </td>
                      <td>{{ u.nome }} {{ u.cognome || '' }}</td>
                      <td>{{ u.mail || '—' }}</td>
                      <td class="text-mono">{{ u.loginn || '—' }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card>
            </template>
          </CmAsyncSection>

          <div class="d-flex justify-space-between mt-4">
            <v-btn variant="text" :prepend-icon="mdiArrowLeft" @click="step = 1">
              {{ t('client_onboarding.back') }}
            </v-btn>
            <v-btn color="primary" :disabled="!selectedUserId" @click="goToProvision">
              {{ t('client_onboarding.continue') }}
            </v-btn>
          </div>
        </v-stepper-window-item>

        <!-- Paso 3: capability + configuración -->
        <v-stepper-window-item :value="3">
          <v-card variant="outlined" class="pa-4">
            <v-text-field
              v-model="provForm.client_name"
              :label="t('oauth_clients.form_client_name')"
              class="mb-3"
            />
            <v-text-field
              v-model="provForm.company_name"
              :label="t('oauth_clients.form_company_name')"
              class="mb-3"
            />
            <v-text-field
              v-model="provForm.contact_email"
              :label="t('oauth_clients.form_contact_email')"
              type="email"
              class="mb-3"
            />
            <v-select
              v-model="provForm.tier"
              :label="t('oauth_clients.form_tier')"
              :items="tierOptions"
              class="mb-3"
            />

            <v-divider class="my-4" />

            <div class="text-subtitle-2 mb-2">
              {{ t('client_onboarding.capability_section_title') }}
            </div>
            <CapabilitySelector
              v-model="provForm.role_id"
              :rules="[(v) => v !== null || t('client_onboarding.capability_required')]"
              @capability-changed="onCapabilityChanged"
            />
          </v-card>
          <div class="d-flex justify-space-between mt-4">
            <v-btn variant="text" :prepend-icon="mdiArrowLeft" @click="step = 2">
              {{ t('client_onboarding.back') }}
            </v-btn>
            <v-btn
              color="primary"
              :disabled="!step3Valid"
              :append-icon="mdiArrowRight"
              @click="goToConfirm"
            >
              {{ t('client_onboarding.continue') }}
            </v-btn>
          </div>
        </v-stepper-window-item>

        <!-- Paso 4: confirmar con preview de scopes efectivos -->
        <v-stepper-window-item :value="4">
          <v-card variant="outlined" class="pa-4">
            <div class="text-subtitle-1 mb-3">
              {{ t('client_onboarding.confirm_summary_title') }}
            </div>

            <div class="cm-summary-grid">
              <div class="cm-summary-row">
                <div class="cm-summary-label">{{ t('client_onboarding.confirm_owner_user') }}</div>
                <div class="cm-summary-value">
                  {{ selectedUserLabel }}
                </div>
              </div>
              <div class="cm-summary-row">
                <div class="cm-summary-label">{{ t('client_onboarding.confirm_client_name') }}</div>
                <div class="cm-summary-value">{{ provForm.client_name }}</div>
              </div>
              <div class="cm-summary-row">
                <div class="cm-summary-label">{{ t('client_onboarding.confirm_capability') }}</div>
                <div class="cm-summary-value">
                  <strong>{{ selectedCapability?.display_name ?? '—' }}</strong>
                  <code class="ml-2">{{ selectedCapability?.role_name ?? '' }}</code>
                </div>
              </div>
              <div class="cm-summary-row">
                <div class="cm-summary-label">{{ t('client_onboarding.confirm_tier') }}</div>
                <div class="cm-summary-value">{{ provForm.tier }}</div>
              </div>
            </div>

            <v-divider class="my-4" />

            <div class="text-subtitle-2 mb-2">
              {{ t('client_onboarding.confirm_effective_scopes_title') }}
              <span class="text-caption text-medium-emphasis ml-2">
                ({{ t('client_onboarding.confirm_effective_scopes_hint') }})
              </span>
            </div>

            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-3"
              :icon="mdiInformation"
            >
              {{ t('client_onboarding.confirm_intersection_note') }}
            </v-alert>

            <!-- Scopes de la capability (declarados) -->
            <div class="mb-3">
              <div class="cm-mini-label">
                {{ t('client_onboarding.confirm_capability_scopes') }}
              </div>
              <div class="cm-chips-row">
                <v-chip
                  v-for="scope in capabilityScopes"
                  :key="scope"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  class="cm-scope-chip"
                >
                  {{ scope }}
                </v-chip>
              </div>
            </div>
          </v-card>

          <div class="d-flex justify-space-between mt-4">
            <v-btn variant="text" :prepend-icon="mdiArrowLeft" @click="step = 3">
              {{ t('client_onboarding.back') }}
            </v-btn>
            <v-btn
              color="primary"
              :loading="provisioning"
              :prepend-icon="mdiCheck"
              @click="provision"
            >
              {{ t('client_onboarding.create_client') }}
            </v-btn>
          </div>
        </v-stepper-window-item>

        <!-- Paso 5: probar credenciales -->
        <v-stepper-window-item :value="5">
          <v-card variant="outlined" class="pa-4">
            <v-alert
              type="success"
              variant="tonal"
              density="compact"
              class="mb-3"
              :icon="mdiCheck"
            >
              {{ t('client_onboarding.step5_created_ok') }}
            </v-alert>

            <div class="text-subtitle-2 mb-2">{{ t('client_onboarding.step5_test_title') }}</div>
            <p class="text-caption text-medium-emphasis mb-3">
              {{ t('client_onboarding.step5_test_subtitle') }}
            </p>

            <v-btn
              color="primary"
              :loading="testRunning"
              :prepend-icon="mdiPlay"
              class="mb-3"
              @click="runCredentialTest"
            >
              {{ t('client_onboarding.step5_run_test') }}
            </v-btn>

            <div v-if="testResults.length > 0" class="cm-test-results">
              <div
                v-for="(r, idx) in testResults"
                :key="idx"
                class="cm-test-row"
                :class="r.ok ? 'cm-test-ok' : 'cm-test-fail'"
              >
                <v-icon
                  size="small"
                  :icon="r.ok ? mdiCheckCircle : mdiCloseCircle"
                  :color="r.ok ? 'success' : 'error'"
                  class="mr-2"
                />
                <span class="cm-test-name">{{ r.name }}</span>
                <span class="ml-auto text-caption">{{ r.message }}</span>
              </div>
            </div>
          </v-card>

          <div class="d-flex justify-end mt-4">
            <v-btn color="primary" :prepend-icon="mdiCheck" @click="finish">
              {{ t('client_onboarding.done') }}
            </v-btn>
          </div>
        </v-stepper-window-item>
      </v-stepper-window>
    </v-stepper>

    <!-- Diálogo de revelado de credenciales -->
    <v-dialog v-model="credentialsDialog" max-width="640" persistent>
      <v-card v-if="newCredentials">
        <v-card-title class="text-warning">
          <v-icon :icon="mdiAlert" class="mr-2" />
          {{ t('oauth_clients.credentials_title') }}
        </v-card-title>
        <v-card-text>
          <v-alert type="warning" density="compact" class="mb-3">
            {{ t('oauth_clients.credentials_warning') }}
          </v-alert>
          <v-text-field
            :model-value="newCredentials.client_id"
            :label="t('oauth_clients.field_client_id')"
            readonly
            variant="outlined"
            density="comfortable"
            class="mb-4"
            :append-inner-icon="mdiContentCopy"
            @click:append-inner="copy(newCredentials.client_id)"
          />
          <v-text-field
            :model-value="newCredentials.client_secret"
            :label="t('oauth_clients.field_client_secret')"
            readonly
            variant="outlined"
            density="comfortable"
            :append-inner-icon="mdiContentCopy"
            @click:append-inner="copy(newCredentials.client_secret)"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="finish">{{ t('client_onboarding.done') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Wizard de alta de OAuth client para un cliente — Fase A3 del plan de
 * deprecación de `admin_config` (docs/plan-deprecacion-admin-config.md).
 * Portado desde `admin_config/src/features/client_onboarding/
 * ClientOnboardingPage.vue`. Orquesta `contattiService` (ya compartido),
 * `oauthClientsService` y `oauthRolesService` (Fase A1) — sin backend
 * propio.
 */
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiArrowLeft,
  mdiArrowRight,
  mdiAccount,
  mdiAlert,
  mdiContentCopy,
  mdiCheck,
  mdiCheckCircle,
  mdiCloseCircle,
  mdiInformation,
  mdiPlay,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import CapabilitySelector from '../components/CapabilitySelector.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { contattiService, type ContattoLite } from '../../anagrafiche/services/contatti.service';
import { oauthClientsService } from '../services/oauthClients.service';
import { oauthRolesService, type AvailableScope, type OAuthRole } from '../../oauth_roles/services/oauthRoles.service';

const { t } = useI18n();
const toast = useToastStore();

const step = ref(1);
const anagraficaId = ref<number | null>(null);

const users = ref<ContattoLite[]>([]);
const loadingUsers = ref(false);
const usersError = ref<string | null>(null);
const selectedUserId = ref<number | null>(null);

const availableScopes = ref<AvailableScope[]>([]);
const provForm = reactive({
  client_name: '',
  company_name: '',
  contact_email: '',
  tier: 'standard',
  scopes: [] as string[],
  role_id: null as number | null,
});
const provisioning = ref(false);

const credentialsDialog = ref(false);
const newCredentials = ref<{ client_id: string; client_secret: string } | null>(null);

const tierOptions = [
  { title: 'standard', value: 'standard' },
  { title: 'premium', value: 'premium' },
];

// Paso 3 valida capability + campos básicos.
const step3Valid = computed(
  () =>
    !!provForm.client_name.trim() &&
    !!provForm.company_name.trim() &&
    provForm.role_id !== null,
);

// Estado del paso 4
const selectedCapability = ref<OAuthRole | null>(null);
const capabilityScopes = computed<string[]>(() => {
  const s = selectedCapability.value?.scopes;
  return Array.isArray(s) ? s : [];
});

const selectedUserLabel = computed(() => {
  const u = users.value.find((x) => x.id === selectedUserId.value);
  if (!u) return String(selectedUserId.value ?? '');
  return `${u.nome ?? ''} (${u.loginn ?? '—'}, id=${u.id})`;
});

function onCapabilityChanged(role: OAuthRole | null): void {
  selectedCapability.value = role;
  // Sincroniza scopes con los de la capability para que el backend escriba
  // también oauth_client_scopes.
  provForm.scopes = capabilityScopes.value;
}

function goToConfirm(): void {
  if (!step3Valid.value) return;
  step.value = 4;
}

// Paso 5 — probar credenciales emitiendo un token y llamando a un endpoint
// neutral. Usa fetch directamente (no el wrapper http) para no contaminar
// la sesión y poder validar el basePath correctamente.
interface TestResult {
  name: string;
  ok: boolean;
  message: string;
}
const testRunning = ref(false);
const testResults = ref<TestResult[]>([]);

async function runCredentialTest(): Promise<void> {
  if (!newCredentials.value) return;
  testRunning.value = true;
  testResults.value = [];

  const basePath =
    (typeof window !== 'undefined' && window.__TMWE_NAV__?.basePath) || '';

  // 1) Solicitud de token
  let accessToken: string | null = null;
  try {
    const tokenResp = await fetch(basePath + '/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        'grant_type=client_credentials' +
        '&client_id=' +
        encodeURIComponent(newCredentials.value.client_id) +
        '&client_secret=' +
        encodeURIComponent(newCredentials.value.client_secret),
    });
    if (!tokenResp.ok) {
      testResults.value.push({
        name: t('client_onboarding.test_token'),
        ok: false,
        message: `HTTP ${tokenResp.status}`,
      });
    } else {
      const body = (await tokenResp.json()) as { access_token?: string };
      accessToken = body.access_token ?? null;
      testResults.value.push({
        name: t('client_onboarding.test_token'),
        ok: !!accessToken,
        message: accessToken ? 'OK' : 'no access_token in body',
      });
    }
  } catch (e) {
    testResults.value.push({
      name: t('client_onboarding.test_token'),
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  // 2) Solicitud de ejemplo con el token (ext_my_shipments es segura / sin efectos secundarios)
  if (accessToken) {
    try {
      const sampleResp = await fetch(basePath + '/ext_my_shipments?per_page=1', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      testResults.value.push({
        name: t('client_onboarding.test_sample_call'),
        ok: sampleResp.ok,
        message: sampleResp.ok ? 'HTTP 200' : `HTTP ${sampleResp.status}`,
      });
    } catch (e) {
      testResults.value.push({
        name: t('client_onboarding.test_sample_call'),
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  testRunning.value = false;
}

async function goToUsers(): Promise<void> {
  if (!anagraficaId.value) return;
  step.value = 2;
  loadingUsers.value = true;
  usersError.value = null;
  selectedUserId.value = null;
  try {
    users.value = await contattiService.listByPartner(anagraficaId.value);
  } catch (e) {
    usersError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loadingUsers.value = false;
  }
}

function goToProvision(): void {
  if (!selectedUserId.value) return;
  const user = users.value.find((u) => u.id === selectedUserId.value);
  provForm.client_name = user ? `${user.nome ?? ''} ${user.cognome ?? ''}`.trim() : '';
  provForm.company_name = '';
  provForm.contact_email = user?.mail || '';
  provForm.tier = 'standard';
  provForm.scopes = [];
  provForm.role_id = null;
  step.value = 3;
}

async function provision(): Promise<void> {
  if (!selectedUserId.value) return;
  provisioning.value = true;
  try {
    const res = await oauthClientsService.provision({
      user_id: selectedUserId.value,
      client_name: provForm.client_name,
      company_name: provForm.company_name,
      contact_email: provForm.contact_email || undefined,
      tier: provForm.tier,
      scopes: provForm.scopes,
      role_id: provForm.role_id ?? undefined,
    });
    newCredentials.value = { client_id: res.client_id, client_secret: res.client_secret };
    credentialsDialog.value = true;
    step.value = 5;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    provisioning.value = false;
  }
}

function copy(text: string): void {
  navigator.clipboard.writeText(text).then(
    () => toast.success(t('common.copied')),
    () => toast.error(t('common.copy_failed')),
  );
}

function finish(): void {
  credentialsDialog.value = false;
  newCredentials.value = null;
  selectedCapability.value = null;
  testResults.value = [];
  step.value = 1;
  anagraficaId.value = null;
  selectedUserId.value = null;
  users.value = [];
}

watch(anagraficaId, () => {
  selectedUserId.value = null;
  users.value = [];
});

onMounted(async () => {
  try {
    availableScopes.value = await oauthRolesService.availableScopes();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
});
</script>

<style scoped>
.cm-summary-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.cm-summary-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 0.5rem;
  align-items: baseline;
  padding: 0.25rem 0;
  border-bottom: 1px dashed var(--cm-border-color);
}
.cm-summary-row:last-child {
  border-bottom: none;
}
.cm-summary-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cm-text-muted);
}
.cm-summary-value {
  font-size: 0.9rem;
}
.cm-summary-value code {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.78rem;
  background: rgba(0, 0, 0, 0.05);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}
.cm-mini-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--cm-text-muted);
  margin-bottom: 0.35rem;
}
.cm-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.cm-scope-chip {
  font-family: ui-monospace, SFMono-Regular, monospace !important;
  font-size: 0.7rem !important;
}
.cm-test-results {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.5rem;
}
.cm-test-row {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border-left: 3px solid transparent;
}
.cm-test-ok {
  background: rgba(var(--v-theme-success), 0.06);
  border-left-color: rgb(var(--v-theme-success));
}
.cm-test-fail {
  background: rgba(var(--v-theme-error), 0.06);
  border-left-color: rgb(var(--v-theme-error));
}
.cm-test-name {
  font-weight: 500;
  font-size: 0.9rem;
}
</style>
