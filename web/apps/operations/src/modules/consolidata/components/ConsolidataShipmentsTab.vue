<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-2">
      <span class="text-body-2">{{
        t("consolidata.shipments.help", { criterio: view?.criterio ?? "" })
      }}</span>
      <v-btn
        v-if="canEdit"
        color="primary"
        size="small"
        prepend-icon="mdi-plus"
        @click="openAdd"
      >
        {{ t("consolidata.shipments.add") }}
      </v-btn>
    </div>
    <v-table density="compact">
      <thead>
        <tr>
          <th>{{ t("consolidata.shipments.ref") }}</th>
          <th>{{ t("consolidata.shipments.origin") }}</th>
          <th class="text-right">{{ t("consolidata.shipments.weight") }}</th>
          <th class="text-right">
            {{ t("consolidata.shipments.chargeable") }}
          </th>
          <th class="text-right">{{ t("consolidata.shipments.share") }}</th>
          <th>{{ t("consolidata.shipments.goods") }}</th>
          <th>{{ t("consolidata.shipments.spedizioneId") }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in view?.spedizioni ?? []" :key="s.id">
          <td>{{ s.ref }}</td>
          <td>{{ s.orig_paese }} {{ s.orig_cap }} {{ s.orig_citta }}</td>
          <td class="text-right">{{ s.peso.toFixed(2) }}</td>
          <td class="text-right">{{ s.peso_tassabile?.toFixed(2) ?? "—" }}</td>
          <td class="text-right">{{ s.quota_totale.toFixed(2) }}</td>
          <td>{{ s.merce || "—" }}</td>
          <td>{{ s.id_spedizione ?? "—" }}</td>
          <td class="text-right">
            <template v-if="canEdit">
              <v-btn
                icon="mdi-pencil"
                size="x-small"
                variant="text"
                :aria-label="t('consolidata.common.edit')"
                @click="openEdit(s)"
              />
              <v-btn
                icon="mdi-delete-outline"
                size="x-small"
                variant="text"
                :aria-label="t('consolidata.common.remove')"
                @click="remove(s)"
              />
            </template>
          </td>
        </tr>
        <tr v-if="!view?.spedizioni.length">
          <td colspan="8" class="text-center text-medium-emphasis py-4">
            {{ t("consolidata.shipments.empty") }}
          </td>
        </tr>
      </tbody>
    </v-table>

    <ConsolidataShipmentDialog
      v-model="dialog"
      :saving="store.saving"
      :error="store.error"
      :shipment="editing"
      @submit="save"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataShipmentDialog from "./ConsolidataShipmentDialog.vue";
import { useConsolidataStore } from "../stores/consolidata.store";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import type { Shipment, ShipmentForm } from "../types";

defineProps<{ canEdit: boolean }>();
const { t } = useI18n();
const store = useConsolidataStore();
const toast = useToastStore();
const view = computed(() => store.shipments);
const dialog = ref(false);
const editing = ref<Shipment | null>(null);

function openAdd(): void {
  store.clearError();
  editing.value = null;
  dialog.value = true;
}

function openEdit(s: Shipment): void {
  store.clearError();
  editing.value = s;
  dialog.value = true;
}

async function save(form: ShipmentForm): Promise<void> {
  if (await store.saveShipment(form, editing.value?.id ?? null)) {
    dialog.value = false;
    toast.success(t("consolidata.shipments.saved"));
  }
}

async function remove(s: Shipment): Promise<void> {
  if (!window.confirm(t("consolidata.shipments.confirmRemove", { ref: s.ref })))
    return;
  if (await store.removeShipment(s.id))
    toast.success(t("consolidata.shipments.removed"));
}
</script>
