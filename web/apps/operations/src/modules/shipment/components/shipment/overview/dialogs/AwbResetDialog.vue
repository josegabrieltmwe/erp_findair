<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.awb.reset_dialog_title')"
    icon="mdi-backup-restore"
    icon-color="error"
    size="confirm"
    @close="emit('update:modelValue', false)"
  >
    <p class="mb-2">
      <strong
        ><code>{{ awb }}</code></strong
      >
      —
      {{ t("shipment.awb.reset_dialog_body") }}
    </p>
    <p class="text-caption text-medium-emphasis">
      {{ t("shipment.awb.reset_dialog_note") }}
    </p>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="emit('update:modelValue', false)">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn variant="flat" color="error" :loading="resetting" @click="submit">
        {{ t("shipment.awb.reset_confirm") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * Reset/archive the courier AWB for a shipment. Extracted from ServizioCard;
 * behaviour is unchanged — the parent clears the AWB locally (`store.mergeLocal`)
 * on `reset-done` instead of a full reload.
 */
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import { useToastStore } from "@shipment/stores/toast.store";
import { awbService } from "@shipment/services/awb.service";

const props = defineProps<{
  modelValue: boolean;
  awb: string;
  shipmentId: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "reset-done": [];
}>();

const { t } = useI18n();
const toasts = useToastStore();
const resetting = ref(false);

async function submit(): Promise<void> {
  if (!props.shipmentId) return;
  resetting.value = true;
  try {
    const r = await awbService.reset(props.shipmentId);
    if (!r.success) {
      toasts.push(
        "error",
        r.error ?? r.message ?? t("shipment.awb.toast_reset_failed"),
      );
      return;
    }
    toasts.push(
      "success",
      t("shipment.awb.toast_awb_archived", { awb: r.data?.awb_cleared ?? "" }),
    );
    emit("update:modelValue", false);
    emit("reset-done");
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    resetting.value = false;
  }
}
</script>
