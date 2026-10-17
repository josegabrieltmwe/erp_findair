<template>
  <v-dialog v-model="open" max-width="900" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        {{ t("shipment.modals.proforma.title") }}
        <v-spacer />
        <v-btn icon="$close" variant="text" @click="close" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t("shipment.proforma_dialog.description") }}</th>
              <th>{{ t("shipment.proforma_dialog.qty") }}</th>
              <th>{{ t("shipment.proforma_dialog.unit") }}</th>
              <th>{{ t("shipment.proforma_dialog.price") }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it, i) in items" :key="i">
              <td>
                <v-text-field
                  v-model="it.descrizione"
                  hide-details
                  density="compact"
                  variant="plain"
                />
              </td>
              <td>
                <v-text-field
                  v-model.number="it.qta"
                  type="number"
                  min="0"
                  hide-details
                  density="compact"
                  variant="plain"
                  style="width: 80px"
                />
              </td>
              <td>
                <v-text-field
                  v-model="it.qta_unit"
                  hide-details
                  density="compact"
                  variant="plain"
                  style="width: 80px"
                />
              </td>
              <td>
                <v-text-field
                  v-model.number="it.valore"
                  type="number"
                  min="0"
                  step="0.01"
                  hide-details
                  density="compact"
                  variant="plain"
                  style="width: 120px"
                />
              </td>
              <td>
                <v-btn
                  icon="$close"
                  variant="text"
                  size="x-small"
                  @click="items.splice(i, 1)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>

        <v-btn
          class="mt-3"
          variant="outlined"
          prepend-icon="$plus"
          @click="addRow"
          >{{ t("shipment.modals.proforma.add_row") }}</v-btn
        >
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          variant="outlined"
          :disabled="!shipmentId"
          :loading="pdfLoading"
          @click="generatePdf"
          >{{ t("shipment.proforma_dialog.generate_pdf") }}</v-btn
        >
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">{{
          t("common.save")
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  proformaService,
  type ProformaItem,
  type ProformaHeader,
} from "@shipment/services/proforma.service";
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

const items = ref<ProformaItem[]>([]);
// Header (paese origine / motivo / valuta / data) is preserved across a save;
// the dialog currently only edits items, so we keep whatever the loaded
// proforma carried instead of dropping it.
const header = ref<ProformaHeader>({});
const saving = ref(false);
const pdfLoading = ref(false);
const toasts = useToastStore();

watch([open, () => props.shipmentId], async ([isOpen, id]) => {
  if (!isOpen || !id) return;
  const r = await proformaService.get(id);
  if (r.success && r.proforma) {
    items.value = r.proforma.items ?? [];
    header.value = {
      iso_paese_origine: r.proforma.iso_paese_origine,
      motivo: r.proforma.motivo,
      id_valuta: r.proforma.id_valuta,
      data: r.proforma.data,
    };
  }
});

function addRow(): void {
  items.value.push({ descrizione: "", qta: 1, qta_unit: "pcs", valore: 0 });
}

async function save(): Promise<void> {
  if (!props.shipmentId) return;
  saving.value = true;
  try {
    const r = await proformaService.save(
      props.shipmentId,
      header.value,
      items.value,
    );
    if (!r.success)
      toasts.push(
        "error",
        r.error ?? t("shipment.modals.proforma.save_failed"),
      );
    else toasts.push("success", t("shipment.modals.proforma.saved"));
  } finally {
    saving.value = false;
  }
}

async function generatePdf(): Promise<void> {
  if (!props.shipmentId) return;
  pdfLoading.value = true;
  try {
    const r = await proformaService.generatePdf(props.shipmentId);
    if (r.success && r.url) window.open(r.url, "_blank");
    else toasts.push("error", t("shipment.modals.proforma.pdf_failed"));
  } finally {
    pdfLoading.value = false;
  }
}

function close(): void {
  open.value = false;
}
</script>
