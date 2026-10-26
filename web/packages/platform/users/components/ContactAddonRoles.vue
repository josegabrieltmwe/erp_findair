<template>
  <div class="car-root">
    <div class="car-chips">
      <v-chip
        v-for="r in assigned"
        :key="r.id"
        size="small"
        variant="tonal"
        color="primary"
        :closable="editable && canRevoke(r)"
        :disabled="saving"
        :data-testid="`addon-chip-${r.name}`"
        @click:close="revoke(r)"
      >
        <span class="cm-mono">{{ r.display_name }}</span>
      </v-chip>
      <span v-if="!assigned.length" class="cm-cell-hint">{{ t('users.security.addon_none') }}</span>
    </div>

    <div v-if="editable && options.length" class="car-add">
      <v-select
        v-model="selectedId"
        :items="options"
        item-title="display_name"
        item-value="id"
        :label="t('users.security.addon_add_label')"
        :disabled="saving"
        clearable
        class="car-select"
      />
      <v-btn color="primary" variant="flat" size="small" :loading="saving" :disabled="!selectedId" @click="add">
        {{ t('users.security.addon_add') }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Roles ADITIVOS de un contacto (se suman al rol base: la unión de sus scopes es lo que cuenta). Solo ofrece los roles
 * que el servidor dice que el llamante puede conceder a ese contacto (`grantable_roles`), así que nunca propone una
 * asignación que vaya a rechazar. Cada alta/baja es una llamada propia: no toca el rol base.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { roleConflictMessage } from '../../oauth_roles/services/oauthRoles.service';
import { contattiService, type ApiRoleState, type RoleSummary } from '../../anagrafiche/services/contatti.service';

const props = withDefaults(defineProps<{ contattoId: number; state: ApiRoleState | null; editable?: boolean }>(), { editable: true });
const emit = defineEmits<{ updated: [ApiRoleState] }>();

const { t } = useI18n();
const toast = useToastStore();
const saving = ref(false);
const selectedId = ref<number | null>(null);

const assigned = computed<RoleSummary[]>(() => props.state?.addon_role_details ?? []);
const grantableIds = computed(() => new Set((props.state?.grantable_roles ?? []).map((r) => r.id)));
const options = computed<RoleSummary[]>(() => {
  const have = new Set(assigned.value.map((r) => r.id));
  return (props.state?.grantable_roles ?? []).filter((r) => r.addon && !have.has(r.id));
});
/** Solo se puede retirar lo que se podría conceder: la política es la misma en ambos sentidos. */
const canRevoke = (r: RoleSummary): boolean => grantableIds.value.has(r.id);

async function apply(roleId: number, enabled: boolean): Promise<void> {
  saving.value = true;
  try {
    const next = await contattiService.setAddonRole(props.contattoId, roleId, enabled);
    emit('updated', next);
    selectedId.value = null;
    toast.success(t(enabled ? 'users.security.addon_added' : 'users.security.addon_removed'));
  } catch (e) {
    toast.error(roleConflictMessage(e, 'ROLE_NOT_GRANTABLE') ?? (e instanceof Error ? e.message : t('users.security.addon_failed')));
  } finally {
    saving.value = false;
  }
}

const add = (): Promise<void> => (selectedId.value ? apply(selectedId.value, true) : Promise.resolve());
const revoke = (r: RoleSummary): Promise<void> => apply(r.id, false);
</script>

<style scoped>
.car-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--cm-space-sm, 8px);
  align-items: center;
  margin-bottom: var(--cm-space-sm, 8px);
}
.car-add {
  display: flex;
  gap: var(--cm-space-md, 12px);
  align-items: flex-start;
}
.car-select {
  max-width: 320px;
}
</style>
