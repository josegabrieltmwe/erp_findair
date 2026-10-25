<template>
  <div class="cm-roles-editor">
    <v-progress-circular v-if="loading" indeterminate size="16" width="2" />
    <template v-else-if="state">
      <div v-if="!addonsOnly" class="cm-roles-row">
        <span class="text-caption">{{ t('anagrafiche.findair.base_role') }}</span>
        <v-chip size="small" variant="tonal" :color="state.role_id ? 'primary' : 'grey'">
          <span class="cm-mono">{{ state.role_name || t('anagrafiche.findair.no_role') }}</span>
        </v-chip>
        <v-select
          v-if="options.baseChoices.length"
          :model-value="state.role_id"
          :items="options.baseChoices"
          item-title="display_name"
          item-value="id"
          :label="t('anagrafiche.findair.change_base_role')"
          density="compact"
          variant="outlined"
          hide-details
          :disabled="busy"
          class="cm-roles-select"
          @update:model-value="changeBase"
        />
      </div>

      <div class="cm-roles-row">
        <span class="text-caption">{{ t('anagrafiche.findair.addon_roles') }}</span>
        <v-chip
          v-for="r in options.held"
          :key="r.id"
          size="small"
          variant="tonal"
          :closable="r.removable"
          :disabled="busy"
          @click:close="remove(r)"
        >
          <span class="cm-mono" :title="r.name">{{ r.display_name }}</span>
        </v-chip>
        <span v-if="!options.held.length" class="text-caption text-medium-emphasis">
          {{ t('anagrafiche.findair.no_addon_roles') }}
        </span>
      </div>

      <v-select
        v-if="options.addable.length"
        :model-value="null"
        :items="options.addable"
        item-title="display_name"
        item-value="id"
        :label="t('anagrafiche.findair.add_addon_role')"
        density="compact"
        variant="outlined"
        hide-details
        :disabled="busy"
        class="cm-roles-select mt-2"
        @update:model-value="add"
      />
      <p v-if="!options.canEdit" class="text-caption text-medium-emphasis mt-1 mb-0">
        {{ t('anagrafiche.findair.roles_read_only') }}
      </p>
    </template>
    <p v-else class="text-caption text-medium-emphasis mb-0">{{ t('anagrafiche.findair.roles_unavailable') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { contattiService, type ApiRoleRef, type ApiRoleState } from '../services/contatti.service';
import { apiRoleOptions } from '../services/apiRoleOptions';
import { useToast } from '../composables/useToast';
import { useConfirm } from '../composables/useConfirm';

/**
 * Roles API de un contacto (rol base + aditivos). Ofrece solo lo que el API dice que quien mira puede conceder
 * (`grantable_roles`), de modo que la política vive en el servidor y no se duplica aquí. Cada cambio se aplica
 * al momento (no espera al «Guardar» del diálogo que lo contenga) y avisa con `changed`.
 */
const props = defineProps<{ contattoId: number; addonsOnly?: boolean }>();
const emit = defineEmits<{ changed: [state: ApiRoleState] }>();

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const state = ref<ApiRoleState | null>(null);
const loading = ref(false);
const busy = ref(false);
const options = computed(() => apiRoleOptions(state.value));

async function load(): Promise<void> {
  if (!props.contattoId) return;
  loading.value = true;
  try {
    state.value = await contattiService.getApiRole(props.contattoId);
  } catch {
    state.value = null;
  } finally {
    loading.value = false;
  }
}

async function apply(run: () => Promise<ApiRoleState>, okMessage: string): Promise<void> {
  busy.value = true;
  try {
    state.value = await run();
    toast.success(okMessage);
    emit('changed', state.value);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
    await load();
  } finally {
    busy.value = false;
  }
}

async function add(roleId: number | null): Promise<void> {
  if (!roleId) return;
  await apply(() => contattiService.setAddonRole(props.contattoId, roleId, true), t('anagrafiche.findair.role_added') as string);
}

async function remove(role: ApiRoleRef): Promise<void> {
  const ok = await confirm.askDanger(
    t('anagrafiche.findair.confirm_remove_role', { role: role.display_name }) as string,
    t('anagrafiche.findair.confirm_remove_role_title') as string,
  );
  if (!ok) return;
  await apply(() => contattiService.setAddonRole(props.contattoId, role.id, false), t('anagrafiche.findair.role_removed') as string);
}

async function changeBase(roleId: number | null): Promise<void> {
  if (!roleId || roleId === state.value?.role_id) return;
  await apply(() => contattiService.setApiRole(props.contattoId, roleId), t('anagrafiche.findair.role_changed_base') as string);
}

watch(() => props.contattoId, load, { immediate: true });
</script>

<style scoped>
.cm-roles-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 8px;
}
.cm-roles-select {
  max-width: 280px;
}
</style>
