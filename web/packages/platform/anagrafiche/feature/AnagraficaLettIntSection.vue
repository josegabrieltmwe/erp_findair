<template>
  <div>
    <CmSectionHeader :title="t('anagrafiche.tabs.lettint')">
      <template #actions>
        <ViewModeToggle v-model="viewMode" />
        <v-btn color="primary" :prepend-icon="mdiPlus" size="small" @click="openCreate">
          {{ t('common.add') }}
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
      <template #cell.id="{ item }">{{ (item as LettIntRow).id }}</template>
      <template #cell.dichiaraz_intenti_numero="{ item }">
        <span class="font-weight-medium">{{ (item as LettIntRow).dichiaraz_intenti_numero || '—' }}</span>
      </template>
      <template #cell.dichiaraz_intenti_data="{ item }">
        <span v-if="(item as Record<string, unknown>).dichiaraz_intenti_data">{{ (item as Record<string, unknown>).dichiaraz_intenti_data }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.dichiaraz_intenti_data_scad="{ item }">
        <span v-if="(item as Record<string, unknown>).dichiaraz_intenti_data_scad">{{ (item as Record<string, unknown>).dichiaraz_intenti_data_scad }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.aliquota_IVA="{ item }">
        <span v-if="(item as Record<string, unknown>).aliquota_IVA != null">{{ (item as Record<string, unknown>).aliquota_IVA }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.id_causale_IVA="{ item }">
        <span v-if="(item as Record<string, unknown>).id_causale_IVA">{{ (item as Record<string, unknown>).id_causale_IVA }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.actions="{ item }">
        <CmRowActions :actions="rowActions(item as LettIntRow)" />
      </template>
    </ListingDataView>
    </div>
    <LettIntFormDialog v-model="dialogOpen" :id-anagrafica="idAnagrafica" :lett-int="editing" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete } from '@mdi/js';
import type { LettIntRow } from '../services/anagrafica.service';
import { vatDeclarationsService } from '../services/vatDeclarations.service';
import { useToast } from '../composables/useToast';
import { useConfirm } from '../composables/useConfirm';
import LettIntFormDialog from './LettIntFormDialog.vue';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../components/CmRowActions.vue';
import ListingDataView from '@shared/listing/ListingDataView.vue';
import ViewModeToggle from '@shared/listing/ViewModeToggle.vue';
import { useClientSideListSource } from '@shared/listing/useClientSideListSource';
import { useListViewMode } from '@shared/listing/useListViewMode';

const props = defineProps<{ idAnagrafica: number; items: LettIntRow[] }>();
const emit = defineEmits<{ refresh: [] }>();
const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const dialogOpen = ref(false);
const editing = ref<LettIntRow | null>(null);

const headers = computed(() => [
  { title: t('anagrafiche.col_id'), key: 'id', width: 80 },
  { title: t('anagrafiche.fields.numero'), key: 'dichiaraz_intenti_numero' },
  { title: t('anagrafiche.fields.data_inizio'), key: 'dichiaraz_intenti_data', width: 130 },
  { title: t('anagrafiche.fields.data_fine'), key: 'dichiaraz_intenti_data_scad', width: 130 },
  { title: t('anagrafiche.lettint.aliquota_IVA'), key: 'aliquota_IVA', width: 110 },
  { title: t('anagrafiche.lettint.id_causale_IVA'), key: 'id_causale_IVA', width: 120 },
  { title: t('common.actions'), key: 'actions', sortable: false, width: 100, align: 'end' as const },
]);

const viewMode = useListViewMode('tmwe:anagrafica-lettint-view-mode', 'paginated');
const listRows = computed<LettIntRow[]>(() => props.items.map((r) => ({ ...r, id: Number(r.id) })));
const listSource = useClientSideListSource<LettIntRow>(() => listRows.value, { mode: () => viewMode.value });
const sortKeyMap: Record<string, string> = {
  id: 'id', dichiaraz_intenti_numero: 'dichiaraz_intenti_numero',
  dichiaraz_intenti_data: 'dichiaraz_intenti_data', dichiaraz_intenti_data_scad: 'dichiaraz_intenti_data_scad',
  aliquota_IVA: 'aliquota_IVA', id_causale_IVA: 'id_causale_IVA',
};

function openCreate(): void { editing.value = null; dialogOpen.value = true; }
function openEdit(row: LettIntRow): void { editing.value = row; dialogOpen.value = true; }

/** Acciones de fila: editar (visible) + eliminar en kebab. */
function rowActions(row: LettIntRow): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => confirmDelete(row) },
  ];
}

async function confirmDelete(row: LettIntRow): Promise<void> {
  const ok = await confirm.ask({
    title: t('common.delete') as string,
    message: row.dichiaraz_intenti_numero || `#${row.id}`,
    variant: 'danger',
    confirmLabel: t('common.delete') as string,
  });
  if (!ok) return;
  try {
    await vatDeclarationsService.remove(row.id);
    toast.success(t('anagrafiche.deleted'));
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

function onSaved(): void { emit('refresh'); }
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

