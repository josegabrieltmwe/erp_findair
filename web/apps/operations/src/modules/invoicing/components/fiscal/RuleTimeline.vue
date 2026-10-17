<template>
  <div class="fisc-timeline">
    <div
      v-if="groups.length === 0"
      class="text-medium-emphasis py-6 text-center"
    >
      {{ t("invoicing.fiscal.empty") }}
    </div>

    <div v-if="groups.length" class="fisc-axis">
      <span>{{ span.from }}</span>
      <span class="fisc-axis-today" :style="{ left: pct(today) + '%' }">
        {{ t("invoicing.fiscal.today") }}
      </span>
      <span>{{ span.to }}</span>
    </div>

    <v-card
      v-for="g in groups"
      :key="g.key"
      variant="outlined"
      class="mb-2 pa-2"
    >
      <div class="d-flex align-center flex-wrap ga-1 mb-1">
        <v-chip
          v-for="p in g.labels"
          :key="p.key"
          size="x-small"
          variant="tonal"
          :color="p.main ? 'primary' : undefined"
        >
          <span v-if="!p.main" class="text-medium-emphasis mr-1"
            >{{ t(`invoicing.fiscal.field.${p.key}`) }}:</span
          >
          {{ p.value }}
        </v-chip>
      </div>

      <!-- Barra proporcional: un segmento por fila, marca de hoy -->
      <div class="fisc-bar">
        <div
          v-for="r in g.rows"
          :key="String(r.id)"
          class="fisc-seg"
          :class="`fisc-seg--${r.situacion.toLowerCase()}`"
          :style="segStyle(r)"
          :title="`#${r.id} · ${r.data_inizio} → ${r.data_fine ?? t('invoicing.fiscal.open')} · ${summary(r)}`"
        >
          <span class="fisc-seg-label">{{ summary(r) }}</span>
        </div>
        <div class="fisc-bar-today" :style="{ left: pct(today) + '%' }" />
      </div>

      <!-- Filas por fecha -->
      <v-table density="compact" class="fisc-rows mt-1">
        <tbody>
          <tr v-for="r in g.rows" :key="String(r.id)">
            <td class="text-medium-emphasis">#{{ r.id }}</td>
            <td class="text-no-wrap">
              {{ r.data_inizio }} →
              {{ r.data_fine ?? t("invoicing.fiscal.open") }}
            </td>
            <td>
              <strong>{{ summary(r) }}</strong>
            </td>
            <td class="fisc-desc">
              {{ descripcionVisible(String(r.descrizione ?? "")) }}
            </td>
            <td>
              <v-chip
                size="x-small"
                variant="flat"
                :color="situacionColor(r.situacion)"
              >
                {{ t(`invoicing.fiscal.situacion.${r.situacion}`) }}
              </v-chip>
            </td>
            <td class="text-right text-no-wrap">
              <template v-if="canWrite">
                <v-btn
                  v-if="versioned"
                  icon="mdi-calendar-arrow-right"
                  size="x-small"
                  variant="text"
                  color="primary"
                  :title="t('invoicing.fiscal.actions.change')"
                  @click="emit('change', r)"
                />
                <v-btn
                  icon="mdi-calendar-end"
                  size="x-small"
                  variant="text"
                  :title="t('invoicing.fiscal.actions.close')"
                  @click="emit('end', r)"
                />
                <v-btn
                  icon="mdi-delete-outline"
                  size="x-small"
                  variant="text"
                  color="error"
                  :title="t('invoicing.fiscal.actions.deactivate')"
                  @click="emit('deactivate', r)"
                />
              </template>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type {
  FiscRow,
  FiscTabla,
  Situacion,
} from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import {
  SCOPE_FIELDS,
  cellText,
  descripcionVisible,
  valueSummary,
} from "./fiscFields";

const props = defineProps<{
  tabla: FiscTabla;
  rows: FiscRow[];
  today: string;
  canWrite: boolean;
  versioned: boolean;
}>();

const emit = defineEmits<{
  (e: "change", row: FiscRow): void;
  (e: "end", row: FiscRow): void;
  (e: "deactivate", row: FiscRow): void;
}>();

const { t } = useI18n();
const store = useFiscConfigStore();

const DAY = 86400000;

function toDays(d: string): number {
  return Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY);
}

function fromDays(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

/** Ventana: desde hace 2 años (o el primer inicio) hasta 1 año vista (o el último fin). */
const span = computed(() => {
  const today = toDays(props.today);
  let from = today - 730;
  let to = today + 365;
  for (const r of props.rows) {
    from = Math.max(Math.min(from, toDays(r.data_inizio)), today - 3650);
    if (r.data_fine) to = Math.max(to, toDays(r.data_fine) + 1);
    to = Math.max(to, toDays(r.data_inizio) + 30);
  }
  return { from: fromDays(from), to: fromDays(to), fromN: from, toN: to };
});

function pct(d: string): number {
  const w = span.value;
  const v = (toDays(d) - w.fromN) / Math.max(1, w.toN - w.fromN);
  return Math.min(100, Math.max(0, v * 100));
}

function segStyle(r: FiscRow): Record<string, string> {
  const left = pct(r.data_inizio);
  const end = r.data_fine ? fromDays(toDays(r.data_fine) + 1) : span.value.to;
  const right = pct(end);
  return { left: `${left}%`, width: `${Math.max(0.6, right - left)}%` };
}

const groups = computed(() => {
  const scope = SCOPE_FIELDS[props.tabla];
  const map = new Map<string, FiscRow[]>();
  for (const r of props.rows) {
    const key = scope.map((f) => `${f}=${String(r[f] ?? "")}`).join("|");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const all = t("invoicing.fiscal.all");
  return [...map.entries()]
    .map(([key, rows]) => {
      rows.sort((a, b) => a.data_inizio.localeCompare(b.data_inizio));
      const labels = scope
        .map((f, i) => {
          const raw = rows[0][f];
          const value =
            f === "id_voce" ? store.voceCode(raw) : cellText(f, raw, all);
          return { key: f, value: value || all, main: i === 0 };
        })
        .filter((l) => l.main || l.value !== all);
      return { key, rows, labels };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
});

function summary(r: FiscRow): string {
  return valueSummary(props.tabla, r) || "—";
}

function situacionColor(s: Situacion): string {
  return s === "VIGENTE" ? "success" : s === "FUTURA" ? "info" : "grey";
}
</script>

<style scoped>
.fisc-axis {
  position: relative;
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 4px;
  height: 16px;
}

.fisc-axis-today {
  position: absolute;
  transform: translateX(-50%);
  font-weight: 600;
  color: rgb(var(--v-theme-error));
}

.fisc-bar {
  position: relative;
  height: 22px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  overflow: hidden;
}

.fisc-seg {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 3px;
  padding: 0 4px;
  overflow: hidden;
  white-space: nowrap;
  font-size: 0.72rem;
  line-height: 18px;
  color: #fff;
  border-right: 2px solid rgb(var(--v-theme-surface));
}

.fisc-seg--vigente {
  background: rgb(var(--v-theme-success));
}

.fisc-seg--futura {
  background: rgb(var(--v-theme-info));
}

.fisc-seg--cerrada {
  background: rgba(var(--v-theme-on-surface), 0.35);
}

.fisc-bar-today {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgb(var(--v-theme-error));
}

.fisc-rows td {
  padding: 0 6px !important;
  height: 30px !important;
  font-size: 0.82rem;
}

.fisc-desc {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
