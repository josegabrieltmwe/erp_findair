<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { addDays, pickupColorKind, startOfWeek, type PeriodCell } from "../logic";
import type { Pickup } from "../types";

/**
 * Rejilla de semana o mes: una celda por día con el número de presas, las
 * asignadas y las pendientes, y las presas como chips (máx. `maxChips` en el mes).
 * Pulsar el día emite `day`; pulsar una presa, `pick`.
 */
const { t, locale } = useI18n();

const props = defineProps<{
  cells: PeriodCell[];
  view: "week" | "month";
}>();
const emit = defineEmits<{ day: [string]; pick: [Pickup] }>();

const maxChips = computed(() => (props.view === "week" ? 50 : 3));

/** Cabeceras lunes a domingo en el idioma activo. */
const weekdays = computed(() => {
  const monday = startOfWeek("2024-01-03");
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = addDays(monday, i).split("-").map(Number);
    return fmt.format(new Date(y, m - 1, d));
  });
});

function dayNumber(iso: string): number {
  return Number(iso.slice(8, 10));
}
</script>

<template>
  <div class="cp-wrap">
    <div class="cp-grid" role="grid">
      <div v-for="w in weekdays" :key="w" class="cp-head">{{ w }}</div>
      <div
        v-for="c in cells"
        :key="c.date"
        class="cp-cell"
        :class="{ 'cp-cell--out': !c.inPeriod, 'cp-cell--today': c.isToday }"
      >
        <button class="cp-day" @click="emit('day', c.date)">
          <span class="cp-day-num">{{ dayNumber(c.date) }}</span>
          <span v-if="c.count" class="cp-day-count">
            {{ c.count }}
            <span v-if="c.notAssigned" class="cp-pending" :title="t('pickup.calendar.not_assigned')">
              · {{ c.notAssigned }}
            </span>
          </span>
        </button>
        <button
          v-for="p in c.pickups.slice(0, maxChips)"
          :key="p.id"
          class="cp-chip"
          :class="`cp-chip--${pickupColorKind(p)}`"
          @click="emit('pick', p)"
        >
          #{{ p.id }}
          <span class="cp-chip-time">{{ (p.data.split(" ")[1] ?? "").slice(0, 5) }}</span>
        </button>
        <button
          v-if="c.pickups.length > maxChips"
          class="cp-more"
          @click="emit('day', c.date)"
        >
          {{ t("pickup.calendar.more", { n: c.pickups.length - maxChips }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cp-wrap {
  overflow-x: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}
.cp-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(110px, 1fr));
  min-width: 770px;
}
.cp-head {
  padding: 6px;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: capitalize;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.cp-cell {
  min-height: 96px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.cp-cell--out {
  background: rgba(var(--v-theme-on-surface), 0.03);
  opacity: 0.6;
}
.cp-cell--today .cp-day-num {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border-radius: 50%;
  padding: 0 6px;
}
.cp-day {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px;
}
.cp-day-count {
  font-size: 0.72rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.cp-pending {
  color: rgb(var(--v-theme-warning));
}
.cp-chip {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  border: none;
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 0.72rem;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
.cp-chip--fixed {
  background: rgba(var(--v-theme-info), 0.16);
  color: rgb(var(--v-theme-info));
}
.cp-chip--with_shipment {
  background: rgba(var(--v-theme-secondary), 0.16);
  color: rgb(var(--v-theme-secondary));
}
.cp-chip--triangulation {
  background: rgba(var(--v-theme-warning), 0.2);
  color: rgb(var(--v-theme-warning));
}
.cp-chip-time {
  opacity: 0.8;
}
.cp-more {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.72rem;
  text-align: left;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
