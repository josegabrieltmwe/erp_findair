<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('fornitori_accnt.partner_tab_hint') }}
    </v-alert>

    <div class="d-flex justify-end mb-3">
      <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
        {{ t('fornitori_accnt.new_account') }}
      </v-btn>
    </div>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiTruckFastOutline"
      :title="t('fornitori_accnt.empty_title')"
    />
    <ListingDataView
      v-else
      :source="listSource"
      :headers="tableHeaders"
      :selected="selected"
      :sort-key-map="sortKeyMap"
      mode="infinite"
      :selectable="false"
      @update:selected="selected = $event"
    >
      <template #cell.fornitore_nome="{ item }">
        {{ courierLabel((item as FornitoreAccnt).id_fornitore) }}
      </template>
      <template #cell.id_account="{ item }">
        <span class="cm-mono">{{ (item as FornitoreAccnt).id_account }}</span>
      </template>
      <template #cell.iso="{ item }">
        <v-chip v-if="(item as FornitoreAccnt).iso" size="small" class="cm-tone-neutral">{{ (item as FornitoreAccnt).iso }}</v-chip>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as FornitoreAccnt)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="openDelete(item as FornitoreAccnt)"
          >
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-dialog v-model="formDialog" max-width="560" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('fornitori_accnt.dialog_create') : t('fornitori_accnt.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <v-select
            v-model="form.id_fornitore"
            :items="courierOptions"
            item-title="label"
            item-value="id"
            :label="t('fornitori_accnt.form_courier')"
            :disabled="formMode === 'edit'"
            class="mb-3"
          />

          <v-text-field
            v-if="showField('id_account')"
            v-model="form.id_account"
            :label="t('fornitori_accnt.form_account')"
            maxlength="100"
            class="mb-3"
          />
          <v-text-field
            v-if="showField('customer')"
            v-model="form.customer"
            :label="t('fornitori_accnt.form_customer')"
            maxlength="100"
            class="mb-3"
          />
          <v-text-field
            v-if="showField('user')"
            v-model="form.user"
            :label="t('fornitori_accnt.form_user')"
            maxlength="100"
            class="mb-3"
          />
          <v-text-field
            v-if="showField('pw')"
            v-model="form.pw"
            :label="t('fornitori_accnt.form_password')"
            :hint="t('fornitori_accnt.form_secret_hint')"
            persistent-hint
            maxlength="100"
            class="mb-3"
          />
          <v-text-field
            v-if="showField('chiave')"
            v-model="form.chiave"
            :label="t('fornitori_accnt.form_key')"
            :hint="t('fornitori_accnt.form_secret_hint')"
            persistent-hint
            maxlength="200"
            class="mb-3"
          />

          <CmCountrySelect
            v-model="form.iso"
            :label="t('fornitori_accnt.form_country')"
            clearable
            class="mb-3"
          />
          <v-select
            v-model="form.sis_metrico"
            :items="metricOptions"
            item-title="label"
            item-value="value"
            :label="t('fornitori_accnt.form_metric_system')"
            clearable
            class="mb-3"
          />
          <v-text-field
            v-model="form.note"
            :label="t('fornitori_accnt.form_note')"
            maxlength="200"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="formDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!formValid" @click="save">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Tab de credenciales de courier (`fornitori_accnt`) dentro de la ficha de
 * anagrafica — paridad legacy forn_accounts.php. A diferencia de los otros
 * tabs de credenciales (KLM/AF, WebCargo Published, WebCargo Realtime), el
 * conjunto de campos visibles depende del courier elegido (id_fornitore) —
 * ver fieldsForCourier() en el servicio.
 *
 * El nombre de cada courier se resuelve contra `anagrafiche` en vivo (no
 * se hardcodea como en el legacy): el array $frnt del legacy tiene
 * etiquetas obsoletas (id=8 aparece como "TNT IT" pero hoy es Fedex
 * Express Italy S.r.l — no existe ninguna anagrafica "TNT Italia").
 */
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiTruckFastOutline } from '@mdi/js';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmCountrySelect from '../../anagrafiche/components/CmCountrySelect.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { anagraficaService } from '../../anagrafiche/services/anagrafica.service';
import {
  fornitoriAccntService,
  fieldsForCourier,
  KNOWN_COURIER_IDS,
  type FornitoreAccnt,
  type FornitoreAccntPayload,
} from '../services/fornitoriAccnt.service';

const props = defineProps<{
  idAnagrafica: number;
}>();
const emit = defineEmits<{ refresh: [] }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<FornitoreAccnt[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('fornitori_accnt.col_courier') as string, key: 'fornitore_nome' },
  { title: t('fornitori_accnt.col_account') as string, key: 'id_account' },
  { title: t('fornitori_accnt.col_country') as string, key: 'iso' },
  { title: t('fornitori_accnt.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = { id_account: 'id_account' };

const courierNames = ref<Record<number, string>>({});
async function loadCourierNames(): Promise<void> {
  const results = await Promise.all(
    KNOWN_COURIER_IDS.map(async (id) => {
      const rec = await anagraficaService.getById(id).catch(() => null);
      return [id, rec?.rag_soc || `#${id}`] as const;
    }),
  );
  const map: Record<number, string> = {};
  for (const [id, name] of results) map[id] = name;
  courierNames.value = map;
}
function courierLabel(id: number): string {
  return courierNames.value[id] || `#${id}`;
}
const courierOptions = computed(() => KNOWN_COURIER_IDS.map((id) => ({ id, label: courierLabel(id) })));

const metricOptions = [
  { value: 'M', label: t('fornitori_accnt.metric_m') as string },
  { value: 'I', label: t('fornitori_accnt.metric_i') as string },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await fornitoriAccntService.list(props.idAnagrafica);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
interface FormState {
  id?: number;
  id_fornitore: number | null;
  id_account: string;
  customer: string;
  user: string;
  pw: string;
  chiave: string;
  iso: string;
  sis_metrico: string;
  note: string;
}

const form = reactive<FormState>({
  id_fornitore: null,
  id_account: '',
  customer: '',
  user: '',
  pw: '',
  chiave: '',
  iso: '',
  sis_metrico: '',
  note: '',
});

const visibleFields = computed(() => new Set(fieldsForCourier(form.id_fornitore)));
function showField(name: string): boolean {
  return visibleFields.value.has(name);
}

const formValid = computed(
  () => !!form.id_fornitore && (!showField('id_account') || form.id_account.trim().length > 0),
);

function resetForm(): void {
  form.id = undefined;
  form.id_fornitore = null;
  form.id_account = '';
  form.customer = '';
  form.user = '';
  form.pw = '';
  form.chiave = '';
  form.iso = '';
  form.sis_metrico = '';
  form.note = '';
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(item: FornitoreAccnt): void {
  formMode.value = 'edit';
  form.id = item.id;
  form.id_fornitore = item.id_fornitore;
  form.id_account = item.id_account || '';
  form.customer = item.customer || '';
  form.user = item.user || '';
  form.pw = item.pw || '';
  form.chiave = item.chiave || '';
  form.iso = item.iso || '';
  form.sis_metrico = item.sis_metrico || '';
  form.note = item.note || '';
  formDialog.value = true;
}

async function save(): Promise<void> {
  if (!form.id_fornitore) return;
  saving.value = true;
  try {
    const payload: FornitoreAccntPayload = {
      id: form.id,
      id_fornitore: form.id_fornitore,
      id_partner: props.idAnagrafica,
      id_account: form.id_account.trim(),
      customer: form.customer.trim() || undefined,
      user: form.user.trim() || undefined,
      pw: form.pw || undefined,
      chiave: form.chiave || undefined,
      iso: form.iso || undefined,
      sis_metrico: form.sis_metrico || undefined,
      note: form.note.trim() || undefined,
    };
    if (formMode.value === 'create') {
      await fornitoriAccntService.create(payload);
      toast.success(t('fornitori_accnt.created'));
    } else {
      await fornitoriAccntService.update(payload);
      toast.success(t('fornitori_accnt.updated'));
    }
    formDialog.value = false;
    await load();
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openDelete(item: FornitoreAccnt): Promise<void> {
  const ok = await confirm.askDanger(
    t('fornitori_accnt.confirm_delete_message', { account: item.id_account }),
    t('fornitori_accnt.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await fornitoriAccntService.remove(item.id);
    toast.success(t('fornitori_accnt.deleted'));
    await load();
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

watch(() => props.idAnagrafica, load);
onMounted(() => {
  void loadCourierNames();
  void load();
});
</script>
