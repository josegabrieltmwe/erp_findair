<template>
  <div class="sr-page">
    <CmSectionHeader :title="t('self_registration.queue.title')" :subtitle="t('self_registration.queue.subtitle')">
      <template #actions>
        <v-btn variant="text" size="small" :prepend-icon="mdiRefresh" :loading="loading" data-testid="sr-reload" @click="reload">
          {{ t('self_registration.queue.reload') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <div class="sr-filters">
      <v-select
        v-model="status"
        :items="statusItems"
        :label="t('self_registration.queue.filter_status')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="sr-filter-narrow"
        data-testid="sr-filter-status"
      />
      <v-text-field
        v-model="dateFrom"
        type="date"
        :label="t('self_registration.queue.filter_date_from')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="sr-filter-date"
      />
      <v-text-field
        v-model="dateTo"
        type="date"
        :label="t('self_registration.queue.filter_date_to')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="sr-filter-date"
      />
      <v-text-field
        v-model="search"
        :label="t('self_registration.queue.filter_search')"
        :prepend-inner-icon="mdiMagnify"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="sr-filter-search"
        data-testid="sr-filter-search"
      />
      <div v-if="isTmwe" class="sr-filter-titolare">
        <CmAnagraficaAutocomplete v-model="titolareId" :label="t('self_registration.queue.filter_titolare')" />
      </div>
    </div>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4" data-testid="sr-load-error">{{ loadError }}</v-alert>

    <v-card variant="outlined">
      <v-table density="compact" hover data-testid="sr-table">
        <thead>
          <tr>
            <th>{{ t('self_registration.fields.id') }}</th>
            <th>{{ t('self_registration.fields.created_at') }}</th>
            <th>{{ t('self_registration.fields.company_name') }}</th>
            <th>{{ t('self_registration.fields.person') }}</th>
            <th>{{ t('self_registration.fields.email') }}</th>
            <th>{{ t('self_registration.fields.country') }}</th>
            <th>{{ t('self_registration.fields.vat_number') }}</th>
            <th>{{ t('self_registration.fields.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && items.length === 0">
            <td colspan="8" class="text-center sr-muted py-6">{{ t('self_registration.queue.empty') }}</td>
          </tr>
          <tr
            v-for="r in items"
            :key="r.id"
            class="sr-row"
            :data-testid="`sr-row-${r.id}`"
            tabindex="0"
            @click="open(r)"
            @keydown.enter="open(r)"
          >
            <td class="sr-mono">{{ r.id }}</td>
            <td class="sr-nowrap">{{ formatDateTime(r.created_at, locale) }}</td>
            <td class="font-weight-medium">{{ r.company_name || '—' }}</td>
            <td>{{ [r.first_name, r.last_name].filter(Boolean).join(' ') || '—' }}</td>
            <td>{{ r.email }}</td>
            <td>{{ r.country_iso || '—' }}</td>
            <td class="sr-mono">{{ r.vat_number || '—' }}</td>
            <td class="sr-nowrap">
              <SelfRegistrationStatusChip :status="r.status" />
              <v-chip
                v-if="isOverdue(r)"
                size="x-small"
                color="warning"
                variant="tonal"
                class="ml-1"
                :title="t('self_registration.queue.overdue_hint', { hours: hoursSince(r.verified_at) ?? 0 })"
              >
                {{ t('self_registration.queue.overdue') }}
              </v-chip>
            </td>
          </tr>
        </tbody>
      </v-table>
      <div class="sr-pager">
        <span class="sr-muted">{{ t('self_registration.queue.total', { n: total }) }}</span>
        <v-spacer />
        <v-pagination v-if="pages > 1" v-model="page" :length="pages" density="compact" total-visible="7" />
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { mdiMagnify, mdiRefresh } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useAnagraficaContext } from '../../anagrafiche/composables/useAnagraficaContext';
import { useDebouncedCallback } from '../../anagrafiche/composables/useDebouncedRef';
import { localizedErrorText } from '../../utils/apiError';
import SelfRegistrationStatusChip from '../components/SelfRegistrationStatusChip.vue';
import {
  SELF_REGISTRATION_STATUSES,
  formatDateTime,
  hoursSince,
  selfRegistrationService,
  type SelfRegistrationRow,
  type SelfRegistrationStatus,
} from '../services/selfRegistration.service';

/**
 * Cola de solicitudes de auto-registro de FindAir (Ajustes › Anagrafica). Cada partner ve solo las suyas (lo aplica
 * el api); TMWE ve todas y puede acotar por titular. Por defecto se muestran las que esperan decisión (`verified`).
 */
const PER_PAGE = 25;
/** Mismo umbral que el recordatorio del api (Self_Registration_Review_Service::REMINDER_HOURS). */
const REMINDER_HOURS = 48;

const { t, te, locale } = useI18n();
const router = useRouter();
const { isTmwe } = useAnagraficaContext();

const status = ref<SelfRegistrationStatus | null>('verified');
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const search = ref<string | null>('');
const titolareId = ref<number | null>(null);
const page = ref(1);

const items = ref<SelfRegistrationRow[]>([]);
const total = ref(0);
const loading = ref(false);
const loadError = ref('');
const pages = computed(() => Math.max(1, Math.ceil(total.value / PER_PAGE)));

const statusItems = computed(() =>
  SELF_REGISTRATION_STATUSES.map((s) => ({ title: t(`self_registration.status.${s}`), value: s })),
);

function isOverdue(r: SelfRegistrationRow): boolean {
  if (r.status !== 'verified') return false;
  const h = hoursSince(r.verified_at);
  return h !== null && h >= REMINDER_HOURS;
}

let seq = 0;
async function reload(): Promise<void> {
  const mine = ++seq;
  loading.value = true;
  loadError.value = '';
  try {
    const res = await selfRegistrationService.list({
      status: status.value,
      date_from: dateFrom.value,
      date_to: dateTo.value,
      q: search.value,
      page: page.value,
      per_page: PER_PAGE,
      id_anagr_titolare: isTmwe.value ? titolareId.value : null,
    });
    if (mine !== seq) return;
    items.value = res.items;
    total.value = res.total;
  } catch (e) {
    if (mine !== seq) return;
    items.value = [];
    total.value = 0;
    loadError.value = localizedErrorText(e, { t: (k) => t(k), te }, t('self_registration.errors.generic'));
  } finally {
    if (mine === seq) loading.value = false;
  }
}

function open(r: SelfRegistrationRow): void {
  void router.push({ name: 'settings-self-registration-detail', params: { id: String(r.id) } });
}

const searchLater = useDebouncedCallback(() => {
  page.value = 1;
  void reload();
}, 350);

watch([status, dateFrom, dateTo, titolareId], () => {
  if (page.value !== 1) page.value = 1;
  else void reload();
});
watch(search, () => searchLater());
watch(page, () => void reload());
onMounted(reload);
</script>

<style scoped>
.sr-page {
  display: flex;
  flex-direction: column;
}
.sr-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--cm-space-md, 16px);
  align-items: center;
  margin-bottom: var(--cm-space-md, 16px);
}
.sr-filter-narrow {
  max-width: 240px;
}
.sr-filter-date {
  max-width: 180px;
}
.sr-filter-search {
  min-width: 220px;
  max-width: 340px;
  flex: 1 1 auto;
}
.sr-filter-titolare {
  min-width: 260px;
}
.sr-row {
  cursor: pointer;
}
.sr-pager {
  display: flex;
  align-items: center;
  padding: 8px 16px;
}
.sr-muted {
  color: var(--cm-text-muted);
  font-size: var(--cm-fs-xs, 12px);
}
.sr-mono {
  font-family: var(--cm-font-mono, monospace);
}
.sr-nowrap {
  white-space: nowrap;
}
</style>
