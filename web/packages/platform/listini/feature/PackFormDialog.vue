<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    persistent
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>
        {{ mode === 'create' ? t('price_lists.dialog_create_pack') : t('price_lists.dialog_edit_pack') }}
      </v-card-title>
      <v-card-text>
        <div class="cm-sec">{{ t('price_lists.sec_identity') }}</div>
        <div class="cm-grid mb-3">
          <v-select
            v-model="form.pack"
            :items="packItems"
            item-title="title"
            item-value="value"
            :label="t('price_lists.pack_type') + ' *'"
            :disabled="mode === 'edit'"
            density="compact"
          />
          <v-text-field
            v-model="form.cod_cliente_fornitore"
            :label="t('price_lists.account_code')"
            density="compact"
          />
          <CmValutaSelect
            :model-value="siglaToValutaId(form.valuta_sigla)"
            :label="t('price_lists.currency')"
            @select="(v) => (form.valuta_sigla = v?.sigla || form.valuta_sigla)"
          />
          <v-select
            v-model="form.metric_imperial"
            :items="unitItems"
            item-title="title"
            item-value="value"
            :label="t('price_lists.units')"
            density="compact"
          />
        </div>

        <div class="cm-sec">{{ t('price_lists.sec_geography') }}</div>
        <div class="cm-grid mb-3">
          <v-text-field
            v-model="form.paese_part"
            :label="t('price_lists.f_country_from')"
            maxlength="2"
            density="compact"
            @update:model-value="form.paese_part = String($event ?? '').toUpperCase()"
          />
          <v-text-field
            v-model="form.paese_dest"
            :label="t('price_lists.f_country_to')"
            maxlength="2"
            density="compact"
            @update:model-value="form.paese_dest = String($event ?? '').toUpperCase()"
          />
        </div>

        <div class="cm-sec">{{ t('price_lists.sec_codes') }}</div>
        <div class="cm-grid mb-3">
          <v-text-field v-model="form.cod_fornitore" :label="t('price_lists.f_cod_fornitore')" density="compact" />
          <v-text-field v-model="form.cod_fornitore2" :label="t('price_lists.f_cod_fornitore2')" density="compact" />
          <v-text-field v-model="form.cod_dhl_xml" :label="t('price_lists.f_cod_dhl_xml')" density="compact" />
        </div>

        <div class="cm-sec">{{ t('price_lists.sec_calc') }}</div>
        <div class="cm-grid mb-1">
          <v-select
            v-model="form.peso_bancale"
            :items="weightModeItems"
            item-title="title"
            item-value="value"
            :label="t('price_lists.f_weight_mode')"
            density="compact"
          />
          <v-text-field
            v-model.number="form.moltipl_ogni_x_kg"
            type="number"
            min="0"
            step="any"
            :label="t('price_lists.f_step_every_kg')"
            :disabled="form.moltipl_step !== 'S'"
            density="compact"
          />
        </div>
        <div class="cm-grid mb-3">
          <v-switch v-model="form.moltipl_step" true-value="S" false-value="N" :label="t('price_lists.f_step_pricing')" density="compact" hide-details color="primary" />
          <v-switch v-model="form.usa_num_coll_bank" true-value="S" false-value="N" :label="t('price_lists.f_use_pallets')" density="compact" hide-details color="primary" />
          <v-switch v-model="form.collo_sing_peso" true-value="S" false-value="N" :label="t('price_lists.f_single_parcel_weight')" density="compact" hide-details color="primary" />
          <v-switch v-model="form.costo_a_collo2" true-value="S" false-value="N" :label="t('price_lists.f_second_parcel_price')" density="compact" hide-details color="primary" />
          <v-switch v-model="form.usa_costo_base" true-value="S" false-value="N" :label="t('price_lists.f_use_base_cost')" density="compact" hide-details color="primary" />
          <v-switch v-model="form.usa_costo_min" true-value="S" false-value="N" :label="t('price_lists.f_use_min_cost')" density="compact" hide-details color="primary" />
        </div>

        <div class="cm-sec">{{ t('price_lists.sec_markup') }}</div>
        <div class="cm-grid mb-3">
          <v-text-field
            v-model.number="form.maggiorazione"
            type="number"
            step="any"
            :label="t('price_lists.f_markup')"
            density="compact"
          />
          <v-autocomplete
            v-model="form.id_listino_nome_magg"
            :items="baseOptions"
            item-title="nome"
            item-value="id"
            :loading="baseLoading"
            :label="t('price_lists.f_markup_base')"
            :disabled="!(Number(form.maggiorazione) > 0)"
            density="compact"
            clearable
            no-filter
            @update:search="searchBase"
          />
        </div>

        <v-text-field v-model="form.note" :label="t('price_lists.notes')" density="compact" class="mb-1" />
        <v-switch
          v-if="mode === 'edit'"
          v-model="form.attivo"
          true-value="S"
          false-value="N"
          :label="t('price_lists.f_active')"
          density="compact"
          hide-details
          color="primary"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="emit('update:modelValue', false)">{{
          t('common.cancel')
        }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="save">
          {{ mode === 'create' ? t('common.create') : t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Create/edit a pack for a price list. Extracted from PriceListsPage. Owns the
 * pack form + currency catalog; the parent passes the target list id and the
 * pack to edit, and refreshes packs on `saved`. The form is seeded from the
 * `pack` prop (edit) or reset to defaults (create) each time it opens.
 */
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import CmValutaSelect from '../components/CmValutaSelect.vue';
import { valuteService, type ValutaLite } from '../services/valute.service';
import {
  listiniService,
  type ListinoLite,
  type ListinoPack,
  type PackKind,
  type YesNo,
} from '../services/listini.service';

const props = defineProps<{
  modelValue: boolean;
  mode: 'create' | 'edit';
  /** Pack to edit (mode === 'edit'); null for create. */
  pack: ListinoPack | null;
  /** Target price-list id for a new pack. */
  listId: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const { t } = useI18n();
const toast = useToastStore();

const packItems = computed(() => [
  { title: t('price_lists.pack_document'), value: 'D' },
  { title: t('price_lists.pack_unique'), value: 'U' },
  { title: t('price_lists.pack_parcel'), value: 'P' },
  { title: t('price_lists.pack_parcel_s'), value: 'Ps' },
  { title: t('price_lists.pack_parcel_m'), value: 'Pm' },
]);
const weightModeItems = computed(() => [
  { title: t('price_lists.f_weight_mode_p'), value: 'P' },
  { title: t('price_lists.f_weight_mode_m'), value: 'M' },
  { title: t('price_lists.f_weight_mode_b'), value: 'B' },
]);
const unitItems = computed(() => [
  { title: t('price_lists.metric'), value: 'M' },
  { title: t('price_lists.imperial'), value: 'I' },
]);

// packForm.valuta_sigla persists a currency CODE string (e.g. 'EUR'), while
// CmValutaSelect works with the valute row id. Map sigla → id for :model-value
// and write the picked sigla back on @select. Value not in catalog is preserved.
const valuteList = ref<ValutaLite[]>([]);
function siglaToValutaId(sigla: string): number | null {
  const v = String(sigla ?? '').trim().toUpperCase();
  if (!v) return null;
  const hit = valuteList.value.find((c) => String(c.sigla).toUpperCase() === v);
  return hit ? hit.id : null;
}

interface PackForm {
  id?: number;
  pack: PackKind;
  cod_cliente_fornitore: string;
  cod_fornitore: string;
  cod_fornitore2: string;
  cod_dhl_xml: string;
  paese_part: string;
  paese_dest: string;
  valuta_sigla: string;
  metric_imperial: 'M' | 'I';
  peso_bancale: 'P' | 'M' | 'B';
  usa_num_coll_bank: YesNo;
  collo_sing_peso: YesNo;
  costo_a_collo2: YesNo;
  moltipl_step: YesNo;
  moltipl_ogni_x_kg: number;
  usa_costo_base: YesNo;
  usa_costo_min: YesNo;
  maggiorazione: number;
  id_listino_nome_magg: number | null;
  note: string;
  attivo: YesNo;
}

function defaults(): PackForm {
  return {
    id: undefined,
    pack: 'U',
    cod_cliente_fornitore: '',
    cod_fornitore: '',
    cod_fornitore2: '',
    cod_dhl_xml: '',
    paese_part: '',
    paese_dest: '',
    valuta_sigla: 'EUR',
    metric_imperial: 'M',
    peso_bancale: 'P',
    usa_num_coll_bank: 'N',
    collo_sing_peso: 'N',
    costo_a_collo2: 'N',
    moltipl_step: 'N',
    moltipl_ogni_x_kg: 1,
    usa_costo_base: 'N',
    usa_costo_min: 'N',
    maggiorazione: 0,
    id_listino_nome_magg: null,
    note: '',
    attivo: 'S',
  };
}

const form = reactive<PackForm>(defaults());

const saving = ref(false);

// Listino base de la maggiorazione: búsqueda remota por nombre.
const baseOptions = ref<ListinoLite[]>([]);
const baseLoading = ref(false);
let baseTimer: ReturnType<typeof setTimeout> | undefined;
function searchBase(q: string | null): void {
  clearTimeout(baseTimer);
  baseTimer = setTimeout(async () => {
    baseLoading.value = true;
    try {
      baseOptions.value = await listiniService.search(q ?? '');
    } catch {
      baseOptions.value = [];
    } finally {
      baseLoading.value = false;
    }
  }, 250);
}

function yn(v: unknown): YesNo {
  return v === 'S' ? 'S' : 'N';
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    Object.assign(form, defaults());
    if (props.mode === 'edit' && props.pack) {
      const pk = props.pack as Record<string, unknown> & ListinoPack;
      form.id = pk.id;
      form.pack = pk.pack;
      form.cod_cliente_fornitore = pk.cod_cliente_fornitore || '';
      form.cod_fornitore = String(pk.cod_fornitore ?? '');
      form.cod_fornitore2 = String(pk.cod_fornitore2 ?? '');
      form.cod_dhl_xml = String(pk.cod_dhl_xml ?? '');
      form.paese_part = String(pk.paese_part ?? '');
      form.paese_dest = String(pk.paese_dest ?? '');
      form.valuta_sigla = pk.valuta_sigla || 'EUR';
      form.metric_imperial = (pk.metric_imperial as 'M' | 'I') || 'M';
      form.peso_bancale = (['P', 'M', 'B'].includes(String(pk.peso_bancale)) ? pk.peso_bancale : 'P') as 'P' | 'M' | 'B';
      form.usa_num_coll_bank = yn(pk.usa_num_coll_bank);
      form.collo_sing_peso = yn(pk.collo_sing_peso);
      form.costo_a_collo2 = yn(pk.costo_a_collo2);
      form.moltipl_step = yn(pk.moltipl_step);
      form.moltipl_ogni_x_kg = Number(pk.moltipl_ogni_x_kg ?? 1) || 1;
      form.usa_costo_base = yn(pk.usa_costo_base);
      form.usa_costo_min = yn(pk.usa_costo_min);
      form.maggiorazione = Number(pk.maggiorazione ?? 0) || 0;
      const mg = Number(pk.id_listino_nome_magg ?? 0);
      form.id_listino_nome_magg = mg > 0 ? mg : null;
      form.note = pk.note || '';
      form.attivo = pk.attivo === 'N' ? 'N' : 'S';
    }
    searchBase('');
  },
);

async function save(): Promise<void> {
  const isCreate = props.mode === 'create';
  if (isCreate && !props.listId) return;
  saving.value = true;
  try {
    const { id, pack, attivo, id_listino_nome_magg, ...rest } = form;
    await listiniService.savePack({
      ...rest,
      id,
      id_listino: isCreate ? (props.listId as number) : undefined,
      pack,
      id_listino_nome_magg: Number(rest.maggiorazione) > 0 ? (id_listino_nome_magg ?? 0) : 0,
      attivo: isCreate ? 'S' : attivo,
    });
    toast.success(isCreate ? t('price_lists.pack_created') : t('price_lists.pack_updated'));
    emit('update:modelValue', false);
    emit('saved');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void valuteService
    .list()
    .then((list) => {
      valuteList.value = list;
    })
    .catch(() => {
      valuteList.value = [];
    });
});
</script>

<style scoped>
.cm-sec {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.7;
  margin: 4px 0 8px;
}
</style>
