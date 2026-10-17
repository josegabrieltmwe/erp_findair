<template>
  <ModalWrapper
    name="mawb"
    :title="t('cargo.modal.mawb')"
    icon="mdi-receipt-text-outline"
    :max-width="980"
  >
    <!-- Los documentos AWB (6 PDFs + INVIA + SHARE) y la lista de HAWB viven
         ahora en la pestaña "Docs & HAWB" del formulario, para que el modal no
         sea un scroll único de ~1000px. -->
    <CargoMawbForm />

    <template #actions>
      <!-- MAWB confirmation gate (legacy spedyc_html_mawb_confirmation /
           Pdf40Off): green "Confirmed" once done, actionable when allowed. -->
      <v-btn
        v-if="confirmAlreadyDone"
        color="success"
        variant="tonal"
        prepend-icon="mdi-check-circle"
        disabled
      >
        {{ t("cargo.mawbv2.confirmed") }}
      </v-btn>
      <v-btn
        v-else-if="confirmAllowed"
        color="primary"
        variant="flat"
        prepend-icon="mdi-check"
        :loading="confirming"
        @click="confirmMawb"
      >
        {{ t("cargo.mawbv2.confirm") }}
      </v-btn>
      <v-spacer />
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, watch } from "vue";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { cargoMawbService } from "@cargo/services/cargo_mawb.service";
import ModalWrapper from "./ModalWrapper.vue";
// Use the V2 form (same as CargoDetailPage). The legacy CargoMawbForm.vue
// bound the agent fields as `*_x10` against /unified_cargo_shipment, whose
// whitelist drops them — so manual edits to issuing_carrier/agent_iata_code/
// at_place/signature_* were lost. V2 persists them via PATCH /api_cargo_mawb.
import CargoMawbForm from "@cargo/components/cargo/mawb/CargoMawbFormV2.vue";

const { t } = useI18n();
const ui = useUiStore();
const toasts = useToastStore();
const cargoStore = useCargoStore();

const confirmAllowed = ref(false);
const confirmAlreadyDone = ref(false);
const confirming = ref(false);

async function loadGate(): Promise<void> {
  confirmAllowed.value = false;
  confirmAlreadyDone.value = false;
  const cid = Number(cargoStore.id ?? 0);
  if (!cid) return;
  try {
    const g = await cargoMawbService.confirmationGate(cid);
    if (g.success) {
      confirmAllowed.value = g.confirmation_allowed;
      confirmAlreadyDone.value = g.confirmation_already_done;
    }
  } catch {
    /* gate is best-effort; leave both false */
  }
}

async function confirmMawb(): Promise<void> {
  const cid = Number(cargoStore.id ?? 0);
  if (!cid) return;
  confirming.value = true;
  try {
    const r = await cargoMawbService.confirm(cid);
    if (r.success) {
      toasts.push("success", t("cargo.toast.mawb_confirmed"));
      await loadGate();
    } else {
      toasts.push("error", r.error ?? "Confirmation failed");
    }
  } finally {
    confirming.value = false;
  }
}

// Refresh the gate whenever the MAWB modal opens.
watch(
  () => ui.activeModal,
  (m) => {
    if (m === "mawb") void loadGate();
  },
  { immediate: true },
);
</script>
