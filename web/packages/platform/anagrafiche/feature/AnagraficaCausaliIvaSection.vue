<template>
  <div>
    <CmSectionHeader :title="t('anagrafiche.tabs.causali_iva')" :subtitle="t('anagrafiche.causali_select_hint')">
      <template #actions>
        <ViewModeToggle v-model="viewMode" />
        <v-btn variant="text" size="small" :prepend-icon="mdiRefresh" :loading="loading" @click="reload">
          {{ t('common.refresh') }}
        </v-btn>
      </template>
    </CmSectionHeader>
    <div class="cm-sublist-viewport">
    <ListingDataView
      :source="listSource"
      :headers="headers"
      :selected="[]"
      :mode="viewMode"
      :sort-key-map="sortKeyMap"
      :selectable="false"
      @update:mode="viewMode = $event"
    >
      <template #cell.id="{ item }">{{ (item as ClientCausalRow).id }}</template>
      <template #cell.tipo="{ item }">
        <span v-if="(item as Record<string, unknown>).tipo">{{ (item as Record<string, unknown>).tipo }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.descr="{ item }">
        <span v-if="(item as Record<string, unknown>).descr">{{ (item as Record<string, unknown>).descr }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.aliquota_IVA="{ item }">
        <span v-if="(item as Record<string, unknown>).aliquota_IVA != null">{{ (item as Record<string, unknown>).aliquota_IVA }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.predefinita="{ item }">
        <v-chip
          v-if="(item as ClientCausalRow).predefinita === 'S'"
          size="x-small"
          color="primary"
          variant="flat"
          :prepend-icon="mdiCheck"
        >
          {{ t('anagrafiche.fields.default') }}
        </v-chip>
        <v-btn
          v-else
          size="x-small"
          variant="text"
          :loading="assigning === (item as ClientCausalRow).id"
          @click="assign(item as ClientCausalRow)"
        >
          {{ t('anagrafiche.set_default_causale') }}
        </v-btn>
      </template>
    </ListingDataView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiRefresh, mdiCheck } from '@mdi/js';
import { clientCausalsService, type ClientCausal } from '../services/clientCausals.service';
import { useToast } from '../composables/useToast';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import ListingDataView from '@shared/listing/ListingDataView.vue';
import ViewModeToggle from '@shared/listing/ViewModeToggle.vue';
import { useClientSideListSource } from '@shared/listing/useClientSideListSource';
import { useListViewMode } from '@shared/listing/useListViewMode';

type ClientCausalRow = ClientCausal & { id: number };

const props = defineProps<{ idAnagrafica: number }>();
const { t } = useI18n();
const toast = useToast();

const rows = ref<ClientCausal[]>([]);
const loading = ref(false);
const assigning = ref<number | null>(null);

// Asigna la causale IVA por defecto del cliente (anagrafiche.id_causale_IVA).
// El catálogo es global; aquí solo se elige cuál es la del cliente.
async function assign(row: ClientCausalRow): Promise<void> {
  if (!props.idAnagrafica) return;
  assigning.value = row.id;
  try {
    await clientCausalsService.assign(props.idAnagrafica, row.id);
    toast.success(t('anagrafiche.updated'));
    await reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    assigning.value = null;
  }
}

const headers = computed(() => [
  { title: t('anagrafiche.col_id'), key: 'id', width: 80 },
  { title: t('anagrafiche.fields.tipo'), key: 'tipo', width: 100 },
  { title: t('anagrafiche.fields.descr'), key: 'descr' },
  { title: t('anagrafiche.fields.aliquota_iva'), key: 'aliquota_IVA', width: 130 },
  { title: t('anagrafiche.fields.default'), key: 'predefinita', width: 100, align: 'center' as const },
]);

const viewMode = useListViewMode('tmwe:anagrafica-causali-view-mode', 'paginated');
const listRows = computed<ClientCausalRow[]>(() => rows.value.map((r) => ({ ...r, id: Number(r.id) })));
const listSource = useClientSideListSource<ClientCausalRow>(() => listRows.value, {
  loading: () => loading.value,
  mode: () => viewMode.value,
});
const sortKeyMap: Record<string, string> = {
  id: 'id', tipo: 'tipo', descr: 'descr', aliquota_IVA: 'aliquota_IVA', predefinita: 'predefinita',
};

async function reload(): Promise<void> {
  if (!props.idAnagrafica) return;
  loading.value = true;
  try {
    rows.value = await clientCausalsService.list(props.idAnagrafica);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    loading.value = false;
  }
}

onMounted(reload);
</script>

<style scoped>
.cm-text-muted {
  color: var(--cm-text-muted);
}
.cm-sublist-viewport {
  display: flex;
  flex-direction: column;
  /* Alto FLUIDO, no `calc(100vh - Npx)`.
     La altura magica no contaba el chrome real (topbar + cabecera de ficha +
     tabs, que varian con el idioma y el ancho): reservaba 560px donde habia 617
     disponibles y, peor, RECORTABA la tabla sin dar scroll — con 20 contactos
     quedaban 12 filas inalcanzables (ni el wrapper ni ningun ancestro
     scrolleaban). Heredando del padre flex, ListingDataView (flex:1 1 auto +
     min-height:0) scrollea en su propio wrapper, que es el patron del proyecto. */
  flex: 1 1 auto;
  min-height: 360px;
}
</style>

