<template>
  <v-card border rounded="lg">
    <v-card-title class="d-flex align-center"
      ><v-icon icon="mdi-account-tie" class="me-2" />
      {{ t("shipment.client_header.title") }}</v-card-title
    >
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="selectedClient"
            :items="items"
            :loading="searching"
            :readonly="isReadonly"
            :label="t('shipment.client_header.client')"
            :placeholder="t('shipment.client_header.search_placeholder')"
            item-title="rag_soc"
            item-value="id"
            :no-filter="true"
            hide-no-data
            return-object
            @update:search="onSearch"
            @update:model-value="onClientChange"
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props">
                <template #subtitle>
                  <span
                    >{{ item.raw.pi_cf }} — {{ item.raw.citta }}
                    {{ item.raw.prov }}</span
                  >
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            :label="t('shipment.client_header.sede')"
            :model-value="sedeLabel"
            disabled
            hide-details
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="rifClient"
            :label="t('shipment.client_header.client_rif')"
            :readonly="readonly('RIF_cliente')"
            hide-details
            @blur="commitRif"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import {
  anagraficaService,
  type AnagraficaLite,
} from "@shipment/services/anagrafica.service";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

const isReadonly = computed(() => readonly("id_cliente"));

const items = ref<AnagraficaLite[]>([]);
const searching = ref(false);
const selectedClient = ref<AnagraficaLite | null>(null);

const sedeLabel = computed(() => {
  const s = shipment.value;
  if (!s) return "";
  return `${s.sed_label ?? s.sed_rag_soc ?? ""} (#${s.id_sede ?? ""})`;
});

const rifClient = ref<string>("");

watch(
  shipment,
  (s) => {
    if (!s) return;
    rifClient.value = (s.rif_cliente ?? s.RIF_cliente ?? "") as string;
    // Seed the autocomplete with the current client so the label shows.
    if (s.id_cliente) {
      const current: AnagraficaLite = {
        id: Number(s.id_cliente),
        rag_soc: (s.cliente ?? "") as string,
        pi_cf: s.ang_client_vat as string | undefined,
      };
      // Ensure the current selection is present in the items list.
      const idx = items.value.findIndex(
        (it) => Number(it.id) === Number(current.id),
      );
      if (idx === -1) items.value = [current, ...items.value];
      selectedClient.value = current;
    }
  },
  { immediate: true },
);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearch(text: string | undefined): void {
  if (searchTimer) clearTimeout(searchTimer);
  if (!text || text.trim().length < 2) return;
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      const list = await anagraficaService.search(text, 20);
      items.value = list;
    } finally {
      searching.value = false;
    }
  }, 250);
}

async function onClientChange(client: AnagraficaLite | null): Promise<void> {
  if (!client || !client.id) return;
  if (Number(client.id) === Number(shipment.value?.id_cliente)) return;
  await store.update({ id_cliente: String(client.id) });
}

async function commitRif(): Promise<void> {
  const current = (shipment.value?.rif_cliente ??
    shipment.value?.RIF_cliente ??
    "") as string;
  if (rifClient.value === current) return;
  await store.update({ RIF_cliente: rifClient.value });
}
</script>
