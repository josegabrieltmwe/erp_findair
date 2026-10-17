<template>
  <AppDialog
    :open="open"
    :title="t('shipment.ldv_dialog.title')"
    size="md"
    persistent
    @close="close"
  >
    <v-progress-circular v-if="loading" indeterminate color="primary" />
    <template v-else>
      <v-alert
        v-for="(e, i) in errors"
        :key="`e${i}`"
        type="error"
        variant="tonal"
        class="mb-2"
        border="start"
      >
        <strong class="text-capitalize">{{ e.category }}:</strong>
        {{ e.message }}
      </v-alert>
      <v-alert
        v-for="(w, i) in warnings"
        :key="`w${i}`"
        type="warning"
        variant="tonal"
        class="mb-2"
        border="start"
      >
        <strong class="text-capitalize">{{ w.category }}:</strong>
        {{ w.message }}
      </v-alert>
      <v-alert
        v-if="canProceed && errors.length === 0 && warnings.length === 0"
        type="success"
        variant="tonal"
      >
        {{ t("shipment.ldv_dialog.all_passed") }}
      </v-alert>
    </template>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
      <v-btn
        :disabled="!canProceed || sending"
        :loading="sending"
        color="primary"
        variant="flat"
        prepend-icon="$email"
        @click="sendLdv"
      >
        {{ t("shipment.ldv_dialog.send_to_sender") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import {
  labelsService,
  type ValidationIssue,
} from "@shipment/services/labels.service";
import { useToastStore } from "@shipment/stores/toast.store";

const { t } = useI18n();
const props = defineProps<{ modelValue: boolean; shipmentId: number | null }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const open = ref(props.modelValue);
watch(
  () => props.modelValue,
  (v) => (open.value = v),
);
watch(open, (v) => emit("update:modelValue", v));

const loading = ref(false);
const errors = ref<ValidationIssue[]>([]);
const warnings = ref<ValidationIssue[]>([]);
const canProceed = ref(false);

watch([open, () => props.shipmentId], async ([isOpen, id]) => {
  if (!isOpen || !id) return;
  loading.value = true;
  try {
    const r = await labelsService.validate(id);
    errors.value = r.errors ?? [];
    warnings.value = r.warnings ?? [];
    canProceed.value = !!r.can_proceed;
  } finally {
    loading.value = false;
  }
});

const toasts = useToastStore();
const sending = ref(false);

async function sendLdv(): Promise<void> {
  if (!props.shipmentId) return;
  sending.value = true;
  try {
    const r = await labelsService.sendLdvToMittente(props.shipmentId);
    if (!r.success) {
      toasts.push("error", r.error ?? t("shipment.ldv_dialog.send_failed"));
      return;
    }
    toasts.push(
      "success",
      r.sent_to
        ? t("shipment.ldv_dialog.sent_to", { to: r.sent_to })
        : t("shipment.ldv_dialog.sent"),
    );
    close();
  } finally {
    sending.value = false;
  }
}

function close(): void {
  open.value = false;
}
</script>
