<template>
  <ModalWrapper
    name="booking_cancel"
    :title="t('cargo.modal.booking_cancel')"
    icon="mdi-cancel"
    :max-width="540"
  >
    <p class="text-body-2 mb-3">
      {{ t("cargo.bookingcancel.intro_pre") }}
      <span class="metric-mono">{{ store.bookingId }}</span
      >.
      {{ t("cargo.bookingcancel.intro_mid") }}
      <strong>{{ t("cargo.bookingcancel.intro_strong") }}</strong>
      {{ t("cargo.bookingcancel.intro_post") }}
    </p>

    <!--
      Aviso, NO bloqueo: la cancelación tardía se cursa igual y es el carrier
      quien decide si la acepta. Se muestra para que el operador vea el riesgo
      de penalización antes de confirmar.
    -->
    <v-alert
      v-if="lateWarning"
      :type="lateWarning.pastDeadline ? 'error' : 'warning'"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{
        lateWarning.pastDeadline
          ? t("cargo.bookingcancel.past_deadline")
          : t("cargo.bookingcancel.late_warning", {
              hours: lateWarning.hours,
            })
      }}
    </v-alert>

    <!--
      Reserva `pending`: su resultado no se conoce (timeout del carrier) o aún
      está en curso. Anularla solo en el ERP dejaría viva la de la aerolínea, así
      que se pide comprobarlo antes; la API lo exige (NEEDS_RECONCILIATION).
    -->
    <template v-if="isPending">
      <v-alert
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-2"
        data-testid="cancel-pending-warning"
      >
        {{ t("cargo.bookingcancel.pending_warning") }}
      </v-alert>
      <v-checkbox
        v-model="confirmNotBooked"
        :label="t('cargo.bookingcancel.pending_confirm')"
        density="compact"
        hide-details
        class="mb-2"
        data-testid="cancel-pending-confirm"
      />
    </template>

    <v-textarea
      v-model="reason"
      :label="t('cargo.bookingcancel.reason')"
      auto-grow
      rows="2"
      density="compact"
      :readonly="store.cancellingBooking"
    />

    <!--
      Timeout del carrier: NO es un fallo. La reserva sigue en pantalla a
      propósito —darla por cancelada sería mentir si el carrier no llegó a
      cancelarla— y se pide verificar en vez de invitar a reintentar.
    -->
    <v-alert
      v-if="store.cancelIndeterminate"
      type="warning"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      {{ t("cargo.bookingcancel.indeterminate") }}
    </v-alert>

    <v-alert
      v-else-if="store.error"
      type="error"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      {{ errorText }}
    </v-alert>

    <template #actions>
      <v-btn
        variant="text"
        :disabled="store.cancellingBooking"
        @click="ui.closeModal()"
      >
        {{ t("common.back") }}
      </v-btn>
      <v-spacer />
      <v-btn
        color="error"
        variant="flat"
        prepend-icon="mdi-cancel"
        :loading="store.cancellingBooking"
        :disabled="isPending && !confirmNotBooked"
        @click="confirm"
      >
        {{ t("cargo.bookingcancel.confirm") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";
import { useToastStore } from "@cargo/stores/toast.store";
import ModalWrapper from "./ModalWrapper.vue";

const { t, te } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const store = useCargoFlightManagerStore();
const toasts = useToastStore();

const reason = ref("");

/** Error traducido por su código (NEEDS_RECONCILIATION, CANCEL_FAILED…); si no hay clave, el texto de la API. */
const errorText = computed<string>(() => {
  const code = (store.errorCode ?? "").trim();
  const key = `cargo.flightmgr.booking_error.${code}`;
  return code && te(key) ? t(key) : (store.error ?? "");
});
const confirmNotBooked = ref(false);

/** Reserva con resultado desconocido o aún en curso. */
const isPending = computed(
  () => String(store.booking?.status ?? "").toLowerCase() === "pending",
);

/** Umbral de aviso, en horas. Coincide con CANCELLATION_WARNING_HOURS del backend. */
const WARNING_HOURS = 24;

/**
 * ¿Queda poco para la aceptación máxima (LAT)?
 *
 * Se mide contra `latest_acceptance_at` —el instante que el carrier considera
 * vinculante— y no contra la salida del vuelo. Sólo WebCargo lo devuelve; con
 * una reserva KLM, o con una `pending` que aún no lo tiene, no se avisa nada y
 * el modal se comporta como antes.
 */
const lateWarning = computed<{ hours: string; pastDeadline: boolean } | null>(
  () => {
    const lat = store.booking?.latest_acceptance_at;
    if (!lat) return null;

    const ts = Date.parse(lat);
    if (Number.isNaN(ts)) return null;

    const hours = (ts - Date.now()) / 3_600_000;
    if (hours >= WARNING_HOURS) return null;

    return {
      hours: Math.max(0, hours).toFixed(1),
      pastDeadline: hours < 0,
    };
  },
);

watch(
  () => ui.activeModal,
  (n) => {
    if (n === "booking_cancel") {
      reason.value = "";
      confirmNotBooked.value = false;
    }
  },
);

async function confirm(): Promise<void> {
  const ok = await store.cancelBooking(reason.value.trim() || undefined, {
    confirmNotBooked: isPending.value && confirmNotBooked.value,
  });
  if (ok) {
    toasts.push("success", t("cargo.bookingcancel.done"));
    ui.closeModal();
    if (cargoStore.id) await cargoStore.load(Number(cargoStore.id));
  } else {
    toasts.push(
      "error",
      errorText.value || t("cargo.flightmgr.booking_error.CANCEL_FAILED"),
    );
  }
}
</script>

<style scoped>
.metric-mono {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
