<template>
  <div>
    <CmSectionHeader :title="t('anagrafiche.tabs.banche')" :subtitle="t('anagrafiche.banche_select_hint')">
      <template #actions>
        <ViewModeToggle v-model="viewMode" />
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
      <template #cell.nome="{ item }">
        <span class="font-weight-medium">{{ (item as BancaRow).nome || '—' }}</span>
      </template>
      <template #cell.iban="{ item }">
        <span v-if="(item as Record<string, unknown>).iban">{{ (item as Record<string, unknown>).iban }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.swift="{ item }">
        <span v-if="(item as Record<string, unknown>).swift">{{ (item as Record<string, unknown>).swift }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.actions="{ item }">
        <v-chip
          v-if="(item as BancaRow).id === defaultBancaId"
          size="x-small"
          color="success"
          variant="flat"
        >
          {{ t('anagrafiche.default_bank') }}
        </v-chip>
        <v-btn
          v-else
          size="x-small"
          variant="text"
          :prepend-icon="mdiStarOutline"
          :loading="settingDefault === (item as BancaRow).id"
          @click="markDefault(item as BancaRow)"
        >
          {{ t('anagrafiche.set_default_bank') }}
        </v-btn>
      </template>
    </ListingDataView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiStarOutline } from '@mdi/js';
import type { BancaRow } from '../services/anagrafica.service';
import { bancheService } from '../services/banche.service';
import { useToast } from '../composables/useToast';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import ListingDataView from '@shared/listing/ListingDataView.vue';
import ViewModeToggle from '@shared/listing/ViewModeToggle.vue';
import { useClientSideListSource } from '@shared/listing/useClientSideListSource';
import { useListViewMode } from '@shared/listing/useListViewMode';

// La sección banca de la ficha del cliente es SOLO SELECCIÓN: las cuentas
// mostradas son las del emisor/partner (id_anagr_titolare) — su alta/edición
// vive en admin_config → "Cuentas bancarias del emisor". Aquí el operador solo
// elige cuál va "indicata in fattura" para este cliente (id_banca_def),
// paridad legacy anagr_banche_boxy.php / BancaRiBa.
const props = defineProps<{ idAnagrafica: number; banche: BancaRow[]; defaultBancaId?: number }>();
const emit = defineEmits<{ refresh: [] }>();
const { t } = useI18n();
const toast = useToast();

const settingDefault = ref<number | null>(null);

async function markDefault(row: BancaRow): Promise<void> {
  settingDefault.value = row.id;
  try {
    await bancheService.setDefault(props.idAnagrafica, row.id);
    toast.success(t('anagrafiche.updated'));
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    settingDefault.value = null;
  }
}

const headers = computed(() => [
  { title: t('anagrafiche.fields.nome'), key: 'nome' },
  { title: t('anagrafiche.fields.iban'), key: 'iban' },
  { title: t('anagrafiche.fields.swift'), key: 'swift', width: 140 },
  { title: t('common.actions'), key: 'actions', sortable: false, width: 180, align: 'end' as const },
]);

const viewMode = useListViewMode('tmwe:anagrafica-banche-view-mode', 'paginated');
const listRows = computed<BancaRow[]>(() => props.banche.map((b) => ({ ...b, id: Number(b.id) })));
const listSource = useClientSideListSource<BancaRow>(() => listRows.value, { mode: () => viewMode.value });
const sortKeyMap: Record<string, string> = { id: 'id', nome: 'nome', iban: 'iban', swift: 'swift' };
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

