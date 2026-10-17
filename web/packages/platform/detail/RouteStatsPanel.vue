<template>
  <div v-if="country" class="route-stats mt-2">
    <v-btn
      size="x-small"
      variant="text"
      :prepend-icon="open ? 'mdi-chevron-up' : 'mdi-chart-timeline-variant'"
      :loading="loading"
      @click="toggle"
    >
      {{ t('platform.route_stats.title') }}
      <span v-if="rows.length" class="text-medium-emphasis ms-1">({{ rows.length }})</span>
    </v-btn>

    <v-expand-transition>
      <div v-if="open" class="mt-2">
        <v-alert v-if="!rows.length && !loading" type="info" variant="tonal" density="compact">
          {{ message || t('platform.route_stats.empty') }}
        </v-alert>
        <v-table v-else density="compact" class="route-stats__table">
          <thead>
            <tr>
              <th>{{ t('platform.route_stats.col_service') }}</th>
              <th class="text-end">{{ t('platform.route_stats.col_deliveries') }}</th>
              <th class="text-end">{{ t('platform.route_stats.col_on_time') }}</th>
              <th class="text-end">{{ t('platform.route_stats.col_avg_days') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in grouped" :key="g.key">
              <td>
                <span class="font-weight-medium">{{ g.courier }}</span>
                <span class="text-medium-emphasis"> · {{ g.service }}</span>
              </td>
              <td class="text-end">{{ g.count }}</td>
              <td class="text-end">
                <v-chip size="x-small" :color="g.onTimePct >= 80 ? 'success' : g.onTimePct >= 50 ? 'warning' : 'error'" variant="tonal">
                  {{ g.onTimePct }}%
                </v-chip>
              </td>
              <td class="text-end metric-mono">{{ g.avgDays }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { stripTags } from '../utils/text';

const { t } = useI18n();

/**
 * Historical delivery stats per destination route (legacy spedy_form_ajax_stats
 * / SpedDett). Store-agnostic: the host injects a `fetcher` that calls its own
 * route-stats service (cargo / shipment both hit ajax_route_stats). Shared by
 * both detail pages via @shared/detail/RouteStatsPanel.
 */
export interface RouteStatsRow {
  id_fornitore: number;
  id_servizio_fornitore: number;
  courier_label: string;
  service_label: string;
  data_corriere: string;
  data_consegna_prevista: string;
  consegna_data: string;
}

export interface RouteStatsResult {
  rows?: RouteStatsRow[];
  message?: string;
}

const props = defineProps<{
  country?: string;
  cap?: string;
  city?: string;
  /** Calls the host's route-stats service (ajax_route_stats). */
  fetcher: (params: { country: string; cap: string; city: string }) => Promise<RouteStatsResult>;
}>();

const open = ref(false);
const loading = ref(false);
const rows = ref<RouteStatsRow[]>([]);
const message = ref('');

const country = computed(() => (props.country ?? '').trim());

async function load(): Promise<void> {
  if (!country.value) return;
  loading.value = true;
  message.value = '';
  try {
    const res = await props.fetcher({ country: country.value, cap: props.cap ?? '', city: props.city ?? '' });
    rows.value = res.rows ?? [];
    if (!rows.value.length) message.value = res.message ?? '';
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

async function toggle(): Promise<void> {
  open.value = !open.value;
  if (open.value && rows.value.length === 0) await load();
}

/** Days between two dates (Y-m-d[ H:i:s]); null when unparseable. */
function dayDelta(from: string, to: string): number | null {
  const a = new Date(String(from).slice(0, 10));
  const b = new Date(String(to).slice(0, 10));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const grouped = computed(() => {
  const map = new Map<string, { courier: string; service: string; count: number; onTime: number; daysSum: number; daysN: number }>();
  for (const r of rows.value) {
    const key = `${r.id_fornitore}-${r.id_servizio_fornitore}`;
    let g = map.get(key);
    if (!g) {
      g = { courier: r.courier_label, service: stripTags(r.service_label), count: 0, onTime: 0, daysSum: 0, daysN: 0 };
      map.set(key, g);
    }
    g.count++;
    const onTimeDelta = dayDelta(r.consegna_data, r.data_consegna_prevista);
    if (onTimeDelta !== null && onTimeDelta >= 0) g.onTime++;
    const transit = dayDelta(r.data_corriere, r.consegna_data);
    if (transit !== null && transit >= 0) { g.daysSum += transit; g.daysN++; }
  }
  return Array.from(map.entries()).map(([key, g]) => ({
    key,
    courier: g.courier,
    service: g.service,
    count: g.count,
    onTimePct: g.count ? Math.round((g.onTime / g.count) * 100) : 0,
    avgDays: g.daysN ? (g.daysSum / g.daysN).toFixed(1) : '—',
  }));
});

</script>

<style scoped>
.route-stats__table th { font-size: 11px; }
.metric-mono { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
</style>
