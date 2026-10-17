<template>
  <div>
    <CmSectionHeader :title="t('anagrafiche.tabs.sedi')">
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
      <template #cell.id="{ item }">{{ (item as SedeRow).id }}</template>
      <template #cell.label="{ item }">
        <span class="font-weight-medium">{{ (item as SedeRow).label || '—' }}</span>
      </template>
      <template #cell.indirizzo="{ item }">
        <span v-if="(item as SedeRow).indirizzo">{{ (item as SedeRow).indirizzo }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.citta="{ item }">
        <span v-if="(item as Record<string, unknown>).citta">{{ (item as Record<string, unknown>).citta }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.cap="{ item }">
        <span v-if="(item as Record<string, unknown>).cap">{{ (item as Record<string, unknown>).cap }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.id_paese_iso="{ item }">
        <span v-if="(item as Record<string, unknown>).id_paese_iso">{{ (item as Record<string, unknown>).id_paese_iso }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.actions="{ item }">
        <v-chip
          v-if="(item as SedeRow).id === defaultSedeId"
          size="x-small"
          color="success"
          variant="flat"
          class="mr-1"
        >
          {{ t('anagrafiche.default_billing') }}
        </v-chip>
        <CmRowActions :actions="rowActions(item as SedeRow)" />
      </template>
    </ListingDataView>
    </div>

    <SedeFormDialog
      v-model="dialogOpen"
      :id-anagrafica="idAnagrafica"
      :sede="editing"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiStarOutline } from '@mdi/js';
import type { SedeRow } from '../services/anagrafica.service';
import { sediInterneService } from '../services/sediInterne.service';
import { useToast } from '../composables/useToast';
import { useConfirm } from '../composables/useConfirm';
import SedeFormDialog from './SedeFormDialog.vue';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../components/CmRowActions.vue';
import ListingDataView from '@shared/listing/ListingDataView.vue';
import ViewModeToggle from '@shared/listing/ViewModeToggle.vue';
import { useClientSideListSource } from '@shared/listing/useClientSideListSource';
import { useListViewMode } from '@shared/listing/useListViewMode';

const props = defineProps<{ idAnagrafica: number; sedi: SedeRow[]; defaultSedeId?: number }>();
const emit = defineEmits<{ refresh: [] }>();
const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const dialogOpen = ref(false);
const editing = ref<SedeRow | null>(null);
const settingDefault = ref<number | null>(null);

async function markDefault(row: SedeRow): Promise<void> {
  settingDefault.value = row.id;
  try {
    await sediInterneService.setDefault(props.idAnagrafica, row.id);
    toast.success(t('anagrafiche.updated'));
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    settingDefault.value = null;
  }
}

const headers = computed(() => [
  { title: t('anagrafiche.col_id'), key: 'id', width: 80 },
  { title: t('anagrafiche.fields.rag_soc'), key: 'label' },
  { title: t('common.address'), key: 'indirizzo' },
  { title: t('anagrafiche.col_citta'), key: 'citta' },
  { title: t('anagrafiche.fields.cap'), key: 'cap', width: 90 },
  { title: t('anagrafiche.col_paese'), key: 'id_paese_iso', width: 90 },
  { title: t('common.actions'), key: 'actions', sortable: false, width: 100, align: 'end' as const },
]);

// Filas con id:number (contrato ListingDataView) + adaptador client-side.
const viewMode = useListViewMode('tmwe:anagrafica-sedi-view-mode', 'paginated');
const listRows = computed<SedeRow[]>(() => props.sedi.map((s) => ({ ...s, id: Number(s.id) })));
const listSource = useClientSideListSource<SedeRow>(() => listRows.value, { mode: () => viewMode.value });
const sortKeyMap: Record<string, string> = {
  id: 'id', label: 'label', indirizzo: 'indirizzo', citta: 'citta', cap: 'cap', id_paese_iso: 'id_paese_iso',
};

function openCreate(): void {
  editing.value = null;
  dialogOpen.value = true;
}
/** Acciones de fila (>2 → menú dropdown con icono + texto). */
function rowActions(row: SedeRow): RowAction[] {
  return [
    {
      key: 'default',
      title: t('anagrafiche.set_default_billing'),
      icon: mdiStarOutline,
      hidden: row.id === props.defaultSedeId,
      loading: settingDefault.value === row.id,
      onClick: () => markDefault(row),
    },
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => confirmDelete(row) },
  ];
}

function openEdit(row: SedeRow): void {
  editing.value = row;
  dialogOpen.value = true;
}

async function confirmDelete(row: SedeRow): Promise<void> {
  const ok = await confirm.ask({
    title: t('common.delete') as string,
    message: `${row.label || row.indirizzo || `#${row.id}`}?`,
    variant: 'danger',
    confirmLabel: t('common.delete') as string,
  });
  if (!ok) return;
  try {
    await sediInterneService.remove(row.id);
    toast.success(t('anagrafiche.deleted'));
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

function onSaved(): void {
  emit('refresh');
}
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

