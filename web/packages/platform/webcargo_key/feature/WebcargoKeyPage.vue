<template>
  <div>
    <CmSectionHeader :title="t('sections.webcargo_key')" :subtitle="t('webcargo_key.subtitle')">
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('webcargo_key.add') }}
        </v-btn>
        <v-btn :icon="mdiRefresh" variant="text" size="small" class="ml-2" @click="reload" />
      </template>
    </CmSectionHeader>

    <v-alert type="info" variant="tonal" density="compact" class="mb-4" :text="t('webcargo_key.fallback_hint')" />

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="6"
      :skeleton-cols="6"
    >
      <v-card variant="outlined">
        <v-table density="comfortable">
          <thead>
            <tr>
              <th style="width: 90px">{{ t('webcargo_key.col_country') }}</th>
              <th>{{ t('webcargo_key.col_agent') }}</th>
              <th>{{ t('webcargo_key.col_terminals') }}</th>
              <th style="width: 110px" class="text-center">{{ t('webcargo_key.col_key') }}</th>
              <th style="width: 100px" class="text-center">{{ t('webcargo_key.col_primary') }}</th>
              <th style="width: 80px" class="text-center">B2B</th>
              <th style="width: 110px" class="text-right">{{ t('webcargo_key.col_actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="font-weight-medium">{{ row.iso_paese || '—' }}</td>
              <td>
                <div>{{ row.anagrafica_nome || '—' }}</div>
                <div class="text-caption text-medium-emphasis">#{{ row.id_anagrafica }}</div>
              </td>
              <td class="text-caption">{{ terminals(row) || '—' }}</td>
              <td class="text-center">
                <v-icon
                  :icon="row.has_key1 ? mdiKey : mdiKeyRemove"
                  :color="row.has_key1 ? 'success' : 'warning'"
                  size="small"
                />
              </td>
              <td class="text-center">
                <v-chip v-if="row.principale === 'S'" color="primary" size="x-small" variant="tonal">
                  {{ t('webcargo_key.primary') }}
                </v-chip>
                <span v-else class="text-medium-emphasis">—</span>
              </td>
              <td class="text-center">
                <v-icon
                  :icon="row.b2b === 'S' ? mdiCheck : mdiClose"
                  :color="row.b2b === 'S' ? 'success' : 'grey'"
                  size="small"
                />
              </td>
              <td class="text-right">
                <v-btn :icon="mdiPencil" variant="text" size="small" @click="openEdit(row)" />
                <v-btn :icon="mdiDelete" variant="text" size="small" color="error" @click="confirmDelete(row)" />
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </CmAsyncSection>

    <!-- Alta / edición -->
    <v-dialog v-model="dialog" max-width="620">
      <v-card>
        <v-card-title>
          {{ editing ? t('webcargo_key.edit_title') : t('webcargo_key.add_title') }}
        </v-card-title>
        <v-card-text>
          <div class="d-flex ga-3 mb-3">
            <v-text-field
              v-model="form.iso_paese"
              :label="t('webcargo_key.form_country')"
              placeholder="ES"
              maxlength="2"
              density="compact"
              style="max-width: 120px"
            />
            <CmAnagraficaAutocomplete
              v-model="formAnagraficaId"
              :label="t('webcargo_key.form_agent')"
            />
          </div>

          <v-text-field
            v-model="form.key1"
            :label="t('webcargo_key.form_key1')"
            :placeholder="editing ? t('webcargo_key.form_key_keep') : ''"
            :hint="editing ? t('webcargo_key.form_key_hint_edit') : t('webcargo_key.form_key_hint_new')"
            persistent-hint
            density="compact"
            class="mb-3"
            autocomplete="off"
          />
          <v-text-field
            v-model="form.key2"
            :label="t('webcargo_key.form_key2')"
            :placeholder="editing ? t('webcargo_key.form_key_keep') : ''"
            density="compact"
            class="mb-3"
            autocomplete="off"
          />

          <v-text-field
            v-model="terminalsInput"
            :label="t('webcargo_key.form_terminals')"
            :hint="t('webcargo_key.form_terminals_hint')"
            persistent-hint
            placeholder="MIL, LHR"
            density="compact"
            class="mb-3"
          />

          <div class="d-flex ga-4">
            <v-switch
              v-model="form.principale"
              :label="t('webcargo_key.form_primary')"
              true-value="S"
              false-value="N"
              color="primary"
              density="compact"
              hide-details
              inset
            />
            <v-switch
              v-model="form.b2b"
              label="B2B"
              true-value="S"
              false-value="N"
              color="primary"
              density="compact"
              hide-details
              inset
            />
          </div>
          <div v-if="form.principale === 'S'" class="text-caption text-medium-emphasis mt-2">
            {{ t('webcargo_key.primary_hint') }}
          </div>
        </v-card-text>
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
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiRefresh, mdiPencil, mdiDelete, mdiKey, mdiKeyRemove, mdiCheck, mdiClose,
} from '@mdi/js';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import {
  webcargoKeyService,
  type WebcargoKey,
  type WebcargoKeyPayload,
} from '../services/webcargoKey.service';

const { t } = useI18n();
const toast = useToastStore();

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const rows = ref<WebcargoKey[]>([]);

const dialog = ref(false);
const editing = ref<WebcargoKey | null>(null);
const form = ref<WebcargoKeyPayload>({});

/**
 * Puente entre el autocomplete y el payload.
 *
 * El control trabaja con `number | null`; el payload omite la clave cuando no
 * hay agente (`undefined`). Adaptarlo aquí evita cambiar el contrato que espera
 * el backend solo para acomodar al componente.
 */
const formAnagraficaId = computed<number | null>({
  get: () => form.value.id_anagrafica ?? null,
  set: (v) => {
    form.value.id_anagrafica = v ?? undefined;
  },
});
const terminalsInput = ref('');

function terminals(row: WebcargoKey): string {
  const out: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const v = row[`trm${i}` as keyof WebcargoKey];
    if (typeof v === 'string' && v.trim() !== '') out.push(v.trim());
  }
  return out.join(', ');
}

async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await webcargoKeyService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  form.value = { iso_paese: '', id_anagrafica: undefined, key1: '', key2: '', b2b: 'S', principale: 'N' };
  terminalsInput.value = '';
  dialog.value = true;
}

function openEdit(row: WebcargoKey): void {
  editing.value = row;
  // key1/key2 arrancan VACÍOS a propósito: el backend nunca los devuelve, y un
  // campo vacío al guardar significa "no lo cambies".
  form.value = {
    id: row.id,
    iso_paese: row.iso_paese,
    id_anagrafica: row.id_anagrafica,
    key1: '',
    key2: '',
    b2b: row.b2b,
    principale: row.principale,
  };
  terminalsInput.value = terminals(row);
  dialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: WebcargoKeyPayload = { ...form.value };

    if (payload.iso_paese) payload.iso_paese = payload.iso_paese.toUpperCase().trim();

    // La lista de terminales se reparte en trm1..trm10; los huecos se limpian
    // para que al quitar uno no quede el valor viejo colgando.
    const list = terminalsInput.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    for (let i = 1; i <= 10; i++) payload[`trm${i}`] = list[i - 1] ?? '';

    // Credencial vacía = conservar la guardada.
    if (!payload.key1) delete payload.key1;
    if (!payload.key2) delete payload.key2;

    if (editing.value) {
      await webcargoKeyService.update(payload);
      toast.success(t('webcargo_key.updated'));
    } else {
      await webcargoKeyService.create(payload);
      toast.success(t('webcargo_key.created'));
    }
    dialog.value = false;
    await reload();
  } catch (e) {
    // La validación vive en el backend: el mensaje del 400 es el motivo real.
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(row: WebcargoKey): Promise<void> {
  const msg = row.principale === 'S'
    ? t('webcargo_key.confirm_delete_primary', { country: row.iso_paese })
    : t('webcargo_key.confirm_delete', { country: row.iso_paese });
  if (!window.confirm(msg)) return;

  try {
    const { warning } = await webcargoKeyService.remove(row.id);
    if (warning) {
      // El aviso no es decorativo: sin cuenta principal, ese origen cotiza con
      // la de Italia y no salta ningún error.
      toast.info(warning);
    } else {
      toast.success(t('webcargo_key.deleted'));
    }
    await reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(reload);
</script>
