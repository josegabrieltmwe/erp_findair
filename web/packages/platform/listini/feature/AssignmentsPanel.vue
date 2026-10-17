<template>
  <div>
    <CmSectionHeader
      :title="t('price_lists.assignments_title')"
      :subtitle="t('price_lists.assignments_subtitle')"
    />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="d-flex align-center ga-3 flex-wrap">
        <CmAnagraficaAutocomplete
          :model-value="clientId"
          :label="t('price_lists.assignments_client')"
          style="max-width: 360px; flex: 1 1 320px"
          @update:model-value="onClientPick"
        />
        <v-spacer />
        <v-btn
          v-if="clientId"
          color="primary"
          size="small"
          :prepend-icon="mdiPlus"
          @click="openCreate"
        >
          {{ t('price_lists.assignments_new') }}
        </v-btn>
      </div>
    </v-card>

    <div v-if="!clientId" class="cm-detail-hint">
      {{ t('price_lists.assignments_pick_client') }}
    </div>

    <CmAsyncSection
      v-else
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiLinkVariant" :title="t('price_lists.assignments_empty')" />
      </template>
      <template #default>
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t('price_lists.assignments_service') }}</th>
              <th>{{ t('price_lists.assignments_listino') }}</th>
              <th>{{ t('price_lists.assignments_type') }}</th>
              <th class="text-right">{{ t('price_lists.assignments_coef') }}</th>
              <th class="text-right">{{ t('price_lists.assignments_fuel') }}</th>
              <th class="text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in rows" :key="a.id">
              <td>{{ a.servizio_nome ?? a.id_servizio }}</td>
              <td>{{ a.listino_nome ?? a.id_listino_nome ?? '—' }}</td>
              <td>
                <v-chip size="x-small" :color="a.tipo === 'P' ? 'warning' : 'info'" variant="tonal">
                  {{ a.tipo === 'P' ? t('price_lists.assignments_type_p') : t('price_lists.assignments_type_l') }}
                </v-chip>
              </td>
              <td class="text-right cm-mono">{{ fmt(a.coefficiente) }}</td>
              <td class="text-right cm-mono">{{ fmt(a.fuel_surc) }}</td>
              <td class="text-right">
                <v-btn
                  size="x-small"
                  variant="text"
                  :icon="mdiPencil"
                  @click="openEdit(a)"
                />
                <v-btn
                  size="x-small"
                  variant="text"
                  color="error"
                  :icon="mdiDelete"
                  @click="confirmDelete(a)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </CmAsyncSection>

    <!-- ═══ CREATE / EDIT DIALOG ═══ -->
    <v-dialog v-model="dialog" max-width="520" persistent>
      <v-card>
        <v-card-title>
          {{ editId ? t('price_lists.assignments_edit') : t('price_lists.assignments_new') }}
        </v-card-title>
        <v-card-text>
          <CmEntityAutocomplete
            v-if="!editId"
            :model-value="form.id_servizio"
            :fetcher="fetchServices"
            :item-getter="getService"
            :format-primary="formatService"
            :label="t('price_lists.assignments_service')"
            class="mb-3"
            @update:model-value="form.id_servizio = $event == null ? null : Number($event)"
          />
          <v-text-field
            v-else
            :model-value="String(form.servizio_nome ?? form.id_servizio ?? '')"
            :label="t('price_lists.assignments_service')"
            density="compact"
            variant="outlined"
            readonly
            hide-details
            class="mb-3"
          />

          <CmEntityAutocomplete
            :model-value="form.id_listino_nome"
            :fetcher="fetchListinos"
            :item-getter="getListino"
            :format-primary="formatListino"
            :label="t('price_lists.assignments_listino')"
            class="mb-3"
            @update:model-value="form.id_listino_nome = $event == null ? null : Number($event)"
          />

          <v-select
            v-model="form.tipo"
            :items="tipoItems"
            :label="t('price_lists.assignments_type')"
            density="compact"
            variant="outlined"
            hide-details
            class="mb-3"
          />

          <div class="d-flex ga-3">
            <v-text-field
              v-model.number="form.coefficiente"
              :label="t('price_lists.assignments_coef')"
              type="number"
              step="0.01"
              min="0"
              density="compact"
              variant="outlined"
              hide-details
            />
            <v-text-field
              v-model.number="form.fuel_surc"
              :label="t('price_lists.assignments_fuel')"
              type="number"
              step="0.01"
              min="0"
              density="compact"
              variant="outlined"
              hide-details
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="dialog = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="!canSave"
            @click="save"
          >
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiLinkVariant } from '@mdi/js';
import CmSectionHeader from '@shared/anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '@shared/anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '@shared/anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../components/CmAnagraficaAutocomplete.vue';
import CmEntityAutocomplete from '../components/CmEntityAutocomplete.vue';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import { useConfirm } from '@shared/anagrafiche/composables/useConfirm';
import { http } from '@shared/anagrafiche/services/http';
import { paginated } from '@shared/anagrafiche/services/normalizers';
import { listiniService, type ListinoAssignment, type ListinoLite } from '../services/listini.service';

interface ServiceLite {
  id: number | string;
  descr?: string;
  id_fornitore?: number | string;
  [k: string]: unknown;
}

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const clientId = ref<number | null>(null);
const rows = ref<ListinoAssignment[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const tipoItems = computed(() => [
  { title: t('price_lists.assignments_type_l'), value: 'L' },
  { title: t('price_lists.assignments_type_p'), value: 'P' },
]);

function fmt(v: unknown): string {
  if (v === '' || v === null || v === undefined) return '—';
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toFixed(2);
}

async function onClientPick(id: number | null): Promise<void> {
  clientId.value = id;
  if (id) await load();
  else rows.value = [];
}

async function load(): Promise<void> {
  if (!clientId.value) return;
  loading.value = true;
  error.value = null;
  try {
    rows.value = await listiniService.listAssignments({ id_anagrafica: clientId.value });
  } catch (e) {
    rows.value = [];
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

// ── Dialog ──
const dialog = ref(false);
const saving = ref(false);
const editId = ref<number | null>(null);

interface AssignmentForm {
  id_servizio: number | null;
  id_listino_nome: number | null;
  tipo: string;
  coefficiente: number;
  fuel_surc: number;
  servizio_nome?: string;
}

const form = ref<AssignmentForm>({
  id_servizio: null,
  id_listino_nome: null,
  tipo: 'L',
  coefficiente: 0,
  fuel_surc: 0,
});

const canSave = computed<boolean>(() => {
  if (editId.value) return form.value.id_listino_nome != null;
  return form.value.id_servizio != null && form.value.id_listino_nome != null;
});

function openCreate(): void {
  editId.value = null;
  form.value = { id_servizio: null, id_listino_nome: null, tipo: 'L', coefficiente: 0, fuel_surc: 0 };
  dialog.value = true;
}

function openEdit(a: ListinoAssignment): void {
  editId.value = a.id;
  form.value = {
    id_servizio: a.id_servizio != null ? Number(a.id_servizio) : null,
    id_listino_nome: a.id_listino_nome != null ? Number(a.id_listino_nome) : null,
    tipo: (a.tipo as string) ?? 'L',
    coefficiente: Number(a.coefficiente ?? 0),
    fuel_surc: Number(a.fuel_surc ?? 0),
    servizio_nome: (a.servizio_nome as string) ?? undefined,
  };
  dialog.value = true;
}

async function save(): Promise<void> {
  if (!clientId.value || !canSave.value) return;
  saving.value = true;
  try {
    if (editId.value) {
      await listiniService.updateAssignment(editId.value, {
        id_listino_nome: form.value.id_listino_nome ?? undefined,
        tipo: form.value.tipo,
        coefficiente: form.value.coefficiente,
        fuel_surc: form.value.fuel_surc,
      });
      toast.success(t('price_lists.assignments_saved'));
    } else {
      await listiniService.createAssignment({
        id_anagrafica: clientId.value,
        id_servizio: form.value.id_servizio ?? undefined,
        id_listino_nome: form.value.id_listino_nome ?? undefined,
        tipo: form.value.tipo,
        coefficiente: form.value.coefficiente,
        fuel_surc: form.value.fuel_surc,
      });
      toast.success(t('price_lists.assignments_saved'));
    }
    dialog.value = false;
    await load();
  } catch (e) {
    toast.error((e instanceof Error ? e.message : String(e)));
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(a: ListinoAssignment): Promise<void> {
  const ok = await confirm.askDanger(
    t('price_lists.assignments_delete_msg'),
    t('price_lists.assignments_delete_title'),
  );
  if (!ok) return;
  try {
    await listiniService.removeAssignment(a.id);
    toast.success(t('price_lists.assignments_deleted'));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Selectors ──
async function fetchServices(query: string, perPage?: number): Promise<ServiceLite[]> {
  const q = query.trim();
  const params: Record<string, string | number> = { per_page: perPage ?? 25 };
  if (q) params.search = q;
  const raw = await http<unknown>('/api_supplier_services', { query: params });
  if (Array.isArray(raw)) return raw as ServiceLite[];
  return paginated<ServiceLite>(raw).items;
}

async function getService(id: number | string): Promise<ServiceLite | null> {
  const nid = typeof id === 'number' ? id : parseInt(String(id), 10);
  if (!nid) return null;
  const raw = await http<unknown>('/api_supplier_services', { query: { id: nid } });
  if (Array.isArray(raw)) return (raw[0] as ServiceLite) ?? null;
  if (raw && typeof raw === 'object') {
    const data = (raw as { data?: unknown }).data ?? raw;
    if (Array.isArray(data)) return (data[0] as ServiceLite) ?? null;
    return data as ServiceLite;
  }
  return null;
}

function formatService(r: ServiceLite): string {
  return r.descr || `#${r.id}`;
}

async function fetchListinos(query: string, perPage?: number): Promise<ListinoLite[]> {
  return listiniService.search(query, perPage ?? 25);
}

async function getListino(id: number | string): Promise<ListinoLite | null> {
  const nid = typeof id === 'number' ? id : parseInt(String(id), 10);
  if (!nid) return null;
  return listiniService.getById(nid);
}

function formatListino(r: ListinoLite): string {
  return r.nome?.trim() || `#${r.id}`;
}
</script>

<style scoped>
.cm-detail-hint {
  padding: 24px;
  text-align: center;
  color: var(--cm-text-muted);
}
.cm-mono {
  font-family: var(--cm-font-mono, monospace);
}
</style>
