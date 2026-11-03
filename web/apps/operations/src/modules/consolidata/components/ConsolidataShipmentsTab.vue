<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-2">
      <span class="text-body-2">{{
        t("consolidata.shipments.help", { criterio: view?.criterio ?? "" })
      }}</span>
      <v-btn
        v-if="canAdd"
        color="primary"
        size="small"
        prepend-icon="mdi-plus"
        :disabled="atLimit"
        @click="openAdd"
      >
        {{ t("consolidata.shipments.add") }}
      </v-btn>
    </div>
    <v-alert
      v-if="nearLimit"
      :type="atLimit ? 'error' : 'warning'"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      {{ t("consolidata.shipments.limit", { n: count, max: maxShipments }) }}
    </v-alert>
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
          <td class="text-right">{{ num(s.peso) }}</td>
          <td class="text-right">{{ num(s.peso_tassabile) }}</td>
          <td class="text-right">{{ money(s.quota_totale, currency) }}</td>
          <td>{{ s.merce || "—" }}</td>
          <td>
            <router-link
              v-if="s.id_spedizione"
              :to="{
                name: 'shipment-detail',
                params: { id: String(s.id_spedizione) },
              }"
              class="cons-link"
            >
              {{ s.id_spedizione }}
            </router-link>
            <v-chip
              v-if="s.id_spedizione"
              size="x-small"
              variant="tonal"
              class="ml-1"
              :color="linkedToCargo ? 'success' : 'default'"
            >
              {{
                linkedToCargo
                  ? t("consolidata.shipments.linked")
                  : t("consolidata.shipments.notLinked")
              }}
            </v-chip>
            <span v-if="!s.id_spedizione" class="text-medium-emphasis">—</span>
          </td>
          <td class="text-right text-no-wrap">
            <v-btn
              v-if="canUpdate"
              icon="mdi-pencil"
              size="x-small"
              variant="text"
              :aria-label="t('consolidata.common.edit')"
              @click="openEdit(s)"
            />
            <v-btn
              v-if="canRemove"
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              :aria-label="t('consolidata.common.remove')"
              @click="remove(s)"
            />
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
import { useFormat } from "../composables/useFormat";
import { useConsolidataConfirm } from "../composables/useConfirm";
import type { Shipment, ShipmentForm } from "../types";

defineProps<{ canAdd: boolean; canUpdate: boolean; canRemove: boolean }>();
const { t } = useI18n();
const { money, num } = useFormat();
const confirm = useConsolidataConfirm();
const store = useConsolidataStore();
const toast = useToastStore();
const view = computed(() => store.shipments);
const currency = computed(() => store.project?.valuta ?? "EUR");
const linkedToCargo = computed(() => Boolean(store.project?.id_cargo));
const dialog = ref(false);
const editing = ref<Shipment | null>(null);

/** Aviso al acercarse al máximo de houses del API (meta.limits.max_shipments). */
const count = computed(() => view.value?.spedizioni.length ?? 0);
const maxShipments = computed(() => store.meta?.limits?.max_shipments ?? 0);
const nearLimit = computed(
  () =>
    maxShipments.value > 0 &&
    count.value >= Math.floor(maxShipments.value * 0.9),
);
const atLimit = computed(
  () => maxShipments.value > 0 && count.value >= maxShipments.value,
);

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
  if (
    !(await confirm(
      t("consolidata.shipments.confirmRemove", { ref: s.ref }),
      true,
    ))
  )
    return;
  if (await store.removeShipment(s.id))
    toast.success(t("consolidata.shipments.removed"));
}
</script>

<style scoped>
.cons-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.cons-link:hover {
  text-decoration: underline;
}
</style>
