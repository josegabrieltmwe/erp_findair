<template>
  <div class="sr-detail">
    <div class="mb-2">
      <v-btn variant="text" size="small" :prepend-icon="mdiArrowLeft" data-testid="sr-back" @click="back">
        {{ t('self_registration.detail.back') }}
      </v-btn>
    </div>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4" data-testid="sr-detail-error">{{ loadError }}</v-alert>
    <v-progress-linear v-if="loading && !reg" indeterminate class="mb-4" />

    <template v-if="reg">
      <CmSectionHeader
        :title="t('self_registration.detail.title', { id: reg.id, company: reg.company_name || reg.email })"
        :subtitle="t('self_registration.detail.subtitle', { date: formatDateTime(reg.created_at, locale) })"
      >
        <template #actions>
          <SelfRegistrationStatusChip :status="reg.status" />
          <template v-if="canDecide">
            <v-btn color="error" variant="outlined" :prepend-icon="mdiClose" data-testid="sr-reject" @click="openReject">
              {{ t('self_registration.detail.reject') }}
            </v-btn>
            <v-btn color="primary" variant="flat" :prepend-icon="mdiCheck" data-testid="sr-approve" @click="openApprove">
              {{ t('self_registration.detail.approve') }}
            </v-btn>
          </template>
        </template>
      </CmSectionHeader>

      <v-alert v-if="!canDecide" type="info" variant="tonal" density="compact" class="mb-4" data-testid="sr-not-reviewable">
        {{ t(`self_registration.detail.state_hint.${reg.status}`) }}
      </v-alert>
      <v-alert
        v-else-if="waitingHours !== null && waitingHours >= REMINDER_HOURS"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        {{ t('self_registration.detail.waiting', { hours: waitingHours }) }}
      </v-alert>

      <v-row>
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="pa-4 mb-4">
            <div class="text-subtitle-2 mb-3">{{ t('self_registration.detail.section_request') }}</div>
            <dl class="sr-dl">
              <dt>{{ t('self_registration.fields.person') }}</dt>
              <dd>{{ [reg.first_name, reg.last_name].filter(Boolean).join(' ') || '—' }}</dd>
              <dt>{{ t('self_registration.fields.email') }}</dt>
              <dd>{{ reg.email }}</dd>
              <dt>{{ t('self_registration.fields.phone') }}</dt>
              <dd>{{ reg.phone || '—' }}</dd>
              <dt>{{ t('self_registration.fields.company_name') }}</dt>
              <dd>{{ reg.company_name || '—' }}</dd>
              <dt>{{ t('self_registration.fields.country') }}</dt>
              <dd>{{ reg.country_iso || '—' }}</dd>
              <dt>{{ t('self_registration.fields.vat_number') }}</dt>
              <dd class="sr-mono">{{ reg.vat_number || '—' }}</dd>
              <dt>{{ t('self_registration.fields.language') }}</dt>
              <dd>{{ reg.language || '—' }}</dd>
              <dt>{{ t('self_registration.fields.channel') }}</dt>
              <dd>{{ reg.channel || '—' }}</dd>
              <dt>{{ t('self_registration.fields.vies_result') }}</dt>
              <dd>{{ reg.vies_result || '—' }}</dd>
            </dl>
          </v-card>

          <v-card variant="outlined" class="pa-4 mb-4">
            <div class="text-subtitle-2 mb-3">{{ t('self_registration.detail.section_trace') }}</div>
            <dl class="sr-dl">
              <dt>{{ t('self_registration.fields.created_at') }}</dt>
              <dd>{{ formatDateTime(reg.created_at, locale) }}</dd>
              <dt>{{ t('self_registration.fields.verified_at') }}</dt>
              <dd>{{ formatDateTime(reg.verified_at, locale) }}</dd>
              <dt>{{ t('self_registration.fields.consent_at') }}</dt>
              <dd>{{ formatDateTime(reg.consent_at, locale) }}</dd>
              <dt>{{ t('self_registration.fields.versions') }}</dt>
              <dd>{{ t('self_registration.detail.versions', { privacy: reg.privacy_version || '—', terms: reg.terms_version || '—' }) }}</dd>
              <dt>{{ t('self_registration.fields.ip') }}</dt>
              <dd class="sr-mono">{{ reg.ip || '—' }}</dd>
              <dt>{{ t('self_registration.fields.user_agent') }}</dt>
              <dd class="sr-small">{{ reg.user_agent || '—' }}</dd>
            </dl>
          </v-card>

          <v-card v-if="reg.reviewed_at || reg.review_notes || reg.customer_message" variant="outlined" class="pa-4 mb-4">
            <div class="text-subtitle-2 mb-3">{{ t('self_registration.detail.section_review') }}</div>
            <dl class="sr-dl">
              <dt>{{ t('self_registration.fields.reviewed_at') }}</dt>
              <dd>{{ formatDateTime(reg.reviewed_at, locale) }}</dd>
              <dt>{{ t('self_registration.fields.reviewed_by') }}</dt>
              <dd>{{ reg.reviewed_by ? `#${reg.reviewed_by}` : '—' }}</dd>
              <dt>{{ t('self_registration.fields.review_notes') }}</dt>
              <dd class="sr-pre">{{ reg.review_notes || '—' }}</dd>
              <dt>{{ t('self_registration.fields.customer_message') }}</dt>
              <dd class="sr-pre">{{ reg.customer_message || '—' }}</dd>
            </dl>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card variant="outlined" class="pa-4 mb-4" data-testid="sr-account">
            <div class="text-subtitle-2 mb-3">{{ t('self_registration.detail.section_account') }}</div>
            <div v-if="!reg.account" class="sr-muted">{{ t('self_registration.detail.no_account') }}</div>
            <template v-else>
              <dl v-if="acc" class="sr-dl">
                <dt>{{ t('self_registration.fields.customer') }}</dt>
                <dd>
                  <router-link :to="{ name: 'anagrafica-detail', params: { id: String(acc.id) } }">
                    #{{ acc.id }} · {{ acc.rag_soc || '—' }}
                  </router-link>
                </dd>
                <dt>{{ t('self_registration.fields.pi_cf') }}</dt>
                <dd class="sr-mono">{{ acc.pi_cf || '—' }}</dd>
                <dt>{{ t('self_registration.fields.tipo') }}</dt>
                <dd>{{ acc.tipo || '—' }}</dd>
                <dt>{{ t('self_registration.fields.bloccato') }}</dt>
                <dd>{{ acc.bloccato === 'S' ? t('self_registration.detail.yes') : t('self_registration.detail.no') }}</dd>
                <dt>{{ t('self_registration.fields.vies_check') }}</dt>
                <dd class="d-flex align-center flex-wrap ga-2">
                  <v-chip size="small" variant="tonal" :color="viesColor(viesCheck)" data-testid="sr-vies-check">
                    {{ viesLabel(viesCheck) }}
                  </v-chip>
                  <v-btn size="small" variant="text" :prepend-icon="mdiShieldCheckOutline" :loading="viesBusy" data-testid="sr-vies" @click="checkVies">
                    {{ t('self_registration.detail.vies_check') }}
                  </v-btn>
                </dd>
                <template v-if="viesInfo">
                  <dt>{{ t('self_registration.detail.vies_name') }}</dt>
                  <dd>{{ viesInfo.name || '—' }}</dd>
                  <dt>{{ t('self_registration.detail.vies_address') }}</dt>
                  <dd class="sr-pre">{{ viesInfo.address || '—' }}</dd>
                </template>
              </dl>
              <v-divider class="my-3" />
              <div class="text-caption sr-muted mb-1">{{ t('self_registration.detail.billing_address') }}</div>
              <div v-if="reg.account.sede">
                {{ reg.account.sede.indirizzo || '—' }}<br />
                {{ [reg.account.sede.cap, reg.account.sede.citta, reg.account.sede.prov].filter(Boolean).join(' ') || '—' }}
                · {{ reg.account.sede.id_paese_iso || '—' }}
              </div>
              <div v-else class="sr-muted">—</div>
              <v-divider class="my-3" />
              <div class="text-caption sr-muted mb-1">{{ t('self_registration.detail.contact') }}</div>
              <div v-if="reg.account.contact" class="d-flex align-center flex-wrap ga-2">
                <span class="sr-mono">{{ reg.account.contact.loginn || `#${reg.account.contact.id}` }}</span>
                <v-chip size="x-small" variant="tonal">{{ reg.account.contact.stato || '—' }}</v-chip>
                <v-chip v-if="reg.account.contact.secure_credential" size="x-small" color="teal" variant="tonal" :prepend-icon="mdiLockCheckOutline">
                  {{ t('self_registration.detail.secure_credential') }}
                </v-chip>
              </div>
              <div v-else class="sr-muted">—</div>
            </template>
          </v-card>

          <v-card variant="outlined" class="pa-4 mb-4" data-testid="sr-duplicates">
            <div class="text-subtitle-2 mb-1">{{ t('self_registration.detail.section_duplicates') }}</div>
            <div class="text-caption sr-muted mb-3">{{ t('self_registration.detail.duplicates_hint') }}</div>
            <div v-if="reg.duplicates.length === 0" class="sr-muted">{{ t('self_registration.detail.no_duplicates') }}</div>
            <v-table v-else density="compact">
              <thead>
                <tr>
                  <th>{{ t('self_registration.fields.customer') }}</th>
                  <th>{{ t('self_registration.fields.pi_cf') }}</th>
                  <th>{{ t('self_registration.fields.reason') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in reg.duplicates" :key="`${d.id_anagrafica}-${d.reason}`">
                  <td>
                    <router-link :to="{ name: 'anagrafica-detail', params: { id: String(d.id_anagrafica) } }">
                      #{{ d.id_anagrafica }} · {{ d.rag_soc || '—' }}
                    </router-link>
                  </td>
                  <td class="sr-mono">{{ d.pi_cf || '—' }}</td>
                  <td>
                    <v-chip size="x-small" variant="tonal" color="warning">{{ t(`self_registration.duplicate_reason.${d.reason}`) }}</v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- Aprobar: confirma o corrige los datos fiscales y la sede de facturación. -->
    <v-dialog v-model="approveOpen" max-width="720" persistent>
      <v-card data-testid="sr-approve-dialog">
        <v-card-title>{{ t('self_registration.approve.title') }}</v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">{{ t('self_registration.approve.hint') }}</v-alert>
          <v-row dense>
            <v-col cols="12" md="7">
              <v-text-field
                v-model="form.rag_soc"
                :label="t('self_registration.fields.rag_soc')"
                :error-messages="fieldError('rag_soc')"
                density="compact"
                data-testid="sr-approve-rag-soc"
              />
            </v-col>
            <v-col cols="12" md="5">
              <v-text-field
                v-model="form.pi_cf"
                :label="t('self_registration.fields.pi_cf')"
                :error-messages="fieldError('pi_cf')"
                density="compact"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="form.sede.indirizzo"
                :label="t('self_registration.fields.indirizzo')"
                :error-messages="fieldError('sede.indirizzo')"
                density="compact"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field v-model="form.sede.cap" :label="t('self_registration.fields.cap')" :error-messages="fieldError('sede.cap')" density="compact" />
            </v-col>
            <v-col cols="12" md="5">
              <v-text-field v-model="form.sede.citta" :label="t('self_registration.fields.citta')" :error-messages="fieldError('sede.citta')" density="compact" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.sede.prov" :label="t('self_registration.fields.prov')" :error-messages="fieldError('sede.prov')" density="compact" />
            </v-col>
            <v-col cols="12" md="6">
              <CmCountrySelect v-model="countryModel" :label="t('self_registration.fields.country')" :clearable="false" />
              <div v-if="fieldError('sede.id_paese_iso')" class="text-error text-caption">{{ fieldError('sede.id_paese_iso') }}</div>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="approveNotes"
                :label="t('self_registration.approve.notes')"
                :hint="t('self_registration.approve.notes_hint')"
                persistent-hint
                rows="2"
                auto-grow
                density="compact"
              />
            </v-col>
          </v-row>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mt-3">{{ dialogError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="busy" @click="approveOpen = false">{{ t('self_registration.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="busy" data-testid="sr-approve-confirm" @click="submitApprove">
            {{ t('self_registration.approve.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Rechazar: motivo interno obligatorio y texto opcional para el cliente. -->
    <v-dialog v-model="rejectOpen" max-width="600" persistent>
      <v-card data-testid="sr-reject-dialog">
        <v-card-title>{{ t('self_registration.reject.title') }}</v-card-title>
        <v-card-text>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">{{ t('self_registration.reject.hint') }}</v-alert>
          <v-textarea
            v-model="rejectNotes"
            :label="t('self_registration.reject.notes') + ' *'"
            :hint="t('self_registration.reject.notes_hint')"
            :error-messages="fieldError('notes')"
            persistent-hint
            rows="3"
            auto-grow
            density="compact"
            class="mb-3"
            data-testid="sr-reject-notes"
          />
          <v-textarea
            v-model="rejectMessage"
            :label="t('self_registration.reject.customer_message')"
            :hint="t('self_registration.reject.customer_message_hint')"
            persistent-hint
            rows="3"
            auto-grow
            counter="1000"
            density="compact"
          />
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mt-3">{{ dialogError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="busy" @click="rejectOpen = false">{{ t('self_registration.cancel') }}</v-btn>
          <v-btn color="error" variant="flat" :loading="busy" data-testid="sr-reject-confirm" @click="submitReject">
            {{ t('self_registration.reject.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { mdiArrowLeft, mdiCheck, mdiClose, mdiLockCheckOutline, mdiShieldCheckOutline } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmCountrySelect from '../../anagrafiche/components/CmCountrySelect.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { viesService, type ViesResult } from '../../anagrafiche/services/vies.service';
import SelfRegistrationStatusChip from '../components/SelfRegistrationStatusChip.vue';
import { selfRegistrationErrorText, selfRegistrationFieldErrors } from '../utils/errors';
import {
  diffCorrections,
  formatDateTime,
  hoursSince,
  selfRegistrationService,
  type SelfRegistrationDetail,
} from '../services/selfRegistration.service';

/**
 * Ficha de una solicitud de auto-registro (`/settings/anagrafica/registrations/:id`, destino del aviso de la campana).
 * Muestra los datos, la traza (IP, consentimiento), la cuenta prospecto creada al activar, VIES y los posibles
 * duplicados; aprobar o rechazar solo se ofrece en `verified` (el api responde 409 `NOT_REVIEWABLE` si no).
 */
const props = defineProps<{ id: string | number }>();
const REMINDER_HOURS = 48;

const { t, te, locale } = useI18n();
const router = useRouter();
const toast = useToastStore();
const i18n = { t: (k: string, n?: Record<string, unknown>) => t(k, n ?? {}), te };

const reg = ref<SelfRegistrationDetail | null>(null);
const loading = ref(false);
const loadError = ref('');

const regId = computed(() => Number(props.id));
const acc = computed(() => reg.value?.account?.anagrafica ?? null);
const canDecide = computed(() => reg.value?.status === 'verified' && !!reg.value.account);
const waitingHours = computed(() => hoursSince(reg.value?.verified_at));

async function load(): Promise<void> {
  if (!regId.value) return;
  loading.value = true;
  loadError.value = '';
  try {
    reg.value = await selfRegistrationService.get(regId.value);
    viesOverride.value = null;
  } catch (e) {
    reg.value = null;
    loadError.value = selfRegistrationErrorText(e, i18n);
  } finally {
    loading.value = false;
  }
}

function back(): void {
  if (window.history.length > 1) router.back();
  else void router.push({ name: 'settings-self-registrations' });
}

// ── VIES: misma llamada que la ficha de anagrafica (api_anagrafica_vies con el id de la cuenta creada) ──────────
const viesBusy = ref(false);
const viesInfo = ref<ViesResult | null>(null);
const viesOverride = ref<string | null>(null);
const viesCheck = computed(() => viesOverride.value ?? acc.value?.vies_check ?? '');

function viesColor(v: string): string {
  if (v === 'OK') return 'success';
  if (v === 'KO') return 'error';
  return 'grey';
}
function viesLabel(v: string): string {
  const key = `self_registration.vies.${v || 'none'}`;
  return te(key) ? t(key) : v;
}

async function checkVies(): Promise<void> {
  if (!acc.value) return;
  viesBusy.value = true;
  try {
    const r = await viesService.check({ id_anagrafica: acc.value.id });
    viesInfo.value = r;
    if (r.vies_status) viesOverride.value = r.vies_status;
    if (r.vies_status === 'OK') toast.success(t('self_registration.vies.result_ok'));
    else toast.info(viesLabel(r.vies_status ?? ''));
  } catch (e) {
    toast.error(selfRegistrationErrorText(e, i18n));
  } finally {
    viesBusy.value = false;
  }
}

// ── Decisión ──────────────────────────────────────────────────────────────────────────────────────────────────
const busy = ref(false);
const dialogError = ref('');
const fieldErrors = ref<Record<string, string>>({});
function fieldError(k: string): string | undefined {
  return fieldErrors.value[k];
}
function resetDialog(): void {
  dialogError.value = '';
  fieldErrors.value = {};
}

const approveOpen = ref(false);
const approveNotes = ref('');
const form = reactive({
  rag_soc: '',
  pi_cf: '',
  sede: { indirizzo: '', citta: '', cap: '', prov: '', id_paese_iso: '' },
});
const countryModel = computed<string | null>({
  get: () => form.sede.id_paese_iso || null,
  set: (v) => {
    form.sede.id_paese_iso = v ?? '';
  },
});

function openApprove(): void {
  const a = reg.value?.account;
  form.rag_soc = a?.anagrafica?.rag_soc ?? reg.value?.company_name ?? '';
  form.pi_cf = a?.anagrafica?.pi_cf ?? reg.value?.vat_number ?? '';
  form.sede.indirizzo = a?.sede?.indirizzo ?? '';
  form.sede.citta = a?.sede?.citta ?? '';
  form.sede.cap = a?.sede?.cap ?? '';
  form.sede.prov = a?.sede?.prov ?? '';
  form.sede.id_paese_iso = a?.sede?.id_paese_iso ?? reg.value?.country_iso ?? '';
  approveNotes.value = '';
  resetDialog();
  approveOpen.value = true;
}

async function submitApprove(): Promise<void> {
  if (!reg.value) return;
  resetDialog();
  if (!form.rag_soc.trim()) {
    fieldErrors.value = { rag_soc: t('self_registration.field_error.required') };
    return;
  }
  const a = reg.value.account;
  const corrections = diffCorrections(
    { rag_soc: a?.anagrafica?.rag_soc, pi_cf: a?.anagrafica?.pi_cf, sede: a?.sede ?? null },
    { rag_soc: form.rag_soc, pi_cf: form.pi_cf, sede: { ...form.sede } },
  );
  busy.value = true;
  try {
    await selfRegistrationService.approve(reg.value.id, corrections, approveNotes.value);
    approveOpen.value = false;
    toast.success(t('self_registration.approve.done'));
    await load();
  } catch (e) {
    fieldErrors.value = selfRegistrationFieldErrors(e, i18n);
    dialogError.value = selfRegistrationErrorText(e, i18n);
    if (isStale(e)) await load();
  } finally {
    busy.value = false;
  }
}

const rejectOpen = ref(false);
const rejectNotes = ref('');
const rejectMessage = ref('');

function openReject(): void {
  rejectNotes.value = '';
  rejectMessage.value = '';
  resetDialog();
  rejectOpen.value = true;
}

async function submitReject(): Promise<void> {
  if (!reg.value) return;
  resetDialog();
  if (!rejectNotes.value.trim()) {
    fieldErrors.value = { notes: t('self_registration.field_error.required') };
    return;
  }
  busy.value = true;
  try {
    await selfRegistrationService.reject(reg.value.id, rejectNotes.value, rejectMessage.value);
    rejectOpen.value = false;
    toast.success(t('self_registration.reject.done'));
    await load();
  } catch (e) {
    fieldErrors.value = selfRegistrationFieldErrors(e, i18n);
    dialogError.value = selfRegistrationErrorText(e, i18n);
    if (isStale(e)) await load();
  } finally {
    busy.value = false;
  }
}

/** Otra persona decidió entretanto: se recarga la ficha para que se vea el estado real. */
function isStale(e: unknown): boolean {
  const s = (e as { status?: unknown } | null)?.status;
  return s === 409;
}

watch(regId, () => void load(), { immediate: true });
</script>

<style scoped>
.sr-dl {
  display: grid;
  grid-template-columns: minmax(120px, 38%) 1fr;
  gap: 6px 12px;
  margin: 0;
}
.sr-dl dt {
  color: var(--cm-text-muted);
  font-size: var(--cm-fs-xs, 12px);
}
.sr-dl dd {
  margin: 0;
  word-break: break-word;
}
.sr-muted {
  color: var(--cm-text-muted);
}
.sr-mono {
  font-family: var(--cm-font-mono, monospace);
}
.sr-small {
  font-size: var(--cm-fs-xs, 12px);
}
.sr-pre {
  white-space: pre-wrap;
}
</style>
