<template>
  <ModalWrapper
    name="cancel_cargo"
    :title="t('cargo.modal.cancel_cargo')"
    icon="mdi-cancel"
    :max-width="560"
  >
    <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
      {{ t("cargo.cancelmodal.warning", { id: cargoId }) }}
    </v-alert>

    <v-alert
      v-if="guard.invoiced"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ t("cargo.cancelmodal.invoiced") }}
    </v-alert>
    <v-alert
      v-if="guard.hasActiveBooking"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ t("cargo.cancelmodal.active_booking") }}
    </v-alert>
    <v-alert
      v-if="guard.hasAwb || serverOutcome === 'needs_force'"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ t("cargo.cancelmodal.has_awb") }}
    </v-alert>

    <!-- P43: motivo del 409 tal como lo da el servidor (facturado, reserva viva o AWB emitido). -->
    <v-alert
      v-if="serverBlock"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      <div>{{ serverBlock.message }}</div>
      <div v-if="serverBlock.detail" class="text-caption mt-1">
        {{ serverBlock.detail }}
      </div>
    </v-alert>

    <!-- Forzar: solo personal de TMWE y solo cuando el único motivo es el AWB emitido. -->
    <v-checkbox
      v-if="needsForce"
      v-model="forceAck"
      color="error"
      density="compact"
      hide-details
      class="mb-3"
      :disabled="loading"
      :label="t('cargo.cancelmodal.force_ack')"
    />

    <v-textarea
      v-model="reason"
      :label="t('cargo.cancelmodal.reason')"
      rows="3"
      auto-grow
      :readonly="loading"
    />

    <template #actions>
      <v-btn variant="text" :disabled="loading" @click="ui.closeModal()">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn
        color="error"
        variant="flat"
        prepend-icon="mdi-delete-forever"
        :loading="loading"
        :disabled="!canSubmit"
        @click="confirm"
      >
        {{ t("cargo.modal.cancel_cargo") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { moduleHref } from "@shared/platform/navTargets";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { cargoActionsService } from "@cargo/services/cargo_actions.service";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";
import {
  cancelBlockDetail,
  cancelBlockFromServer,
  cancelCargoState,
  canSubmitCancel,
  type CancelServerOutcome,
} from "@cargo/utils/cargoGuards";
import { useAccess } from "@shared/composables/useAccess";
import ModalWrapper from "./ModalWrapper.vue";

const { t, te } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const toasts = useToastStore();
const router = useRouter();
const { id, cargo } = storeToRefs(cargoStore);
// Misma instancia Pinia que hidrata la tarjeta de vuelos del detalle.
const flightMgr = useCargoFlightManagerStore();
// «Forzar» solo lo ofrecemos al personal de TMWE (o root); el servidor lo vuelve a comprobar.
const { isRoot, ensureProfile } = useAccess();
const canForce = computed(
  () => Boolean(window.__TMWE_OPERATIONS__?.isTmwe) || isRoot.value,
);

interface ServerBlock {
  code: string;
  message: string;
  detail: string;
}
/** Último 409 del servidor: su motivo y qué implica (bloquea o pide forzar). */
const serverBlock = ref<ServerBlock | null>(null);
const serverOutcome = ref<CancelServerOutcome | null>(null);
const forceAck = ref(false);

const guard = computed(() =>
  cancelCargoState(cargo.value, flightMgr.hasActiveBooking, canForce.value),
);
const needsForce = computed(
  () =>
    !guard.value.blocked &&
    serverOutcome.value !== "blocked" &&
    (guard.value.needsForce ||
      (serverOutcome.value === "needs_force" && canForce.value)),
);
const blocked = computed(
  () => guard.value.blocked || serverOutcome.value === "blocked",
);
const canSubmit = computed(() =>
  canSubmitCancel({
    hasCargoId: !!cargoId.value,
    blocked: blocked.value,
    needsForce: needsForce.value,
    forceAck: forceAck.value,
    loading: loading.value,
  }),
);

const cargoId = computed<number | null>(() => {
  if (!id.value) return null;
  const n = Number(id.value);
  return Number.isFinite(n) ? n : null;
});

const reason = ref("");
const loading = ref(false);

// Reset reason whenever the modal reopens.
watch(
  () => ui.activeModal,
  (n) => {
    if (n === "cancel_cargo") {
      reason.value = "";
      serverBlock.value = null;
      serverOutcome.value = null;
      forceAck.value = false;
      void ensureProfile();
    }
  },
);

async function confirm(): Promise<void> {
  if (!canSubmit.value || !cargoId.value) return;
  loading.value = true;
  serverBlock.value = null;
  try {
    const r = await cargoActionsService.cancel(
      cargoId.value,
      reason.value.trim(),
      needsForce.value && forceAck.value,
    );
    if (r.success) {
      toasts.push("success", r.message ?? t("cargo.cancelmodal.done"));
      ui.closeModal();
      // Navigate to the list — the detail page would now 404.
      router.push({ name: "cargo-list" }).catch(() => {
        // Hard fallback if router push is rejected mid-navigation.
        window.location.href = moduleHref("cargo");
      });
    } else if (r.status === 409 && r.code) {
      // Cargo_Cancel_Guard: se muestra el motivo en el propio diálogo (no se cierra).
      serverOutcome.value = cancelBlockFromServer(r.code, canForce.value);
      forceAck.value = false;
      const detail = cancelBlockDetail(r.code, r.details ?? {});
      serverBlock.value = {
        code: r.code,
        message: te(`errors.api.${r.code}`)
          ? t(`errors.api.${r.code}`)
          : (r.error ?? t("cargo.cancelmodal.failed")),
        detail: detail ? t(detail.key, detail.params) : "",
      };
    } else {
      toasts.push("error", r.error ?? t("cargo.cancelmodal.failed"));
    }
  } finally {
    loading.value = false;
  }
}
</script>
