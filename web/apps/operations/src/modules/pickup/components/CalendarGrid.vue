<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Pickup } from "../types";

/**
 * Rejilla autista × franja de media hora — paridad con gest_oper_leggiprese.
 * Cada fila es una media hora (09:00, 09:30, …); cada columna un autista. Una
 * presa cae en la celda [franja de su hora][su autista]. Las prese sin autista
 * (id_contatti=0) van a la columna "Sin asignar".
 */
const { t } = useI18n();

const props = defineProps<{
  pickups: Pickup[];
  fromHour?: number;
  toHour?: number;
}>();
const emit = defineEmits<{ pick: [Pickup] }>();

const FROM = computed(() => props.fromHour ?? 8);
const TO = computed(() => props.toHour ?? 19);

/** Franjas de media hora entre FROM y TO. */
const slots = computed(() => {
  const out: string[] = [];
  for (let h = FROM.value; h <= TO.value; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== TO.value) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
});

/** Columnas de autista presentes en las prese (0 = sin asignar), ordenadas. */
const drivers = computed(() => {
  const ids = new Set<number>();
  for (const p of props.pickups) ids.add(p.id_contatti || 0);
  return Array.from(ids).sort((a, b) => a - b);
});

function driverLabel(id: number): string {
  return id === 0 ? t("pickup.calendar.unassigned") : `#${id}`;
}

/** Media-hora de una presa: "HH:00" o "HH:30" según los minutos. */
function slotOf(p: Pickup): string {
  const time = (p.data.split(" ")[1] ?? "00:00:00").slice(0, 5);
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
}

function cellPickups(slot: string, driverId: number): Pickup[] {
  return props.pickups.filter(
    (p) => slotOf(p) === slot && (p.id_contatti || 0) === driverId,
  );
}
</script>

<template>
  <div class="cal-wrap">
    <table class="cal">
      <thead>
        <tr>
          <th class="cal-time-h">{{ t("pickup.calendar.time") }}</th>
          <th v-for="d in drivers" :key="d" class="cal-driver-h">
            {{ driverLabel(d) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="slot in slots" :key="slot">
          <td class="cal-time">{{ slot }}</td>
          <td v-for="d in drivers" :key="d" class="cal-cell">
            <button
              v-for="p in cellPickups(slot, d)"
              :key="p.id"
              class="cal-chip"
              :class="{
                'cal-chip--fixed': p.presa_fissa === 'S',
                'cal-chip--done': p.affidata === 'S',
              }"
              @click="emit('pick', p)"
            >
              <span class="cal-chip-id">#{{ p.id }}</span>
              <span v-if="p.presa_fissa === 'S'" class="cal-chip-tag">{{
                t("pickup.calendar.fixed")
              }}</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.cal-wrap {
  overflow-x: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}
.cal {
  border-collapse: collapse;
  width: 100%;
  min-width: 480px;
  font-size: 0.8rem;
}
.cal th,
.cal td {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  padding: 4px 6px;
}
.cal-time-h,
.cal-driver-h {
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-weight: 600;
  position: sticky;
  top: 0;
}
.cal-time,
.cal-time-h {
  white-space: nowrap;
  text-align: right;
  color: rgba(var(--v-theme-on-surface), 0.6);
  width: 60px;
}
.cal-cell {
  vertical-align: top;
  min-width: 90px;
  height: 30px;
}
.cal-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 2px;
  padding: 2px 6px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-size: 0.72rem;
}
.cal-chip--fixed {
  background: rgba(var(--v-theme-info), 0.16);
  color: rgb(var(--v-theme-info));
}
.cal-chip--done {
  background: rgba(var(--v-theme-success), 0.16);
  color: rgb(var(--v-theme-success));
}
.cal-chip-tag {
  font-size: 0.62rem;
  opacity: 0.8;
}
</style>
