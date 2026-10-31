<template>
  <div>
    <CmSectionHeader :title="t('elevenlabs_partner_agent.title')" :subtitle="t('elevenlabs_partner_agent.subtitle')" />

    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      <div class="font-weight-medium mb-1">{{ t('elevenlabs_partner_agent.intro_title') }}</div>
      <ul class="pl-4">
        <li>{{ t('elevenlabs_partner_agent.intro_cost') }}</li>
        <li>{{ t('elevenlabs_partner_agent.intro_review') }}</li>
        <li>{{ t('elevenlabs_partner_agent.intro_changes') }}</li>
        <li>{{ t('elevenlabs_partner_agent.intro_fallback') }}</li>
      </ul>
    </v-alert>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-progress-linear v-if="loading" indeterminate class="mb-4" />

    <v-card v-for="slot in slots" :key="slot.profile" class="pa-4 mb-4" variant="outlined" :data-testid="`slot-${slot.profile}`">
      <div class="d-flex align-center ga-2 mb-1">
        <v-icon :icon="slot.icon" color="primary" />
        <span class="text-h6">{{ profileLabel(slot.profile) }}</span>
      </div>
      <div class="text-body-2 cm-cell-hint mb-3">{{ t(`elevenlabs_partner_agent.slot_desc_${slot.profile}`) }}</div>

      <v-alert :type="slot.own_serving ? 'success' : 'info'" variant="tonal" density="compact" class="mb-3" :data-testid="`slot-serving-${slot.profile}`">
        <strong>{{ t('elevenlabs_partner_agent.serving_label') }}:</strong>
        {{ slot.own_serving ? t('elevenlabs_partner_agent.serving_own') : t('elevenlabs_partner_agent.serving_standard') }}
        <div v-if="!slot.own_serving" class="text-body-2">
          {{ slot.agent ? t('elevenlabs_partner_agent.serving_waiting') : t('elevenlabs_partner_agent.serving_none') }}
        </div>
      </v-alert>

      <template v-if="slot.agent">
        <div class="d-flex align-center flex-wrap ga-2 mb-2" :data-testid="`partner-agent-${slot.agent.id}`">
          <v-chip size="small" :color="statusColor(slot.agent.approval_status)" variant="flat">
            {{ statusLabel(slot.agent.approval_status) }}
          </v-chip>
          <span class="cm-mono">{{ slot.agent.agent_id }}</span>
          <v-spacer />
          <v-chip size="x-small" :color="slot.agent.has_key ? 'success' : undefined" variant="flat">
            {{ slot.agent.has_key ? t('elevenlabs_partner_agent.key_set') : t('elevenlabs_partner_agent.key_none') }}
          </v-chip>
          <v-chip size="x-small" :color="slot.agent.has_webhook_secret ? 'success' : 'warning'" variant="flat">
            {{ slot.agent.has_webhook_secret ? t('elevenlabs_partner_agent.webhook_set') : t('elevenlabs_partner_agent.webhook_none') }}
          </v-chip>
        </div>

        <div class="d-flex align-center flex-wrap ga-1 mb-3" :data-testid="`steps-${slot.agent.id}`">
          <template v-for="(step, i) in STEPS" :key="step">
            <v-icon v-if="i > 0" :icon="mdiChevronRight" size="small" class="cm-cell-hint" />
            <v-chip
              size="small"
              :variant="stepState(slot.agent, step) === 'pending' ? 'outlined' : 'flat'"
              :color="stepState(slot.agent, step) === 'done' ? 'success' : stepState(slot.agent, step) === 'current' ? 'primary' : undefined"
              :prepend-icon="stepState(slot.agent, step) === 'done' ? mdiCheck : undefined"
            >
              {{ i + 1 }}. {{ t(`elevenlabs_partner_agent.step_${step}`) }}
            </v-chip>
          </template>
        </div>

        <div v-if="slot.agent.description" class="text-body-2 mb-2">{{ slot.agent.description }}</div>

        <div class="text-caption cm-cell-hint mb-2">
          {{ t('elevenlabs_partner_agent.last_verified') }}:
          {{ slot.agent.last_verified_at || t('elevenlabs_partner_agent.never') }}
        </div>

        <v-alert v-if="slot.agent.approval_status === 'draft'" type="info" variant="tonal" density="compact" class="mb-2">
          {{ t('elevenlabs_partner_agent.hint_draft') }}
        </v-alert>
        <v-alert v-else-if="slot.agent.approval_status === 'pending_review'" type="info" variant="tonal" density="compact" class="mb-2">
          {{ t('elevenlabs_partner_agent.hint_pending') }}
        </v-alert>
        <v-alert v-else-if="slot.agent.approval_status === 'approved'" type="success" variant="tonal" density="compact" class="mb-2">
          {{ t('elevenlabs_partner_agent.hint_approved') }}
        </v-alert>
        <v-alert v-else-if="slot.agent.approval_status === 'rejected'" type="error" variant="tonal" density="compact" class="mb-2">
          <div>{{ t('elevenlabs_partner_agent.hint_rejected') }}</div>
          <div v-if="slot.agent.review_notes" class="mt-1"><strong>{{ t('elevenlabs_partner_agent.reviewer_notes') }}:</strong> {{ slot.agent.review_notes }}</div>
        </v-alert>
        <v-alert v-else-if="slot.agent.approval_status === 'suspended'" type="warning" variant="tonal" density="compact" class="mb-2">
          <div>{{ t('elevenlabs_partner_agent.hint_suspended') }}</div>
          <div v-if="slot.agent.suspended_reason" class="mt-1"><strong>{{ t('elevenlabs_partner_agent.reason') }}:</strong> {{ slot.agent.suspended_reason }}</div>
        </v-alert>

        <div class="d-flex flex-wrap ga-2">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(slot.agent)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn size="small" variant="tonal" :prepend-icon="mdiShieldSearch" :loading="busy === `validate-${slot.agent.id}`" @click="validate(slot.agent)">
            {{ t('elevenlabs_partner_agent.validate') }}
          </v-btn>
          <v-btn
            v-if="canRequestReview(slot.agent.approval_status)"
            size="small"
            color="primary"
            :prepend-icon="mdiSend"
            :loading="busy === `review-${slot.agent.id}`"
            @click="requestReview(slot.agent)"
          >
            {{ t('elevenlabs_partner_agent.request_review') }}
          </v-btn>
          <v-spacer />
          <v-btn size="small" variant="text" color="error" :prepend-icon="mdiDelete" @click="remove(slot.agent)">
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>

      <v-btn v-else color="primary" :prepend-icon="mdiPlus" :data-testid="`connect-${slot.profile}`" @click="openCreate(slot.profile)">
        {{ t('elevenlabs_partner_agent.connect_agent') }}
      </v-btn>
    </v-card>

    <!-- Alta / edicion -->
    <v-dialog v-model="formDialog" max-width="640" persistent>
      <v-card>
        <v-card-title>
          {{ t(formMode === 'create' ? 'elevenlabs_partner_agent.dialog_create_for' : 'elevenlabs_partner_agent.dialog_edit_for', { slot: profileLabel(form.profile) }) }}
        </v-card-title>
        <v-card-text>
          <v-alert v-if="formMode === 'edit'" type="warning" variant="tonal" density="compact" class="mb-3">
            {{ t('elevenlabs_partner_agent.material_change_warning') }}
          </v-alert>
          <v-text-field
            v-model="form.agent_id"
            :label="t('elevenlabs_partner_agent.form_agent_id')"
            :hint="t('elevenlabs_partner_agent.agent_id_hint')"
            persistent-hint
            maxlength="70"
            :error-messages="fieldErrors.agent_id"
          />
          <v-text-field
            v-model="form.api_key"
            :label="t('elevenlabs_partner_agent.form_api_key')"
            :hint="formMode === 'edit' ? t('elevenlabs_partner_agent.secret_unchanged_hint') : t('elevenlabs_partner_agent.api_key_hint')"
            persistent-hint
            type="password"
            autocomplete="new-password"
            maxlength="512"
            class="mt-3"
            :error-messages="fieldErrors.api_key"
          />
          <v-text-field
            v-model="form.webhook_secret"
            :label="t('elevenlabs_partner_agent.form_webhook_secret')"
            :hint="formMode === 'edit' ? t('elevenlabs_partner_agent.secret_unchanged_hint') : t('elevenlabs_partner_agent.webhook_secret_hint')"
            persistent-hint
            type="password"
            autocomplete="new-password"
            maxlength="200"
            class="mt-3"
            :error-messages="fieldErrors.webhook_secret"
          />
          <v-text-field
            v-model="form.tts_voice_id"
            :label="t('elevenlabs_partner_agent.form_voice')"
            maxlength="100"
            class="mt-3"
            :error-messages="fieldErrors.tts_voice_id"
          />
          <v-text-field
            v-model="form.description"
            :label="t('elevenlabs_partner_agent.form_description')"
            maxlength="255"
            class="mt-3"
            :error-messages="fieldErrors.description"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="closeForm">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!formValid" @click="save">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Resultado de validar / revisar -->
    <v-dialog v-model="reportDialog" max-width="720">
      <v-card v-if="report">
        <v-card-title>{{ t('elevenlabs_partner_agent.report_title') }}</v-card-title>
        <v-card-text>
          <v-alert :type="report.can_be_approved ? 'success' : 'error'" variant="tonal" density="compact" class="mb-3">
            {{
              report.can_be_approved
                ? t('elevenlabs_partner_agent.report_ok')
                : t('elevenlabs_partner_agent.report_blocked', { n: report.blocking })
            }}
          </v-alert>
          <div v-if="blockingFindings.length" class="mb-3">
            <div class="text-subtitle-2 mb-1">{{ t('elevenlabs_partner_agent.blocking_findings') }}</div>
            <v-list density="compact" lines="two">
              <v-list-item v-for="(f, i) in blockingFindings" :key="'b' + i" :title="`${f.rule} · ${f.area}`" :subtitle="f.message">
                <template #prepend><v-chip size="x-small" :color="severityColor(f.severity)" variant="flat" class="mr-2">{{ f.severity }}</v-chip></template>
              </v-list-item>
            </v-list>
          </div>
          <div v-if="otherFindings.length">
            <div class="text-subtitle-2 mb-1">{{ t('elevenlabs_partner_agent.other_findings') }}</div>
            <v-list density="compact" lines="two">
              <v-list-item v-for="(f, i) in otherFindings" :key="'o' + i" :title="`${f.rule} · ${f.area}`" :subtitle="f.message">
                <template #prepend><v-chip size="x-small" :color="severityColor(f.severity)" variant="flat" class="mr-2">{{ f.severity }}</v-chip></template>
              </v-list-item>
            </v-list>
          </div>
          <div v-if="!report.findings.length" class="text-body-2">{{ t('elevenlabs_partner_agent.no_findings') }}</div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="reportDialog = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Autoservicio del partner sobre su agente de voz propio (ElevenLabs).
 * docs/02-arquitectura/agentes-ia/09-seguridad-agentes-propios-de-partner.md, fase 4. Las claves son de solo escritura: nunca se
 * precargan ni se muestran.
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiShieldSearch, mdiSend, mdiCheck, mdiChevronRight, mdiAccountGroup, mdiHeadset } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  AGENT_PROFILES,
  AgentApiError,
  canRequestReview,
  partnerAgentsService,
  severityColor,
  statusColor,
  toAgentError,
  type AgentRow,
  type InspectReport,
} from '../services/elevenlabsAgents.service';

const { t, te } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const agents = ref<AgentRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const busy = ref<string | null>(null);
const error = ref<string | null>(null);

const SLOT_ICONS: Record<string, string> = { public_form: mdiAccountGroup, copilot_operator: mdiHeadset };
const STEPS = ['draft', 'pending_review', 'approved'] as const;

/** Un slot por perfil: el agente propio que lo ocupa (si lo hay) y si es el que atiende hoy. */
const slots = computed(() =>
  AGENT_PROFILES.map((profile) => {
    const agent = agents.value.find((a) => a.profile === profile) ?? null;
    return { profile, icon: SLOT_ICONS[profile] ?? mdiAccountGroup, agent, own_serving: agent?.approval_status === 'approved' };
  }),
);

/** Paso del recorrido borrador -> revision -> aprobado en el que esta el agente. */
function stepState(a: AgentRow, step: (typeof STEPS)[number]): 'done' | 'current' | 'pending' {
  const order = ['draft', 'pending_review', 'approved'];
  const at = order.indexOf(a.approval_status ?? 'draft');
  const idx = order.indexOf(step);
  // Rechazado y suspendido vuelven a "corregir y revisar": el paso actual es el borrador.
  const current = at === -1 ? 0 : at;
  if (a.approval_status === 'approved') return 'done';
  return idx < current ? 'done' : idx === current ? 'current' : 'pending';
}

function profileLabel(profile: string): string {
  return te(`elevenlabs_partner_agent.profile_${profile}`) ? (t(`elevenlabs_partner_agent.profile_${profile}`) as string) : profile;
}
function statusLabel(status: string | null): string {
  return t(`elevenlabs_partner_agent.status_${status ?? 'draft'}`) as string;
}

/** Mensaje legible para un error del servidor (con respaldo generico). */
function errorMessage(e: unknown): string {
  const err = toAgentError(e);
  const key = `elevenlabs_partner_agent.errors.${err.code}`;
  return te(key) ? (t(key) as string) : (t('elevenlabs_partner_agent.errors.generic', { code: err.code }) as string);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    agents.value = (await partnerAgentsService.list()).agents;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

// ---------- formulario ----------
const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const fieldErrors = reactive<Record<string, string[]>>({});

interface FormState {
  id?: number;
  profile: string;
  agent_id: string;
  api_key: string;
  webhook_secret: string;
  tts_voice_id: string;
  description: string;
}
const form = reactive<FormState>({ profile: AGENT_PROFILES[0], agent_id: '', api_key: '', webhook_secret: '', tts_voice_id: '', description: '' });

const formValid = computed(() => {
  if (!form.profile || form.agent_id.trim() === '') return false;
  return formMode.value === 'edit' || form.api_key.trim() !== '';
});

function clearFieldErrors(): void {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k];
}

function openCreate(profile: string): void {
  formMode.value = 'create';
  clearFieldErrors();
  Object.assign(form, { id: undefined, profile, agent_id: '', api_key: '', webhook_secret: '', tts_voice_id: '', description: '' });
  formDialog.value = true;
}

function openEdit(a: AgentRow): void {
  formMode.value = 'edit';
  clearFieldErrors();
  // Las claves nunca se precargan: vacio = mantener la guardada.
  Object.assign(form, {
    id: a.id,
    profile: a.profile,
    agent_id: a.agent_id ?? '',
    api_key: '',
    webhook_secret: '',
    tts_voice_id: a.tts_voice_id ?? '',
    description: a.description ?? '',
  });
  formDialog.value = true;
}

function closeForm(): void {
  // Las claves no deben quedar en memoria del formulario.
  form.api_key = '';
  form.webhook_secret = '';
  formDialog.value = false;
}

async function save(): Promise<void> {
  saving.value = true;
  clearFieldErrors();
  try {
    const payload = {
      profile: form.profile,
      agent_id: form.agent_id.trim(),
      tts_voice_id: form.tts_voice_id.trim(),
      description: form.description.trim(),
      ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
      ...(form.webhook_secret.trim() ? { webhook_secret: form.webhook_secret.trim() } : {}),
    };
    if (formMode.value === 'create') {
      await partnerAgentsService.create(payload);
      toast.success(t('elevenlabs_partner_agent.created'));
    } else {
      await partnerAgentsService.update(form.id as number, payload);
      toast.success(t('elevenlabs_partner_agent.updated'));
    }
    closeForm();
    await load();
  } catch (e) {
    const err = toAgentError(e);
    if (err.fields) {
      for (const [k, v] of Object.entries(err.fields)) fieldErrors[k] = [String(v)];
    }
    toast.error(errorMessage(err));
  } finally {
    saving.value = false;
  }
}

// ---------- acciones ----------
const report = ref<InspectReport | null>(null);
const reportDialog = ref(false);
const blockingFindings = computed(() => report.value?.findings.filter((f) => f.blocking) ?? []);
const otherFindings = computed(() => report.value?.findings.filter((f) => !f.blocking && f.severity !== 'info') ?? []);

async function validate(a: AgentRow): Promise<void> {
  busy.value = `validate-${a.id}`;
  try {
    report.value = await partnerAgentsService.validate(a.id);
    reportDialog.value = true;
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    busy.value = null;
  }
}

async function requestReview(a: AgentRow): Promise<void> {
  busy.value = `review-${a.id}`;
  try {
    await partnerAgentsService.requestReview(a.id);
    toast.success(t('elevenlabs_partner_agent.review_requested'));
    await load();
  } catch (e) {
    const err = toAgentError(e);
    if (err instanceof AgentApiError && err.report) {
      // El agente tiene bloqueantes: se muestran para que el partner los corrija.
      report.value = err.report;
      reportDialog.value = true;
    }
    toast.error(errorMessage(err));
  } finally {
    busy.value = null;
  }
}

async function remove(a: AgentRow): Promise<void> {
  const ok = await confirm.askDanger(
    t('elevenlabs_partner_agent.confirm_delete_message', { name: a.agent_id ?? '' }) as string,
    t('elevenlabs_partner_agent.confirm_delete_title') as string,
  );
  if (!ok) return;
  try {
    await partnerAgentsService.remove(a.id);
    toast.success(t('elevenlabs_partner_agent.deleted'));
    await load();
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

onMounted(() => {
  void load();
});
</script>
