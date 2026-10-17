<template>
  <v-dialog :model-value="modelValue" max-width="620" @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>{{ t('price_lists.alert_title') }} — {{ typeLabel }}</v-card-title>
      <v-card-text>
        <CmAsyncSection :loading="loading" :error="error" :empty="false" :data="lines" @clear-error="error = null">
          <template #default>
            <p v-for="(l, i) in lines" :key="i" class="mb-1">{{ l }}</p>
            <div v-if="isAdmin && zones.length > 0" class="mt-3">
              <v-btn size="small" color="error" variant="outlined" :loading="busy" @click="removeZones">
                {{ t('price_lists.alert_delete_zones', { zones: zones.join(', ') }) }}
              </v-btn>
              <div class="cm-cell-hint mt-1">{{ t('price_lists.alert_delete_hint') }}</div>
            </div>
          </template>
        </CmAsyncSection>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="isAdmin && !loading && !error" variant="text" :loading="busy" @click="clear">
          {{ t('price_lists.alert_clear') }}
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="emit('update:modelValue', false)">{{ t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Aviso de un pack (zonas, precios o API). Paridad listy_probl_ajax /
 * listy_probl_reset / listy_probl_delzn. Limpiar y retirar zonas: solo TMWE.
 */
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import CmAsyncSection from '@shared/anagrafiche/components/CmAsyncSection.vue';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import { useConfirm } from '@shared/anagrafiche/composables/useConfirm';
import { useListiniAdmin } from '../composables/useListiniAdmin';
import { listiniService, type AlertType } from '../services/listini.service';

const props = defineProps<{ modelValue: boolean; packId: number | null; tp: AlertType }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; changed: [] }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();
const { isAdmin } = useListiniAdmin();

const loading = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const lines = ref<string[]>([]);
const zones = ref<string[]>([]);

const typeLabel = computed(() =>
  t(props.tp === '_zn' ? 'price_lists.alert_zones' : props.tp === '_prz' ? 'price_lists.alert_prices' : 'price_lists.alert_api'),
);

async function load(): Promise<void> {
  if (!props.packId) return;
  loading.value = true;
  error.value = null;
  try {
    const a = await listiniService.problemAlert(props.packId, props.tp);
    // El texto del legacy lleva <br>: se separa en lineas y se muestra como texto plano.
    lines.value = a.message
      .split(/<br\s*\/?>/i)
      .map((l) => l.replace(/<[^>]*>/g, '').trim())
      .filter(Boolean);
    zones.value = a.delete_zones;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function clear(): Promise<void> {
  if (!props.packId) return;
  busy.value = true;
  try {
    await listiniService.problemReset(props.packId, props.tp);
    toast.success(t('price_lists.alert_cleared'));
    emit('changed');
    emit('update:modelValue', false);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
  }
}

async function removeZones(): Promise<void> {
  if (!props.packId) return;
  const ok = await confirm.askDanger(
    t('price_lists.alert_delete_confirm', { zones: zones.value.join(', ') }),
    t('price_lists.alert_title'),
  );
  if (!ok) return;
  busy.value = true;
  try {
    const n = await listiniService.problemDeleteZones(props.packId, zones.value);
    toast.success(t('price_lists.alert_zones_removed', { n }));
    emit('changed');
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
  }
}

watch(() => [props.modelValue, props.packId, props.tp] as const, ([open]) => open && load());
</script>
