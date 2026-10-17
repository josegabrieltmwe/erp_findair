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
        :disabled="!cargoId"
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
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const toasts = useToastStore();
const router = useRouter();
const { id } = storeToRefs(cargoStore);

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
    if (n === "cancel_cargo") reason.value = "";
  },
);

async function confirm(): Promise<void> {
  if (!cargoId.value) return;
  loading.value = true;
  try {
    const r = await cargoActionsService.cancel(
      cargoId.value,
      reason.value.trim(),
    );
    if (r.success) {
      toasts.push("success", r.message ?? t("cargo.cancelmodal.done"));
      ui.closeModal();
      // Navigate to the list — the detail page would now 404.
      router.push({ name: "cargo-list" }).catch(() => {
        // Hard fallback if router push is rejected mid-navigation.
        window.location.href = moduleHref("cargo");
      });
    } else {
      toasts.push("error", r.error ?? t("cargo.cancelmodal.failed"));
    }
  } finally {
    loading.value = false;
  }
}
</script>
