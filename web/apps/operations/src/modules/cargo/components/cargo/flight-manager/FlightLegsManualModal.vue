<template>
  <ModalWrapper
    name="flight_legs_manual"
    :title="t('cargo.legsmanual.title')"
    icon="mdi-airplane-edit"
    :max-width="820"
  >
    <v-alert
      type="warning"
      density="compact"
      variant="tonal"
      class="mb-3"
      icon="mdi-alert-outline"
    >
      {{ t("cargo.flight.manual_legs_warning") }}
    </v-alert>

    <div v-for="leg in legs" :key="leg.idx" class="mfl-leg">
      <div class="mfl-leg__title">
        <v-icon icon="mdi-airplane" size="16" class="me-1" />
        {{ t("cargo.legsmanual.leg_n", { n: leg.idx }) }}
        <v-chip v-if="leg.idx > 1" size="x-small" variant="tonal" class="ms-2">
          {{ t("cargo.legsmanual.optional") }}
        </v-chip>
      </div>
      <div class="mfl-leg__grid">
        <!-- Campo "airline" (flight_carr) eliminado: no existe columna
             flight_carr* en spedizioni_cargo → no persistía. El código de
             aerolínea ya va en el nº de vuelo (ej. LH440). -->
        <v-text-field
          v-model="leg.flight_num"
          :label="t('cargo.legsmanual.flight_num')"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-text-field
          v-model="leg.dep_dt"
          :label="t('cargo.legsmanual.departure')"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-text-field
          v-model="leg.origin"
          :label="t('cargo.legsmanual.origin_iata')"
          density="compact"
          variant="outlined"
          hide-details
          maxlength="3"
        />
        <v-text-field
          v-model="leg.arr_dt"
          :label="t('cargo.legsmanual.arrival')"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-text-field
          v-model="leg.dest"
          :label="t('cargo.legsmanual.dest_iata')"
          density="compact"
          variant="outlined"
          hide-details
          maxlength="3"
        />
      </div>
    </div>

    <template #actions>
      <v-btn
        variant="text"
        color="error"
        size="small"
        prepend-icon="mdi-airplane-remove"
        :disabled="!reset.hasAnything.value || saving"
        @click="reset.open()"
      >
        {{ t("cargo.resetflights.button") }}
      </v-btn>
      <v-spacer />
      <v-btn variant="text" size="small" @click="ui.closeModal()">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn
        variant="flat"
        color="primary"
        rounded="lg"
        :loading="saving"
        @click="save"
      >
        {{ t("cargo.legsmanual.save") }}
      </v-btn>
    </template>

    <ResetFlightsDialog
      v-model="reset.dialogOpen.value"
      :busy="reset.busy.value"
      :has-active-booking="reset.hasActiveBooking.value"
      :has-rate="reset.hasRate.value"
      :has-manual-legs="reset.hasManualLegs.value"
      :booking-ref="flightMgr.bookingAwb || flightMgr.bookingId"
      @confirm="onReset"
    />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, reactive, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import type { Cargo } from "@cargo/services/cargo.types";
import ModalWrapper from "../modals/ModalWrapper.vue";
import ResetFlightsDialog from "./ResetFlightsDialog.vue";
import { useFlightReset } from "@cargo/composables/useFlightReset";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";

interface LegInput {
  idx: 1 | 2 | 3 | 4 | 5;
  flight_num: string;
  dep_dt: string;
  arr_dt: string;
  origin: string;
  dest: string;
}

const { t } = useI18n();
const ui = useUiStore();
const cargo = useCargoStore();
const { cargo: cargoRow, id: cargoId } = storeToRefs(cargo);
const toasts = useToastStore();

const reset = useFlightReset();
const flightMgr = useCargoFlightManagerStore();

/** After a reset clears the cargo columns, re-hydrate the modal's leg fields. */
async function onReset(opts: { clearManualLegs: boolean }): Promise<void> {
  const ok = await reset.confirm({ clearManualLegs: opts.clearManualLegs });
  if (ok) hydrate();
}

const saving = ref(false);
const legs = reactive<LegInput[]>(
  [1, 2, 3, 4, 5].map((i) => ({
    idx: i as LegInput["idx"],
    flight_num: "",
    dep_dt: "",
    arr_dt: "",
    origin: "",
    dest: "",
  })),
);

function hydrate(): void {
  const c = cargoRow.value as unknown as Record<string, unknown> | null;
  if (!c) return;
  legs.forEach((leg) => {
    leg.flight_num = String(c[`flight_num${leg.idx}`] ?? "");
    const dep = String(c[`flight_data${leg.idx}`] ?? "");
    leg.dep_dt = dep.startsWith("0000-") ? "" : dep;
    const arr = String(c[`flight_datad${leg.idx}`] ?? "");
    leg.arr_dt = arr.startsWith("0000-") ? "" : arr;
    leg.origin = String(c[`flight_airp${leg.idx}`] ?? "");
    leg.dest = String(c[`flight_aird${leg.idx}`] ?? "");
  });
}

// Hydrate every time the modal opens — preserves any local edits the
// operator typed mid-session via the store reload.
watch(
  () => ui.activeModal,
  (n) => {
    if (n === "flight_legs_manual") hydrate();
  },
);

function validateOrder(): string | null {
  // If leg N has any data, legs 1..N-1 must be complete.
  for (let i = legs.length - 1; i > 0; i--) {
    const filled = legs[i].flight_num || legs[i].dep_dt || legs[i].origin;
    if (!filled) continue;
    for (let j = 0; j < i; j++) {
      const prevFull =
        legs[j].flight_num && legs[j].dep_dt && legs[j].origin && legs[j].dest;
      if (!prevFull) return `Leg ${j + 1} must be complete before leg ${i + 1}`;
    }
  }
  return null;
}

async function save(): Promise<void> {
  if (!cargoId.value) return;
  const err = validateOrder();
  if (err) {
    toasts.push("error", err);
    return;
  }

  const patch: Record<string, unknown> = {};
  for (const leg of legs) {
    patch[`flight_num${leg.idx}`] = leg.flight_num;
    patch[`flight_data${leg.idx}`] = leg.dep_dt;
    patch[`flight_datad${leg.idx}`] = leg.arr_dt;
    patch[`flight_airp${leg.idx}`] = leg.origin.toUpperCase();
    patch[`flight_aird${leg.idx}`] = leg.dest.toUpperCase();
  }

  saving.value = true;
  try {
    const ok = await cargo.update(patch as Partial<Cargo>);
    if (ok) {
      toasts.push("success", t("cargo.legsmanual.saved"));
      ui.closeModal();
    }
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.mfl-leg {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
}
.mfl-leg__title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
  margin-bottom: 8px;
}
.mfl-leg__grid {
  display: grid;
  grid-template-columns: 1fr 1fr 100px 1fr 100px;
  gap: 8px;
}
@media (max-width: 800px) {
  .mfl-leg__grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
