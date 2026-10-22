<template>
  <div>
    <v-tabs :model-value="active" class="mb-4" @update:model-value="select">
      <v-tab value="sync">{{ t('elevenlabs_agents_admin.tab_sync') }}</v-tab>
      <v-tab value="review">{{ t('elevenlabs_agents_admin.tab_review') }}</v-tab>
    </v-tabs>
    <v-window :model-value="active" :touch="false">
      <v-window-item value="sync"><ElevenlabsAgentSyncPage /></v-window-item>
      <v-window-item value="review"><ElevenlabsAgentReviewPage /></v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
/**
 * Agentes de voz para el administrador de TMWE: sincronizar el agente real y
 * revisar/aprobar los agentes de los partners. Solo envuelve las dos pantallas
 * existentes; el flujo de aprobación y los datos no cambian. El agente propio del
 * partner sigue en su ruta (otro rol, protegida por RBAC y no por is_admin).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { resolveAgentAdminTab } from '../agentAdminTabs';
import ElevenlabsAgentSyncPage from '../../elevenlabs_agent_sync/feature/ElevenlabsAgentSyncPage.vue';
import ElevenlabsAgentReviewPage from './ElevenlabsAgentReviewPage.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const active = computed(() => resolveAgentAdminTab(route.query.tab));

function select(tab: unknown) {
  void router.replace({ query: { ...route.query, tab: String(tab) } });
}
</script>
