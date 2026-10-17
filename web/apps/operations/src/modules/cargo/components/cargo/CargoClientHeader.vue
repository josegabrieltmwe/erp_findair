<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-account-tie" size="18" class="me-2" />
      {{ t("cargo.overview.client") }}
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="selectedClient"
            :items="items"
            :loading="searching"
            :readonly="readonly('id_cliente')"
            :label="t('cargo.overview.client')"
            :placeholder="t('cargo.clienthdr.search_ph')"
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
            :label="t('cargo.clienthdr.sede')"
            :model-value="sedeLabel"
            disabled
            hide-details
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="rifClient"
            :label="t('cargo.clienthdr.client_rif')"
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
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import {
  anagraficaService,
  type AnagraficaLite,
} from "@cargo/services/anagrafica.service";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const { readonly } = useCargoState(cargo);

const items = ref<AnagraficaLite[]>([]);
const searching = ref(false);
const selectedClient = ref<AnagraficaLite | null>(null);

const sedeLabel = computed(() => {
  const s = cargo.value;
  if (!s) return "";
  return `#${s.id_sede ?? "—"}`;
});

const rifClient = ref<string>("");

watch(
  [cargo, () => store.clientName],
  ([s]) => {
    if (!s) return;
    rifClient.value = (s.rif_cliente ?? s.RIF_cliente ?? "") as string;
    if (s.id_cliente) {
      const label = (s.cliente ||
        store.clientName ||
        t("cargo.clienthdr.client_num", { id: s.id_cliente })) as string;
      const current: AnagraficaLite = {
        id: Number(s.id_cliente),
        rag_soc: label,
        pi_cf: s.ang_client_vat as string | undefined,
      };
      // Replace if same id (label may have refreshed).
      const idx = items.value.findIndex(
        (it) => Number(it.id) === Number(current.id),
      );
      if (idx === -1) {
        items.value = [current, ...items.value];
      } else {
        items.value.splice(idx, 1, current);
      }
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
      items.value = await anagraficaService.search(text, 20);
    } finally {
      searching.value = false;
    }
  }, 250);
}

async function onClientChange(client: AnagraficaLite | null): Promise<void> {
  if (!client || !client.id) return;
  if (Number(client.id) === Number(cargo.value?.id_cliente)) return;
  await store.update({ id_cliente: String(client.id) });
}

async function commitRif(): Promise<void> {
  const current = (cargo.value?.rif_cliente ??
    cargo.value?.RIF_cliente ??
    "") as string;
  if (rifClient.value === current) return;
  await store.update({ RIF_cliente: rifClient.value });
}
</script>
