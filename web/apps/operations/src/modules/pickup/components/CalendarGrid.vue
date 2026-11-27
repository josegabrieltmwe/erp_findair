<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  pickupAddress,
  pickupAddressTooltip,
  pickupColorKind,
  type PickupAddressView,
} from "../logic";
import type { Pickup } from "../types";

/**
 * Rejilla autista × franja de media hora — paridad con gest_oper_leggiprese.
 * Cada fila es una media hora (09:00, 09:30, …); cada columna un autista. Una
 * presa cae en la celda [franja de su hora][su autista]. Las prese sin autista
 * (id_contatti=0) van a la columna "Sin asignar".
 *
 * Con `showAddress` cada presa lleva debajo el nombre, la dirección y el contacto (los mismos que el tablero de
 * autistas y el borderò); el resto, al pasar el ratón.
 */
const { t } = useI18n();

const props = defineProps<{
  pickups: Pickup[];
  fromHour?: number;
  toHour?: number;
  showAddress?: boolean;
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

/** Nombre resuelto por autista (N61: antes se pintaba #id). Cae a #id si el nombre no llegó. */
const driverNames = computed(() => {
  const map = new Map<number, string>();
  for (const p of props.pickups) {
    const id = p.id_contatti || 0;
    if (id && p.driver?.nome) map.set(id, p.driver.nome);
  }
  return map;
});

function driverLabel(id: number): string {
  if (id === 0) return t("pickup.calendar.unassigned");
  return driverNames.value.get(id) ?? `#${id}`;
}

/** Media-hora de una presa: "HH:00" o "HH:30" según los minutos. */
function slotOf(p: Pickup): string {
  const time = (p.data.split(" ")[1] ?? "00:00:00").slice(0, 5);
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
}

const ORIGIN_ICON: Record<string, string> = {
  sede: "mdi-office-building-outline",
  expedicion: "mdi-package-variant-closed",
  sede_sin_expedicion: "mdi-alert-outline",
};

/** Nombre, dirección y contacto de cada presa (por id), vacío si no se piden; sin entrada si el API no los manda. */
const addresses = computed(() => {
  const map = new Map<number, PickupAddressView>();
  if (!props.showAddress) return map;
  for (const p of props.pickups) {
    const a = pickupAddress(p);
    if (a) map.set(p.id, a);
  }
  return map;
});

function tooltipOf(p: Pickup): string | undefined {
  const a = addresses.value.get(p.id);
  return a ? pickupAddressTooltip(a, t) : undefined;
}

function cellPickups(slot: string, driverId: number): Pickup[] {
  return props.pickups.filter(
    (p) => slotOf(p) === slot && (p.id_contatti || 0) === driverId,
  );
}
</script>

<template>
  <div class="cal-wrap">
    <table class="cal" :class="{ 'cal--addresses': showAddress }">
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
                'cal-chip--fixed': pickupColorKind(p) === 'fixed',
                'cal-chip--ship': pickupColorKind(p) === 'with_shipment',
                'cal-chip--tri': pickupColorKind(p) === 'triangulation',
                'cal-chip--done':
                  p.affidata === 'S' && pickupColorKind(p) === 'normal',
                'cal-chip--wide': addresses.has(p.id),
              }"
              :title="tooltipOf(p)"
              data-testid="cal-pickup"
              @click="emit('pick', p)"
            >
              <span class="cal-chip-head">
                <span class="cal-chip-id">#{{ p.id }}</span>
                <span v-if="p.presa_fissa === 'S'" class="cal-chip-tag">{{
                  t("pickup.calendar.fixed")
                }}</span>
                <span
                  v-if="addresses.get(p.id)?.name"
                  class="cal-chip-name"
                  data-testid="cal-name"
                  >{{ addresses.get(p.id)?.name }}</span
                >
              </span>
              <span
                v-if="addresses.get(p.id)"
                class="cal-chip-line"
                data-testid="cal-address"
              >
                <v-icon
                  :icon="
                    ORIGIN_ICON[addresses.get(p.id)!.origin] ?? ORIGIN_ICON.sede
                  "
                  :color="addresses.get(p.id)!.warning ? 'warning' : undefined"
                  size="12"
                  :data-origin="addresses.get(p.id)!.origin"
                />
                <span class="cal-chip-text">{{
                  addresses.get(p.id)!.line
                }}</span>
              </span>
              <span
                v-if="addresses.get(p.id)?.contact"
                class="cal-chip-line"
                data-testid="cal-contact"
              >
                <v-icon icon="mdi-phone-outline" size="12" />
                <span class="cal-chip-text">{{
                  addresses.get(p.id)!.contact
                }}</span>
              </span>
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
.cal-chip--ship {
  background: rgba(var(--v-theme-secondary), 0.16);
  color: rgb(var(--v-theme-secondary));
}
.cal-chip--tri {
  background: rgba(var(--v-theme-warning), 0.2);
  color: rgb(var(--v-theme-warning));
}
.cal-chip--done {
  background: rgba(var(--v-theme-success), 0.16);
  color: rgb(var(--v-theme-success));
}
.cal-chip--wide {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: calc(100% - 4px);
  text-align: left;
}
.cal-chip-head {
  display: flex;
  align-items: baseline;
  gap: 4px;
  max-width: 100%;
}
.cal-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}
.cal-chip-line {
  display: flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.cal-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cal--addresses .cal-cell {
  min-width: 180px;
  max-width: 240px;
}
.cal-chip-tag {
  font-size: 0.62rem;
  opacity: 0.8;
}
</style>
