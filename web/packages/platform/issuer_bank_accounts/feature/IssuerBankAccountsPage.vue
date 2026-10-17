<template>
  <div>
    <CmSectionHeader
      :title="t('sections.issuer_bank_accounts')"
      :subtitle="t('issuer_bank_accounts.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('issuer_bank_accounts.new_account') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiBank"
      :title="t('issuer_bank_accounts.empty_title')"
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
      <template #cell.nome="{ item }">
        <div class="font-weight-medium">{{ (item as IssuerBankAccount).nome || '—' }}</div>
        <div v-if="(item as IssuerBankAccount).agenzia" class="cm-cell-hint">
          {{ (item as IssuerBankAccount).agenzia }}
        </div>
      </template>
      <template #cell.iban="{ item }">
        <span class="cm-mono">{{ (item as IssuerBankAccount).iban || '—' }}</span>
      </template>
      <template #cell.swift="{ item }">
        <span class="cm-mono">{{ (item as IssuerBankAccount).swift || '—' }}</span>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as IssuerBankAccount)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="confirmRemove(item as IssuerBankAccount)"
          >
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Dialog alta/edición -->
    <v-dialog v-model="dialog" max-width="640">
      <v-card>
        <v-card-title>{{ editing ? t('issuer_bank_accounts.edit_account') : t('issuer_bank_accounts.new_account') }}</v-card-title>
        <v-divider />
        <v-card-text>
          <v-row dense>
            <v-col cols="12" md="7">
              <v-text-field v-model="form.nome" :label="t('issuer_bank_accounts.col_name')" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" md="5">
              <v-text-field v-model="form.agenzia" :label="t('issuer_bank_accounts.agenzia')" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" md="8">
              <v-text-field v-model="form.iban" label="IBAN" density="compact" variant="outlined" class="cm-mono" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.swift" label="SWIFT/BIC" density="compact" variant="outlined" class="cm-mono" />
            </v-col>
            <v-col cols="6" md="3"><v-text-field v-model="form.abi" label="ABI" density="compact" variant="outlined" /></v-col>
            <v-col cols="6" md="3"><v-text-field v-model="form.cab" label="CAB" density="compact" variant="outlined" /></v-col>
            <v-col cols="6" md="2"><v-text-field v-model="form.cin" label="CIN" density="compact" variant="outlined" /></v-col>
            <v-col cols="6" md="4"><v-text-field v-model="form.cc" :label="t('issuer_bank_accounts.cc')" density="compact" variant="outlined" /></v-col>
            <v-col cols="12">
              <v-text-field v-model="form.note" :label="t('common.notes')" density="compact" variant="outlined" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiBank } from '@mdi/js';
import {
  issuerBankAccountsService,
  type IssuerBankAccount,
  type IssuerBankAccountPayload,
} from '../services/issuerBankAccounts.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<IssuerBankAccount[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<IssuerBankAccount | null>(null);
const form = ref<IssuerBankAccountPayload>({});
const selected = ref<{ id: number }[]>([]);

// Cargado entero en memoria (no hay paginación server-side): el adaptador
// correcto es useClientSideListSource, no un ListSource propio (§6.6 —
// "para datasets locales acotados"). modo 'infinite' porque son pocas filas.
const listSource = useClientSideListSource(items, { loading });

const tableHeaders: DataTableHeader[] = [
  { title: t('issuer_bank_accounts.col_name') as string, key: 'nome' },
  { title: t('issuer_bank_accounts.col_iban') as string, key: 'iban' },
  { title: t('issuer_bank_accounts.col_swift') as string, key: 'swift' },
  { title: t('common.actions') as string, key: 'actions', sortable: false, align: 'end' },
];

// Sin backend: el orden es 100% en memoria (useClientSideListSource), así
// que la clave UI y la de "backend" son la misma — no hay traducción que hacer.
const sortKeyMap: Record<string, string> = { nome: 'nome', iban: 'iban', swift: 'swift' };

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await issuerBankAccountsService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  form.value = {};
  dialog.value = true;
}

function openEdit(item: IssuerBankAccount): void {
  editing.value = item;
  form.value = {
    nome: item.nome, agenzia: item.agenzia, iban: item.iban, swift: item.swift,
    abi: item.abi, cab: item.cab, cin: item.cin, cc: item.cc, note: item.note,
  };
  dialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    if (editing.value) {
      await issuerBankAccountsService.update(editing.value.id, form.value);
      toast.success(t('common.saved'));
    } else {
      await issuerBankAccountsService.create(form.value);
      toast.success(t('common.created'));
    }
    dialog.value = false;
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function confirmRemove(item: IssuerBankAccount): Promise<void> {
  const ok = await confirm.askDanger(
    t('issuer_bank_accounts.delete_message', { name: item.nome || item.iban }),
    t('issuer_bank_accounts.delete_title'),
  );
  if (!ok) return;
  try {
    await issuerBankAccountsService.remove(item.id);
    toast.success(t('common.deleted'));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>
