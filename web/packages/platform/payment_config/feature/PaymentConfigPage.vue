<template>
  <div>
    <CmSectionHeader
      :title="t('sections.payment_config')"
      :subtitle="t('payment_config.subtitle')"
    />

    <v-tabs v-model="activeTab" density="compact" class="mb-4">
      <v-tab value="methods" :prepend-icon="mdiCreditCard">{{ t('payment_config.tab_methods') }}</v-tab>
      <v-tab value="schedules" :prepend-icon="mdiCalendarClock">{{ t('payment_config.tab_terms') }}</v-tab>
    </v-tabs>

    <!-- ═══ PAYMENT METHODS ═══ -->
    <div v-show="activeTab === 'methods'">
      <div class="cm-actions-right mb-3">
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openMethodCreate">
          {{ t('payment_config.new_method') }}
        </v-btn>
      </div>

      <CmEmptyState
        v-if="!methodsLoading && !methodsError && methods.length === 0"
        :icon="mdiCreditCard"
        :title="t('payment_config.empty_methods')"
      />
      <ListingDataView
        v-else
        :source="methodsListSource"
        :headers="methodsHeaders"
        :selected="selectedMethods"
        :sort-key-map="methodsSortKeyMap"
        mode="infinite"
        :selectable="false"
        @update:selected="selectedMethods = $event"
      >
        <template #cell.descr="{ item }">
          <div>{{ (item as PaymentMethod).descr }}</div>
          <div v-if="(item as PaymentMethod).descrEN" class="cm-cell-hint">{{ (item as PaymentMethod).descrEN }}</div>
        </template>
        <template #cell.tipo="{ item }">
          <v-chip size="small" :color="tipoColor[(item as PaymentMethod).tipo] || undefined" variant="tonal">
            {{ tipoLabel((item as PaymentMethod).tipo) }}
          </v-chip>
        </template>
        <template #cell.xml_code="{ item }">
          <span class="cm-mono">{{ (item as PaymentMethod).xml_code || '—' }}</span>
        </template>
        <template #cell.actions="{ item }">
          <div class="cm-actions-right">
            <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openMethodEdit(item as PaymentMethod)">
              {{ t('common.edit') }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              :prepend-icon="mdiDelete"
              @click="confirmDeleteMethod(item as PaymentMethod)"
            >
              {{ t('common.delete') }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
      <v-alert v-if="methodsError" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="methodsError = null">
        {{ methodsError }}
      </v-alert>
    </div>

    <!-- ═══ PAYMENT TERMS ═══ -->
    <div v-show="activeTab === 'schedules'">
      <div class="cm-actions-right mb-3">
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openScheduleCreate">
          {{ t('payment_config.new_term') }}
        </v-btn>
      </div>

      <CmEmptyState
        v-if="!schedulesLoading && !schedulesError && schedules.length === 0"
        :icon="mdiCalendarClock"
        :title="t('payment_config.empty_terms')"
      />
      <ListingDataView
        v-else
        :source="schedulesListSource"
        :headers="schedulesHeaders"
        :selected="selectedSchedules"
        :sort-key-map="schedulesSortKeyMap"
        mode="infinite"
        :selectable="false"
        @update:selected="selectedSchedules = $event"
      >
        <template #cell.label="{ item }">
          <div>{{ (item as PaymentSchedule).label || `#${(item as PaymentSchedule).id}` }}</div>
          <div class="cm-cell-hint">
            <span v-if="(item as PaymentSchedule).end_of_month">{{ t('payment_config.end_of_month') }}</span>
            <span v-else-if="((item as PaymentSchedule).ggmese ?? 0) > 0">
              {{ t('payment_config.day_of_month', { day: (item as PaymentSchedule).ggmese }) }}
            </span>
            <span v-if="(item as PaymentSchedule).clienti === 'S'"> · {{ t('payment_config.also_customers') }}</span>
          </div>
        </template>
        <template #cell.installments="{ item }">
          <div v-if="(item as PaymentSchedule).installments && (item as PaymentSchedule).installments!.length" class="cm-chip-row">
            <v-chip v-for="inst in (item as PaymentSchedule).installments" :key="inst" size="x-small" variant="tonal">
              {{ t('payment_config.n_days', { n: inst }) }}
            </v-chip>
          </div>
          <span v-else class="cm-cell-hint">{{ t('payment_config.n_installments', { n: (item as PaymentSchedule).nrate || 0 }) }}</span>
        </template>
        <template #cell.actions="{ item }">
          <div class="cm-actions-right">
            <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openScheduleEdit(item as PaymentSchedule)">
              {{ t('common.edit') }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              :prepend-icon="mdiDelete"
              @click="confirmDeleteSchedule(item as PaymentSchedule)"
            >
              {{ t('common.delete') }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
      <v-alert v-if="schedulesError" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="schedulesError = null">
        {{ schedulesError }}
      </v-alert>
    </div>

    <!-- ═══ METHOD DIALOG ═══ -->
    <v-dialog v-model="methodDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>
          {{ methodMode === 'create' ? t('payment_config.dialog_create_method') : t('payment_config.dialog_edit_method') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="methodForm.descr"
            :label="t('payment_config.form_descr')"
            density="compact"
            class="mb-3"
          />
          <v-text-field
            v-model="methodForm.descrEN"
            :label="t('payment_config.form_descr_en')"
            density="compact"
            class="mb-3"
          />
          <v-select
            v-model="methodForm.tipo"
            :items="tipoOptions"
            item-title="title"
            item-value="value"
            :label="t('payment_config.form_type')"
            density="compact"
            class="mb-3"
          />
          <v-text-field
            v-model="methodForm.xml_code"
            :label="t('payment_config.form_xml_code')"
            density="compact"
            class="mb-3"
          />
          <v-text-field
            v-model.number="methodForm.orderby"
            :label="t('payment_config.form_orderby')"
            type="number"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingMethod" @click="methodDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="savingMethod" :disabled="!methodForm.descr" @click="saveMethod">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ SCHEDULE DIALOG ═══ -->
    <v-dialog v-model="scheduleDialog" max-width="560" persistent>
      <v-card>
        <v-card-title>
          {{ scheduleMode === 'create' ? t('payment_config.dialog_create_term') : t('payment_config.dialog_edit_term') }}
        </v-card-title>
        <v-card-text>
          <div class="text-subtitle-2 mb-2">{{ t('payment_config.brackets_title') }}</div>
          <div class="cm-chip-row mb-4">
            <v-chip
              v-for="d in GG_BRACKETS"
              :key="d"
              size="small"
              :variant="scheduleForm['gg' + d] === 'S' ? 'flat' : 'outlined'"
              :color="scheduleForm['gg' + d] === 'S' ? 'primary' : undefined"
              style="cursor: pointer"
              @click="toggleBracket(d)"
            >
              {{ t('payment_config.n_days', { n: d }) }}
            </v-chip>
          </div>

          <v-text-field
            v-model.number="scheduleForm.ggmese"
            :label="t('payment_config.form_day_of_month')"
            type="number"
            min="0"
            max="28"
            density="compact"
            class="mb-3"
            style="max-width: 300px"
          />

          <v-checkbox
            v-model="scheduleForm.clienti"
            true-value="S"
            false-value="N"
            :label="t('payment_config.form_also_customers')"
            density="compact"
            hide-details
            class="mb-3"
          />

          <v-text-field
            v-model.number="scheduleForm.orderby"
            :label="t('payment_config.form_orderby')"
            type="number"
            density="compact"
            class="mb-4"
            style="max-width: 180px"
          />

          <v-sheet rounded border class="pa-3">
            <div class="cm-cell-hint text-uppercase mb-1">{{ t('payment_config.preview') }}</div>
            <div class="cm-mono text-h6">{{ schedulePreview }}</div>
          </v-sheet>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingSchedule" @click="scheduleDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="savingSchedule" @click="saveSchedule">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiCreditCard, mdiCalendarClock } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  paymentConfigService,
  GG_BRACKETS,
  type PaymentMethod,
  type PaymentMethodType,
  type PaymentSchedule,
  type PaymentSchedulePayload,
} from '../services/paymentConfig.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const activeTab = ref<'methods' | 'schedules'>('methods');

// ── Methods state ──
const methods = ref<PaymentMethod[]>([]);
const methodsLoading = ref(false);
const methodsError = ref<string | null>(null);
const methodDialog = ref(false);
const methodMode = ref<'create' | 'edit'>('create');
const savingMethod = ref(false);
const selectedMethods = ref<{ id: number }[]>([]);
const methodsListSource = useClientSideListSource(methods, { loading: methodsLoading });
const methodsHeaders: DataTableHeader[] = [
  { title: t('payment_config.col_description') as string, key: 'descr' },
  { title: t('payment_config.col_type') as string, key: 'tipo' },
  { title: t('payment_config.col_xml_code') as string, key: 'xml_code' },
  { title: t('common.actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const methodsSortKeyMap: Record<string, string> = { descr: 'descr', tipo: 'tipo', xml_code: 'xml_code' };

interface MethodFormState {
  id?: number;
  descr: string;
  descrEN: string;
  tipo: PaymentMethodType;
  xml_code: string;
  orderby: number;
}
const methodForm = reactive<MethodFormState>({
  descr: '',
  descrEN: '',
  tipo: 'P',
  xml_code: '',
  orderby: 0,
});

// ── Schedules state ──
const schedules = ref<PaymentSchedule[]>([]);
const schedulesLoading = ref(false);
const schedulesError = ref<string | null>(null);
const scheduleDialog = ref(false);
const scheduleMode = ref<'create' | 'edit'>('create');
const savingSchedule = ref(false);
const selectedSchedules = ref<{ id: number }[]>([]);
const schedulesListSource = useClientSideListSource(schedules, { loading: schedulesLoading });
const schedulesHeaders: DataTableHeader[] = [
  { title: t('payment_config.col_term') as string, key: 'label' },
  { title: t('payment_config.col_installments') as string, key: 'installments', sortable: false },
  { title: t('common.actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const schedulesSortKeyMap: Record<string, string> = { label: 'label' };

type ScheduleFormState = {
  id?: number;
  ggmese: number;
  clienti: 'S' | 'N';
  orderby: number;
} & Record<string, unknown>;

function emptyScheduleForm(): ScheduleFormState {
  const f: ScheduleFormState = { ggmese: 0, clienti: 'S', orderby: 0 };
  GG_BRACKETS.forEach((d) => (f['gg' + d] = 'N'));
  return f;
}
const scheduleForm = reactive<ScheduleFormState>(emptyScheduleForm());

// ── Type labels ──
const tipoOptions = computed(() => [
  { title: t('payment_config.type_payment'), value: 'P' },
  { title: t('payment_config.type_income'), value: 'A' },
  { title: t('payment_config.type_both'), value: 'E' },
]);
const tipoColor: Record<string, string> = { A: 'success', P: 'info', E: 'warning' };
function tipoLabel(tipo: string): string {
  const map: Record<string, string> = {
    P: t('payment_config.type_payment'),
    A: t('payment_config.type_income'),
    E: t('payment_config.type_both'),
  };
  return map[tipo] || tipo;
}

const schedulePreview = computed(() => {
  const days = GG_BRACKETS.filter((d) => scheduleForm['gg' + d] === 'S');
  if (days.length === 0) return t('payment_config.no_installments');
  let label = days.join('/');
  label += (scheduleForm.ggmese ?? 0) > 0 ? ` g.${scheduleForm.ggmese}` : ' FM';
  return label;
});

// ── Methods CRUD ──
async function loadMethods(): Promise<void> {
  methodsLoading.value = true;
  methodsError.value = null;
  try {
    methods.value = await paymentConfigService.listMethods();
  } catch (e) {
    methodsError.value = e instanceof Error ? e.message : String(e);
  } finally {
    methodsLoading.value = false;
  }
}

function openMethodCreate(): void {
  methodMode.value = 'create';
  methodForm.id = undefined;
  methodForm.descr = '';
  methodForm.descrEN = '';
  methodForm.tipo = 'P';
  methodForm.xml_code = '';
  methodForm.orderby = 0;
  methodDialog.value = true;
}

function openMethodEdit(m: PaymentMethod): void {
  methodMode.value = 'edit';
  methodForm.id = m.id;
  methodForm.descr = m.descr || '';
  methodForm.descrEN = m.descrEN || '';
  methodForm.tipo = m.tipo || 'P';
  methodForm.xml_code = m.xml_code || '';
  methodForm.orderby = m.orderby || 0;
  methodDialog.value = true;
}

async function saveMethod(): Promise<void> {
  savingMethod.value = true;
  try {
    const payload = {
      id: methodForm.id,
      descr: methodForm.descr,
      descrEN: methodForm.descrEN,
      tipo: methodForm.tipo,
      xml_code: methodForm.xml_code,
      orderby: methodForm.orderby,
    };
    if (methodMode.value === 'create') {
      await paymentConfigService.createMethod(payload);
      toast.success(t('payment_config.method_created'));
    } else {
      await paymentConfigService.updateMethod(payload);
      toast.success(t('payment_config.method_updated'));
    }
    methodDialog.value = false;
    await loadMethods();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingMethod.value = false;
  }
}

async function confirmDeleteMethod(m: PaymentMethod): Promise<void> {
  const ok = await confirm.askDanger(
    t('payment_config.confirm_delete_method', { name: m.descr }),
    t('payment_config.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await paymentConfigService.removeMethod(m.id);
    toast.success(t('payment_config.method_deleted'));
    await loadMethods();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Schedules CRUD ──
async function loadSchedules(): Promise<void> {
  schedulesLoading.value = true;
  schedulesError.value = null;
  try {
    schedules.value = await paymentConfigService.listSchedules();
  } catch (e) {
    schedulesError.value = e instanceof Error ? e.message : String(e);
  } finally {
    schedulesLoading.value = false;
  }
}

function applyScheduleForm(src: ScheduleFormState): void {
  scheduleForm.id = src.id;
  scheduleForm.ggmese = src.ggmese;
  scheduleForm.clienti = src.clienti;
  scheduleForm.orderby = src.orderby;
  GG_BRACKETS.forEach((d) => (scheduleForm['gg' + d] = src['gg' + d] ?? 'N'));
}

function openScheduleCreate(): void {
  scheduleMode.value = 'create';
  applyScheduleForm(emptyScheduleForm());
  scheduleDialog.value = true;
}

function openScheduleEdit(s: PaymentSchedule): void {
  scheduleMode.value = 'edit';
  const f: ScheduleFormState = {
    id: s.id,
    ggmese: s.ggmese || 0,
    clienti: (s.clienti as 'S' | 'N') || 'S',
    orderby: s.orderby || 0,
  };
  GG_BRACKETS.forEach((d) => (f['gg' + d] = (s['gg' + d] as 'S' | 'N') || 'N'));
  applyScheduleForm(f);
  scheduleDialog.value = true;
}

function toggleBracket(day: number): void {
  const key = 'gg' + day;
  scheduleForm[key] = scheduleForm[key] === 'S' ? 'N' : 'S';
}

async function saveSchedule(): Promise<void> {
  savingSchedule.value = true;
  try {
    const payload: PaymentSchedulePayload = {
      id: scheduleForm.id,
      ggmese: scheduleForm.ggmese,
      clienti: scheduleForm.clienti,
      orderby: scheduleForm.orderby,
    };
    GG_BRACKETS.forEach((d) => (payload['gg' + d] = scheduleForm['gg' + d]));
    if (scheduleMode.value === 'create') {
      await paymentConfigService.createSchedule(payload);
      toast.success(t('payment_config.term_created'));
    } else {
      await paymentConfigService.updateSchedule(payload);
      toast.success(t('payment_config.term_updated'));
    }
    scheduleDialog.value = false;
    await loadSchedules();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingSchedule.value = false;
  }
}

async function confirmDeleteSchedule(s: PaymentSchedule): Promise<void> {
  const ok = await confirm.askDanger(
    t('payment_config.confirm_delete_term', { name: s.label || '#' + s.id }),
    t('payment_config.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await paymentConfigService.removeSchedule(s.id);
    toast.success(t('payment_config.term_deleted'));
    await loadSchedules();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void loadMethods();
  void loadSchedules();
});
</script>
