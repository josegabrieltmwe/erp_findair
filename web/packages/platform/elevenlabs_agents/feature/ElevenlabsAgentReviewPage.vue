<template>
  <div>
    <CmSectionHeader :title="t('elevenlabs_agent_review.title')" :subtitle="t('elevenlabs_agent_review.subtitle')" />

    <v-tabs v-model="status" class="mb-4" density="compact" @update:model-value="load">
      <v-tab v-for="s in STATUS_TABS" :key="s" :value="s" :data-testid="`review-tab-${s}`">
        {{ t(`elevenlabs_agent_review.tab_${s}`) }}
      </v-tab>
    </v-tabs>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>
    <v-progress-linear v-if="loading" indeterminate class="mb-4" />

    <CmEmptyState v-else-if="agents.length === 0 && !error" :icon="mdiRobotOutline" :title="t('elevenlabs_agent_review.empty_title')" />

    <v-table v-else density="compact">
      <thead>
        <tr>
          <th>{{ t('elevenlabs_agent_review.col_partner') }}</th>
          <th>{{ t('elevenlabs_agent_review.col_profile') }}</th>
          <th>{{ t('elevenlabs_agent_review.col_agent') }}</th>
          <th>{{ t('elevenlabs_agent_review.col_status') }}</th>
          <th>{{ t('elevenlabs_agent_review.col_requested') }}</th>
          <th>{{ t('elevenlabs_agent_review.col_verified') }}</th>
          <th class="text-right">{{ t('elevenlabs_agent_review.col_actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in agents" :key="a.id" :data-testid="`review-row-${a.id}`">
          <td>
            {{ a.partner_name || `#${a.partner_id}` }}
            <div class="cm-cell-hint">#{{ a.partner_id }}</div>
          </td>
          <td>{{ t(`elevenlabs_partner_agent.profile_${a.profile}`) }}</td>
          <td><span class="cm-mono">{{ a.agent_id }}</span></td>
          <td>
            <v-chip size="small" :color="statusColor(a.approval_status)" variant="flat">
              {{ t(`elevenlabs_partner_agent.status_${a.approval_status}`) }}
            </v-chip>
          </td>
          <td>{{ a.requested_at || '—' }}</td>
          <td>{{ a.last_verified_at || '—' }}</td>
          <td class="text-right">
            <v-btn size="small" variant="tonal" :prepend-icon="mdiClipboardCheckOutline" @click="openDetail(a.id)">
              {{ t('elevenlabs_agent_review.review') }}
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="detailDialog" max-width="860" scrollable>
      <v-card v-if="detail">
        <v-card-title class="d-flex align-center ga-2">
          <span>{{ t('elevenlabs_agent_review.detail_title') }}</span>
          <v-chip size="small" :color="statusColor(detail.approval_status)" variant="flat">
            {{ t(`elevenlabs_partner_agent.status_${detail.approval_status}`) }}
          </v-chip>
        </v-card-title>
        <v-card-text>
          <v-table density="compact" class="mb-3">
            <tbody>
              <tr><td class="cm-cell-hint">{{ t('elevenlabs_agent_review.col_partner') }}</td><td>{{ detail.partner_name || '—' }} <span class="cm-cell-hint">#{{ detail.partner_id }}</span></td></tr>
              <tr><td class="cm-cell-hint">{{ t('elevenlabs_agent_review.col_profile') }}</td><td>{{ t(`elevenlabs_partner_agent.profile_${detail.profile}`) }}</td></tr>
              <tr><td class="cm-cell-hint">{{ t('elevenlabs_agent_review.col_agent') }}</td><td><span class="cm-mono">{{ detail.agent_id }}</span></td></tr>
              <tr><td class="cm-cell-hint">{{ t('elevenlabs_agent_review.billing') }}</td><td>{{ t(`elevenlabs_partner_agent.billing_${detail.billing_owner}`) }}</td></tr>
              <tr><td class="cm-cell-hint">{{ t('elevenlabs_agent_review.col_requested') }}</td><td>{{ detail.requested_at || '—' }}</td></tr>
              <tr><td class="cm-cell-hint">{{ t('elevenlabs_agent_review.approved_version') }}</td><td><span class="cm-mono">{{ detail.approved_version_id || '—' }}</span></td></tr>
              <tr><td class="cm-cell-hint">{{ t('elevenlabs_agent_review.col_verified') }}</td><td>{{ detail.last_verified_at || '—' }}</td></tr>
              <tr v-if="detail.suspended_reason"><td class="cm-cell-hint">{{ t('elevenlabs_partner_agent.reason') }}</td><td>{{ detail.suspended_reason }}</td></tr>
              <tr v-if="detail.review_notes"><td class="cm-cell-hint">{{ t('elevenlabs_partner_agent.reviewer_notes') }}</td><td>{{ detail.review_notes }}</td></tr>
            </tbody>
          </v-table>

          <div class="d-flex align-center ga-2 mb-2">
            <div class="text-subtitle-2">{{ t('elevenlabs_agent_review.report_title') }}</div>
            <v-spacer />
            <v-btn size="small" variant="tonal" :prepend-icon="mdiMagnify" :loading="inspecting" @click="inspect">
              {{ t('elevenlabs_agent_review.inspect_now') }}
            </v-btn>
          </div>
          <v-alert v-if="!report" type="info" variant="tonal" density="compact" class="mb-3">
            {{ t('elevenlabs_agent_review.inspect_hint') }}
          </v-alert>
          <template v-else>
            <v-alert :type="report.can_be_approved ? 'success' : 'error'" variant="tonal" density="compact" class="mb-2">
              {{ report.can_be_approved ? t('elevenlabs_partner_agent.report_ok') : t('elevenlabs_partner_agent.report_blocked', { n: report.blocking }) }}
            </v-alert>
            <v-list density="compact" lines="two" class="mb-2">
              <v-list-item v-for="(f, i) in shownFindings" :key="i" :title="`${f.rule} · ${f.area}${f.blocking ? ' · ' + t('elevenlabs_agent_review.blocking') : ''}`" :subtitle="f.message">
                <template #prepend><v-chip size="x-small" :color="severityColor(f.severity)" variant="flat" class="mr-2">{{ f.severity }}</v-chip></template>
              </v-list-item>
            </v-list>
          </template>

          <v-textarea
            v-model="notes"
            :label="t('elevenlabs_agent_review.notes_label')"
            :hint="t('elevenlabs_agent_review.notes_hint')"
            persistent-hint
            rows="2"
            auto-grow
            class="mt-2"
            maxlength="2000"
          />

          <div v-if="detail.events && detail.events.length" class="mt-4">
            <div class="text-subtitle-2 mb-1">{{ t('elevenlabs_agent_review.history') }}</div>
            <v-list density="compact">
              <v-list-item
                v-for="(ev, i) in detail.events"
                :key="i"
                :title="`${ev.event} · ${ev.status_before ?? '—'} → ${ev.status_after ?? '—'}`"
                :subtitle="ev.created_at ?? ''"
              />
            </v-list>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="detailDialog = false">{{ t('common.close') }}</v-btn>
          <v-spacer />
          <template v-if="detail.approval_status === 'pending_review'">
            <v-btn color="error" variant="tonal" :loading="acting === 'reject'" :disabled="!notesFilled" @click="act('reject')">
              {{ t('elevenlabs_agent_review.reject') }}
            </v-btn>
            <v-btn color="success" :loading="acting === 'approve'" :prepend-icon="mdiCheck" @click="act('approve')">
              {{ t('elevenlabs_agent_review.approve') }}
            </v-btn>
          </template>
          <v-btn
            v-if="detail.approval_status === 'approved'"
            color="warning"
            variant="tonal"
            :loading="acting === 'suspend'"
            :disabled="!notesFilled"
            @click="act('suspend')"
          >
            {{ t('elevenlabs_agent_review.suspend') }}
          </v-btn>
          <v-btn v-if="detail.approval_status === 'suspended'" color="success" :loading="acting === 'reactivate'" @click="act('reactivate')">
            {{ t('elevenlabs_agent_review.reactivate') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Revision y aprobacion de agentes propios de partner por un administrador de
 * TMWE (docs/02-arquitectura/agentes-ia/09-seguridad-agentes-propios-de-partner.md, fase 4). El servidor repite la inspeccion al
 * aprobar: lo que se ve aqui es informativo, nunca se envia como "verificacion".
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiRobotOutline, mdiClipboardCheckOutline, mdiMagnify, mdiCheck } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import {
  agentReviewService,
  AgentApiError,
  severityColor,
  statusColor,
  toAgentError,
  type AgentRow,
  type ApprovalStatus,
  type InspectReport,
} from '../services/elevenlabsAgents.service';

const STATUS_TABS: ApprovalStatus[] = ['pending_review', 'approved', 'suspended', 'rejected', 'draft'];

const { t, te } = useI18n();
const toast = useToastStore();

const status = ref<ApprovalStatus>('pending_review');
const agents = ref<AgentRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

function errorMessage(e: unknown): string {
  const err = toAgentError(e);
  const key = `elevenlabs_agent_review.errors.${err.code}`;
  const shared = `elevenlabs_partner_agent.errors.${err.code}`;
  if (te(key)) return t(key) as string;
  if (te(shared)) return t(shared) as string;
  return t('elevenlabs_partner_agent.errors.generic', { code: err.code }) as string;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    agents.value = await agentReviewService.list(status.value);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

// ---------- detalle ----------
const detailDialog = ref(false);
const detail = ref<(AgentRow & { events?: AgentRow['events'] }) | null>(null);
const report = ref<InspectReport | null>(null);
const inspecting = ref(false);
const acting = ref<string | null>(null);
const notes = ref('');
const notesFilled = computed(() => notes.value.trim().length > 0);
const shownFindings = computed(() => report.value?.findings.filter((f) => f.blocking || f.severity !== 'info') ?? []);

async function openDetail(id: number): Promise<void> {
  report.value = null;
  notes.value = '';
  try {
    detail.value = await agentReviewService.get(id);
    detailDialog.value = true;
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

async function inspect(): Promise<void> {
  if (!detail.value) return;
  inspecting.value = true;
  try {
    report.value = await agentReviewService.inspect(detail.value.id);
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    inspecting.value = false;
  }
}

async function act(op: 'approve' | 'reject' | 'suspend' | 'reactivate'): Promise<void> {
  if (!detail.value) return;
  const id = detail.value.id;
  acting.value = op;
  try {
    if (op === 'approve') await agentReviewService.approve(id, notes.value.trim());
    else if (op === 'reject') await agentReviewService.reject(id, notes.value.trim());
    else if (op === 'suspend') await agentReviewService.suspend(id, notes.value.trim());
    else await agentReviewService.reactivate(id, notes.value.trim());
    toast.success(t(`elevenlabs_agent_review.done_${op}`));
    detailDialog.value = false;
    await load();
  } catch (e) {
    const err = toAgentError(e);
    // Con bloqueantes, el servidor devuelve el informe: se muestra en el propio dialogo.
    if (err instanceof AgentApiError && err.report) report.value = err.report;
    toast.error(errorMessage(err));
  } finally {
    acting.value = null;
  }
}

onMounted(() => {
  void load();
});
</script>
