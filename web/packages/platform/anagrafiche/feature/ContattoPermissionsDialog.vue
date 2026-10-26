<template>
  <v-dialog :model-value="modelValue" max-width="720" persistent @update:model-value="onClose">
    <v-card>
      <v-card-title>Permessi — {{ contatto?.nome }}</v-card-title>
      <v-card-text>
        <!-- Auth flags vía el editor compartido (capabilities tipadas, i18n,
             tooltips, dirty-tracking) — ya no se hardcodean las claves auth_*.
             El backend filtra auth_10..16 para partners (WS2.5). -->
        <AuthFlagsEditor v-model="authFlags" />

        <v-divider class="my-4" />

        <!-- Login por aplicación (app móvil / ERP-app). Paridad legacy
             contatti.erp_login_app / b2b_login_app — antes no editables en la UI
             moderna. Son enum('S','N'). -->
        <p class="text-caption mb-2">{{ t('anagrafiche.perm.app_access') }}</p>
        <div class="cm-perm-grid mb-2">
          <v-switch
            v-model="appAccess.erp_login_app"
            :label="t('anagrafiche.perm.erp_login_app')"
            density="compact" hide-details color="primary"
            true-value="S" false-value="N"
          />
          <v-switch
            v-model="appAccess.b2b_login_app"
            :label="t('anagrafiche.perm.b2b_login_app')"
            density="compact" hide-details color="primary"
            true-value="S" false-value="N"
          />
        </div>

        <!-- Roles RBAC internos: SOLO TMWE (endpoint admin_only). Permite dar a
             un contatto creado desde la ficha de anagrafica el mismo rol que el
             flujo admin_config → Users, para que pueda "trabajar" en el sistema. -->
        <template v-if="isTmwe">
          <v-divider class="my-4" />
          <p class="text-caption mb-2">{{ t('anagrafiche.perm.roles') }}</p>
          <v-autocomplete
            v-model="selectedRoleIds"
            :items="roleItems"
            :loading="loadingRoles"
            :label="t('anagrafiche.perm.roles_label')"
            item-title="title"
            item-value="value"
            multiple
            chips
            closable-chips
            density="compact"
            variant="outlined"
          />
        </template>

        <v-divider class="my-4" />

        <!-- Rol API (contatti_oauth_role), solo lectura: se cambia desde la
             columna Findair del listado o desde la ficha de usuario. -->
        <p class="text-caption mb-2">{{ t('anagrafiche.findair.api_role') }}</p>
        <div class="cm-api-role-row mb-2">
          <v-progress-circular v-if="apiRoleLoading" indeterminate size="16" width="2" />
          <template v-else>
            <v-chip
              size="small"
              variant="tonal"
              :color="apiRole?.role_id ? 'primary' : 'grey'"
            >
              <span class="cm-mono">{{ apiRole?.role_name || t('anagrafiche.findair.no_role') }}</span>
            </v-chip>
            <!-- Aditivos: editables solo si el servidor dice que el llamante puede conceder alguno a este contacto
                 (un administrador de cuenta con profile:write o el personal de TMWE). -->
            <ContactAddonRoles
              v-if="apiRole && (apiRole.addon_role_details.length || apiRole.grantable_roles.some((r) => r.addon))"
              :contatto-id="contatto?.id as number"
              :state="apiRole"
              @updated="apiRole = $event"
            />
            <RouterLink v-if="userDetailRoute" :to="userDetailRoute" class="cm-api-role-link">
              {{ t('anagrafiche.findair.manage_in_user') }}
            </RouterLink>
          </template>
        </div>

        <v-divider class="my-4" />

        <!-- Notificaciones: no son auth flags del catálogo, se editan aparte. -->
        <p class="text-caption mb-2">{{ t('anagrafiche.notifications') }}</p>
        <div class="cm-perm-grid">
          <v-checkbox
            v-for="key in alertKeys"
            :key="key"
            v-model="alerts[key]"
            :label="key"
            density="compact"
            hide-details
            true-value="S"
            false-value="N"
          />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onClose">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="onSave">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router';
import type { ContattoRow } from '../services/anagrafica.service';
import { contattiService, type ApiRoleState } from '../services/contatti.service';
import ContactAddonRoles from '../../users/components/ContactAddonRoles.vue';
import { contactRolesService } from '../services/contactRoles.service';
import { useAnagraficaContext } from '../composables/useAnagraficaContext';
import { useToast } from '../composables/useToast';
import AuthFlagsEditor from '../components/AuthFlagsEditor.vue';

const props = defineProps<{ modelValue: boolean; contatto: ContattoRow | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>();
const { t } = useI18n();
const toast = useToast();
const { isTmwe } = useAnagraficaContext();
const router = useRouter();

const saving = ref(false);

// Rol API actual (solo lectura). El enlace a la ficha de usuario solo si el
// host tiene esa ruta (operations: `user-detail`) y el operador es TMWE.
const apiRole = ref<ApiRoleState | null>(null);
const apiRoleLoading = ref(false);
const userDetailRoute = computed<RouteLocationRaw | null>(() => {
  const id = props.contatto?.id;
  if (!isTmwe.value || !id || !router?.hasRoute('user-detail')) return null;
  return { name: 'user-detail', params: { id: String(id) } };
});

async function loadApiRole(contattoId: number): Promise<void> {
  apiRoleLoading.value = true;
  try {
    apiRole.value = await contattiService.getApiRole(contattoId);
  } catch {
    apiRole.value = null;
  } finally {
    apiRoleLoading.value = false;
  }
}
const authFlags = ref<Record<string, 'S' | 'N'>>({});
const alerts = ref<Record<string, string>>({});
// Login por app (enum S/N) — antes no editables en la UI moderna.
const appAccess = ref<Record<'erp_login_app' | 'b2b_login_app', 'S' | 'N'>>({
  erp_login_app: 'N',
  b2b_login_app: 'N',
});

// Roles RBAC (solo TMWE). selectedRoleIds se compara con el estado original para
// guardar solo si cambió (evita POST admin_only innecesarios).
const roleItems = ref<{ title: string; value: number }[]>([]);
const selectedRoleIds = ref<number[]>([]);
const originalRoleIds = ref<number[]>([]);
const loadingRoles = ref(false);
let rolesLoaded = false;

async function loadRolesContext(contattoId: number): Promise<void> {
  loadingRoles.value = true;
  try {
    if (!rolesLoaded) {
      const roles = await contactRolesService.listRoles();
      roleItems.value = roles.map((r) => ({ title: r.name ?? r.slug ?? `#${r.id}`, value: r.id }));
      rolesLoaded = true;
    }
    const assigned = await contactRolesService.getAssignedRoleIds(contattoId);
    selectedRoleIds.value = [...assigned];
    originalRoleIds.value = [...assigned];
  } catch {
    roleItems.value = [];
    selectedRoleIds.value = [];
    originalRoleIds.value = [];
  } finally {
    loadingRoles.value = false;
  }
}

function rolesChanged(): boolean {
  const a = [...selectedRoleIds.value].sort();
  const b = [...originalRoleIds.value].sort();
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

// auth_* gestionados por AuthFlagsEditor (catálogo). Notificaciones aparte.
const authKeys = ['auth_10', 'auth_11', 'auth_12', 'auth_13', 'auth_14', 'auth_15', 'auth_16',
  'auth_17', 'auth_18', 'auth_19', 'auth_20', 'auth_21', 'auth_22', 'auth_23', 'auth_24'];
const alertKeys = ['alert_mail', 'alert_sms', 'alert_fax', 'delivered_mail', 'delivered_sms',
  'commerc_mail', 'commerc_fax', 'contab_mail', 'contab_fax', 'offerte_mail', 'nel_calendario'];

watch(() => props.modelValue, (v) => {
  if (!v || !props.contatto) return;
  const row = props.contatto as unknown as Record<string, string>;
  const af: Record<string, 'S' | 'N'> = {};
  for (const k of authKeys) af[k] = row[k] === 'S' ? 'S' : 'N';
  authFlags.value = af;
  const al: Record<string, string> = {};
  for (const k of alertKeys) al[k] = row[k] ?? 'N';
  alerts.value = al;
  appAccess.value = {
    erp_login_app: row.erp_login_app === 'S' ? 'S' : 'N',
    b2b_login_app: row.b2b_login_app === 'S' ? 'S' : 'N',
  };
  if (isTmwe.value && props.contatto.id) void loadRolesContext(props.contatto.id);
  apiRole.value = null;
  if (props.contatto.id) void loadApiRole(props.contatto.id);
});

function onClose(): void {
  emit('update:modelValue', false);
}

async function onSave(): Promise<void> {
  if (!props.contatto) return;
  saving.value = true;
  try {
    // Combinar auth flags (editor) + login por app + notificaciones en un
    // solo update de permisos del contatto.
    await contattiService.updatePermissions(props.contatto.id, {
      ...authFlags.value,
      ...appAccess.value,
      ...alerts.value,
    });
    // Roles RBAC (solo TMWE): endpoint admin_only aparte; solo si cambió.
    if (isTmwe.value && rolesChanged()) {
      await contactRolesService.replaceRoles(props.contatto.id, selectedRoleIds.value);
      originalRoleIds.value = [...selectedRoleIds.value];
    }
    toast.success(t('anagrafiche.updated'));
    emit('saved');
    onClose();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.cm-api-role-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 28px;
}
.cm-api-role-link {
  font-size: 0.8em;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.cm-api-role-link:hover {
  text-decoration: underline;
}
.cm-perm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 4px 12px;
}
</style>
