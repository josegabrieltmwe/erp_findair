<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.subcontracting.title')"
    size="md"
    persistent
    @close="close"
  >
    <v-list density="compact">
      <v-list-item v-for="a in assignments" :key="a.id">
        <v-list-item-title>{{
          a.partner_name ?? `#${a.id_partner}`
        }}</v-list-item-title>
        <v-list-item-subtitle>{{ a.status }}</v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="$close"
            size="small"
            variant="text"
            @click="removeAssignment(a.id!)"
          />
        </template>
      </v-list-item>
      <v-list-item v-if="!assignments.length">
        <v-list-item-subtitle>{{
          t("shipment.subcontracting.empty")
        }}</v-list-item-subtitle>
      </v-list-item>
    </v-list>

    <v-divider class="my-3" />
    <v-row dense>
      <v-col cols="9">
        <v-text-field
          v-model.number="newPartnerId"
          :label="t('shipment.subcontracting.partner_id')"
          type="number"
          hide-details
        />
      </v-col>
      <v-col cols="3">
        <v-btn
          :loading="assigning"
          color="primary"
          variant="flat"
          block
          @click="assign"
          >{{ t("shipment.subcontracting.assign") }}</v-btn
        >
      </v-col>
    </v-row>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">{{ t("common.close") }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import {
  subcontractingService,
  type SubcontractingAssignment,
} from "@shipment/services/subcontracting.service";
import { useToastStore } from "@shipment/stores/toast.store";

const { t } = useI18n();
const props = defineProps<{ modelValue: boolean; shipmentId: number | null }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const assignments = ref<SubcontractingAssignment[]>([]);
const newPartnerId = ref<number>(0);
const assigning = ref(false);
const toasts = useToastStore();

async function refresh(): Promise<void> {
  if (!props.shipmentId) return;
  const r = await subcontractingService.list(props.shipmentId);
  if (r.success) assignments.value = r.assignments ?? [];
}

watch(
  [() => props.modelValue, () => props.shipmentId],
  async ([isOpen, id]) => {
    if (!isOpen || !id) return;
    await refresh();
  },
);

async function assign(): Promise<void> {
  if (!props.shipmentId || !newPartnerId.value) return;
  assigning.value = true;
  try {
    const r = await subcontractingService.assign(
      props.shipmentId,
      newPartnerId.value,
    );
    if (!r.success)
      toasts.push(
        "error",
        r.error ?? t("shipment.subcontracting.assign_failed"),
      );
    else {
      toasts.push("success", t("shipment.subcontracting.assigned"));
      newPartnerId.value = 0;
      await refresh();
    }
  } finally {
    assigning.value = false;
  }
}

async function removeAssignment(id: number): Promise<void> {
  const r = await subcontractingService.remove(id);
  if (!r.success)
    toasts.push("error", t("shipment.subcontracting.remove_failed"));
  else await refresh();
}

function close(): void {
  emit("update:modelValue", false);
}
</script>
