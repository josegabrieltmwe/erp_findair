<template>
  <div>
    <CmSectionHeader
      :title="t('sections.google_keys')"
      :subtitle="t('google_keys.subtitle')"
    >
      <template #actions>
        <v-select
          v-model="environment"
          :label="t('google_keys.environment')"
          :items="envOptions"
          density="compact"
          hide-details
          style="max-width: 200px"
          @update:model-value="load"
        />
      </template>
    </CmSectionHeader>

    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      :icon="mdiInformationOutline"
    >
      {{ t('google_keys.env_fallback_hint') }}
    </v-alert>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="false"
      :data="items"
      loading-type="skeleton"
      :skeleton-rows="5"
      :skeleton-cols="4"
      @clear-error="error = null"
    >
      <template #default>
        <v-card variant="outlined">
          <v-table density="compact">
            <thead>
              <tr>
                <th>{{ t('google_keys.col_key') }}</th>
                <th>{{ t('google_keys.col_status') }}</th>
                <th>{{ t('google_keys.col_value') }}</th>
                <th>{{ t('google_keys.col_updated') }}</th>
                <th class="text-right">{{ t('google_keys.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.key_name">
                <td>
                  <div class="font-weight-medium">{{ keyLabel(item.key_name) }}</div>
                  <div class="cm-mono text-caption text-medium-emphasis">
                    {{ item.key_name }}
                  </div>
                </td>
                <td>
                  <v-chip
                    size="small"
                    :class="item.has_value ? 'cm-tone-success' : 'cm-tone-neutral'"
                  >
                    {{ item.has_value ? t('google_keys.status_db') : t('google_keys.status_env') }}
                  </v-chip>
                </td>
                <td class="cm-mono">{{ item.has_value ? item.masked : '—' }}</td>
                <td class="text-caption">{{ item.modif_datetime || '—' }}</td>
                <td class="cm-actions-right">
                  <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item)">
                    {{ t('common.edit') }}
                  </v-btn>
                  <v-btn
                    v-if="item.has_value"
                    size="small"
                    variant="text"
                    color="error"
                    :prepend-icon="mdiDelete"
                    @click="openClear(item)"
                  >
                    {{ t('google_keys.action_clear') }}
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </template>
    </CmAsyncSection>

    <!-- Edit dialog -->
    <v-dialog v-model="formDialog" max-width="620" persistent>
      <v-card>
        <v-card-title>
          {{ t('google_keys.dialog_edit_title', { key: keyLabel(editKey) }) }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            {{ t('google_keys.dialog_edit_hint') }}
          </p>
          <v-text-field
            v-model="editValue"
            :label="t('google_keys.form_value')"
            type="password"
            :placeholder="editHasValue ? t('google_keys.placeholder_unchanged') : ''"
            autocomplete="new-password"
            :hint="t('google_keys.form_value_hint')"
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="formDialog = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!editValue" @click="save">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPencil, mdiDelete, mdiInformationOutline } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { googleKeysService, type GoogleKeyRow } from '../services/googleKeys.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<GoogleKeyRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const environment = ref('production');

const envOptions = [
  { title: 'production', value: 'production' },
  { title: 'sandbox', value: 'sandbox' },
];

const formDialog = ref(false);
const editKey = ref('');
const editValue = ref('');
const editHasValue = ref(false);

// Human-readable label per key_name; falls back to the raw name.
function keyLabel(keyName: string): string {
  const key = `google_keys.key_${keyName}`;
  const label = t(key);
  return label === key ? keyName : label;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await googleKeysService.list(environment.value);
    items.value = res.items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openEdit(item: GoogleKeyRow): void {
  editKey.value = item.key_name;
  editHasValue.value = item.has_value;
  editValue.value = '';
  formDialog.value = true;
}

async function save(): Promise<void> {
  if (!editValue.value) return;
  saving.value = true;
  try {
    items.value = await googleKeysService.save(editKey.value, editValue.value, environment.value);
    toast.success(t('google_keys.saved'));
    formDialog.value = false;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openClear(item: GoogleKeyRow): Promise<void> {
  const ok = await confirm.askDanger(
    t('google_keys.confirm_clear_message', { key: keyLabel(item.key_name) }),
    t('google_keys.confirm_clear_title'),
  );
  if (!ok) return;
  try {
    items.value = await googleKeysService.clear(item.key_name, environment.value);
    toast.success(t('google_keys.cleared'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void load();
});
</script>
