<script setup lang="ts">
import { todayLocal } from "@shared/utils/date";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import PickupBoardChip from "../components/PickupBoardChip.vue";
import ScheduleAssignDialog from "../components/ScheduleAssignDialog.vue";
import { pickupsService } from "../services/pickups.service";
import { buildScheduleCells, buildTimeSlots, scheduleCellKey } from "../logic";
import type { Driver, Pickup } from "../types";

/**
 * Tablero de asignación por franja horaria (U-14, G29): columnas = autistas,
 * filas = franjas de 30 min, igual que el grid de `gest_oper_list.php` del
 * legado — asignar aquí fija autista+hora en una sola acción.
 *
 * U-15: cada presa lleva al lado su dirección (la sede o la de la expedición, como el borderò). El interruptor
 * «Mostrar direcciones» vuelve al tablero compacto y se recuerda en este navegador.
 */
const { t } = useI18n();

const date = ref(todayLocal());
const drivers = ref<Driver[]>([]);
const pickups = ref<Pickup[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const dialogOpen = ref(false);
const dialogPickup = ref<Pickup | null>(null);
const dialogSlot = ref<string | null>(null);

const SHOW_ADDRESSES_KEY = "tmwe:pickup-board-show-addresses";
function readShowAddresses(): boolean {
  try {
    return localStorage.getItem(SHOW_ADDRESSES_KEY) !== "0";
  } catch {
    return true;
  }
}
const showAddresses = ref(readShowAddresses());
watch(showAddresses, (v) => {
  try {
    localStorage.setItem(SHOW_ADDRESSES_KEY, v ? "1" : "0");
  } catch {
    /* navegador sin almacenamiento: la preferencia dura la sesión */
  }
});

function unassignedSuffix(p: Pickup): string {
  const parts = [p.sede?.label || String(p.id_sede)];
  if (p.n_colli) parts.push(String(p.n_colli));
  return ` · ${parts.join(" · ")}`;
}

const slots = computed(() => buildTimeSlots());
const unassigned = computed(() => pickups.value.filter((p) => !p.id_contatti));
const cells = computed(() => buildScheduleCells(pickups.value));

function pickupsInCell(driverId: number, slot: string): Pickup[] {
  const idx = cells.value.get(scheduleCellKey(driverId, slot)) ?? [];
  return idx.map((i) => pickups.value[i]);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [driverList, list] = await Promise.all([
      pickupsService.availableDrivers(date.value),
      pickupsService.list({ data: date.value }, 1, 200),
    ]);
    drivers.value = driverList;
    pickups.value = list.data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

function openAssign(pickup: Pickup, slot: string | null = null): void {
  dialogPickup.value = pickup;
  dialogSlot.value = slot;
  dialogOpen.value = true;
}

function onChanged(): void {
  void load();
}

onMounted(load);
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.schedule.title") }}</h1>
      <v-spacer />
      <v-switch
        v-model="showAddresses"
        :label="t('pickup.schedule.show_addresses')"
        color="primary"
        density="compact"
        hide-details
        inset
        class="flex-grow-0"
        data-testid="board-show-addresses"
      />
      <v-text-field
        v-model="date"
        type="date"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 170px"
        @update:model-value="load"
      />
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ error }}
    </v-alert>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <section class="mb-5">
      <h2 class="pk-section-title">
        {{ t("pickup.schedule.unassigned") }} ({{ unassigned.length }})
      </h2>
      <div v-if="unassigned.length === 0" class="pk-empty">
        {{ t("pickup.schedule.empty_unassigned") }}
      </div>
      <div v-else class="pk-chip-row">
        <PickupBoardChip
          v-for="p in unassigned"
          :key="p.id"
          :pickup="p"
          :show-address="showAddresses"
          :suffix="unassignedSuffix(p)"
          color="warning"
          :class="{ 'pk-unassigned-card': showAddresses }"
          @click="openAssign(p)"
        />
      </div>
    </section>

    <div v-if="drivers.length === 0 && !loading" class="pk-empty">
      {{ t("pickup.schedule.no_drivers") }}
    </div>

    <div v-else class="pk-board-scroll">
      <table class="pk-board" :class="{ 'pk-board--addresses': showAddresses }">
        <thead>
          <tr>
            <th class="pk-board-slot-col"></th>
            <th v-for="d in drivers" :key="d.id">{{ d.nome }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in slots" :key="slot">
            <th class="pk-board-slot-col">{{ slot }}</th>
            <td v-for="d in drivers" :key="d.id">
              <PickupBoardChip
                v-for="p in pickupsInCell(d.id, slot)"
                :key="p.id"
                :pickup="p"
                :show-address="showAddresses"
                @click="openAssign(p, slot)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ScheduleAssignDialog
      v-model="dialogOpen"
      :pickup="dialogPickup"
      :drivers="drivers"
      :default-slot="dialogSlot"
      @changed="onChanged"
    />
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
}
.pk-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 16px;
  flex-wrap: wrap;
}
.pk-page-title {
  font-size: 1.5rem;
  font-weight: 600;
}
.pk-section-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 8px;
}
.pk-empty {
  padding: 24px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 8px;
}
.pk-chip-row {
  display: flex;
  flex-wrap: wrap;
}
.pk-board-scroll {
  overflow-x: auto;
}
.pk-board {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.8rem;
}
.pk-board th,
.pk-board td {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  padding: 4px 6px;
  min-width: 90px;
  vertical-align: top;
}
.pk-board--addresses td {
  min-width: 180px;
  max-width: 240px;
}
.pk-unassigned-card {
  width: 220px !important;
}
.pk-board-slot-col {
  min-width: 56px;
  white-space: nowrap;
  background: rgba(var(--v-theme-on-surface), 0.04);
  position: sticky;
  left: 0;
}
</style>
