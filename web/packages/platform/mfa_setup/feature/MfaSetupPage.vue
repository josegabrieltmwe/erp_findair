<template>
  <div class="mfa-setup-page">
    <CmSectionHeader
      :title="t('mfa_setup.title')"
      :subtitle="t('mfa_setup.subtitle')"
    />

    <CmAsyncSection
      :loading="statusLoading"
      :error="error"
      :empty="false"
      :data="status"
      @clear-error="error = null"
    >
      <template #default>
        <!-- Tarjeta de estado -->
        <v-card variant="outlined" class="mb-4">
          <v-card-text>
            <div class="msp-status">
              <v-icon
                size="32"
                :icon="status?.enrolled ? mdiShieldCheck : mdiShieldAlert"
                :color="status?.enrolled ? 'success' : 'warning'"
                class="mr-3"
              />
              <div class="msp-status-text">
                <div class="msp-status-title">
                  {{ status?.enrolled ? t('mfa_setup.status_enrolled') : t('mfa_setup.status_not_enrolled') }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{
                    status?.enrolled
                      ? t('mfa_setup.enrolled_hint')
                      : t('mfa_setup.not_enrolled_hint')
                  }}
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Wizard de configuración (no inscrito o re-inscribiendo) -->
        <v-card
          v-if="!status?.enrolled || setupResult"
          variant="outlined"
          class="mb-4"
        >
          <v-card-title>{{ t('mfa_setup.wizard_title') }}</v-card-title>
          <v-card-text>
            <ol class="msp-steps">
              <li>
                <strong>{{ t('mfa_setup.step1_title') }}</strong>
                <p class="text-caption">{{ t('mfa_setup.step1_desc') }}</p>
                <v-btn
                  v-if="!setupResult"
                  color="primary"
                  :loading="setupRunning"
                  :prepend-icon="mdiQrcode"
                  @click="runSetup"
                >
                  {{ t('mfa_setup.generate_secret') }}
                </v-btn>
              </li>

              <li v-if="setupResult">
                <strong>{{ t('mfa_setup.step2_title') }}</strong>
                <p class="text-caption">{{ t('mfa_setup.step2_desc') }}</p>
                <div class="msp-secret-row">
                  <v-text-field
                    :model-value="setupResult.secret_base32"
                    :label="t('mfa_setup.secret_label')"
                    readonly
                    variant="outlined"
                    density="comfortable"
                    :append-inner-icon="mdiContentCopy"
                    @click:append-inner="copy(setupResult.secret_base32)"
                  />
                </div>
                <v-alert
                  type="warning"
                  variant="tonal"
                  density="compact"
                  class="mb-2"
                  :icon="mdiAlert"
                >
                  {{ t('mfa_setup.secret_warning') }}
                </v-alert>
                <div class="text-caption">
                  <strong>{{ t('mfa_setup.provisioning_uri_label') }}:</strong>
                  <code class="msp-uri">{{ setupResult.provisioning_uri }}</code>
                </div>
              </li>

              <li v-if="setupResult">
                <strong>{{ t('mfa_setup.step3_title') }}</strong>
                <p class="text-caption">{{ t('mfa_setup.step3_desc') }}</p>
                <div class="msp-verify-row">
                  <v-text-field
                    v-model="verifyCode"
                    :label="t('mfa_setup.code_label')"
                    placeholder="123456"
                    maxlength="6"
                    variant="outlined"
                    density="comfortable"
                    inputmode="numeric"
                    class="msp-code-input"
                    autofocus
                  />
                  <v-btn
                    color="primary"
                    :loading="verifyRunning"
                    :disabled="verifyCode.length !== 6"
                    :prepend-icon="mdiCheck"
                    @click="runVerify"
                  >
                    {{ t('mfa_setup.verify_button') }}
                  </v-btn>
                </div>
                <v-alert
                  v-if="verifyResult"
                  type="success"
                  variant="tonal"
                  density="compact"
                  class="mt-2"
                  :icon="mdiCheck"
                >
                  {{ t('mfa_setup.verify_success') }}
                </v-alert>
              </li>
            </ol>
          </v-card-text>
        </v-card>

        <!-- Tarjeta de deshabilitar (solo inscrito) -->
        <v-card v-if="status?.enrolled && !setupResult" variant="outlined">
          <v-card-title class="text-error">
            <v-icon :icon="mdiCancel" class="mr-2" />
            {{ t('mfa_setup.disable_title') }}
          </v-card-title>
          <v-card-text>
            <p class="text-body-2 mb-3">{{ t('mfa_setup.disable_desc') }}</p>
            <div class="msp-verify-row">
              <v-text-field
                v-model="disableCode"
                :label="t('mfa_setup.code_label')"
                placeholder="123456"
                maxlength="6"
                variant="outlined"
                density="comfortable"
                inputmode="numeric"
                class="msp-code-input"
              />
              <v-btn
                color="error"
                :loading="disableRunning"
                :disabled="disableCode.length !== 6"
                :prepend-icon="mdiDelete"
                @click="runDisable"
              >
                {{ t('mfa_setup.disable_button') }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
/**
 * Página de auto-servicio MFA TOTP — Fase A5 del plan de deprecación de
 * `admin_config` (docs/plan-deprecacion-admin-config.md). Portado desde
 * `admin_config/src/features/mfa_setup/MfaSetupPage.vue`.
 *
 * Solo accesible para TMWE admins. Permite:
 *   - Ver estado actual (¿inscrito?)
 *   - Generar nuevo secret + URI de provisión
 *   - Verificar código TOTP (crea mfa_session de 5 min)
 *   - Deshabilitar MFA (requiere código TOTP válido)
 */
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiShieldCheck,
  mdiShieldAlert,
  mdiQrcode,
  mdiContentCopy,
  mdiAlert,
  mdiCheck,
  mdiCancel,
  mdiDelete,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import { mfaService, type MfaStatus, type MfaSetupResult, type MfaVerifyResult } from '../services/mfa.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';

const { t } = useI18n();
const toast = useToastStore();

const status = ref<MfaStatus | null>(null);
const statusLoading = ref(false);
const error = ref<string | null>(null);

const setupRunning = ref(false);
const setupResult = ref<MfaSetupResult | null>(null);

const verifyCode = ref('');
const verifyRunning = ref(false);
const verifyResult = ref<MfaVerifyResult | null>(null);

const disableCode = ref('');
const disableRunning = ref(false);

async function loadStatus(): Promise<void> {
  statusLoading.value = true;
  error.value = null;
  try {
    status.value = await mfaService.getStatus();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    statusLoading.value = false;
  }
}

async function runSetup(): Promise<void> {
  setupRunning.value = true;
  try {
    setupResult.value = await mfaService.setup();
    verifyCode.value = '';
    verifyResult.value = null;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    setupRunning.value = false;
  }
}

async function runVerify(): Promise<void> {
  verifyRunning.value = true;
  try {
    verifyResult.value = await mfaService.verify(verifyCode.value);
    toast.success(t('mfa_setup.verify_success'));
    await loadStatus();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    verifyRunning.value = false;
  }
}

async function runDisable(): Promise<void> {
  disableRunning.value = true;
  try {
    await mfaService.disable(disableCode.value);
    toast.success(t('mfa_setup.disable_success'));
    disableCode.value = '';
    await loadStatus();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    disableRunning.value = false;
  }
}

function copy(text: string): void {
  navigator.clipboard.writeText(text).then(
    () => toast.success(t('common.copied')),
    () => toast.error(t('common.copy_failed')),
  );
}

onMounted(() => {
  void loadStatus();
});
</script>

<style scoped>
.mfa-setup-page {
  max-width: 800px;
}

.msp-status {
  display: flex;
  align-items: center;
}

.msp-status-title {
  font-size: 1.1rem;
  font-weight: 500;
}

.msp-steps {
  margin: 0;
  padding-left: 1.25rem;
}

.msp-steps li {
  padding: 0.75rem 0;
  border-bottom: 1px dashed rgba(var(--v-theme-on-surface), 0.12);
}

.msp-steps li:last-child {
  border-bottom: none;
}

.msp-secret-row,
.msp-verify-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin: 0.5rem 0;
}

.msp-code-input {
  max-width: 200px;
}

.msp-uri {
  display: block;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.7rem;
  background: rgba(var(--v-theme-on-surface), 0.05);
  padding: 0.5rem;
  border-radius: 3px;
  margin-top: 0.25rem;
  word-break: break-all;
}
</style>
