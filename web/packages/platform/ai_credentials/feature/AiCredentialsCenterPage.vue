<template>
  <AiCredentialsPage v-if="own" own />
  <div v-else>
    <v-tabs :model-value="active" class="mb-4" @update:model-value="select">
      <v-tab value="llm">{{ t('ai_credentials.tab_llm') }}</v-tab>
      <v-tab value="voice">{{ t('ai_credentials.tab_voice') }}</v-tab>
    </v-tabs>
    <v-window :model-value="active" :touch="false">
      <v-window-item value="llm"><AiCredentialsPage /></v-window-item>
      <v-window-item value="voice"><ElevenlabsCredentialsPage /></v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { resolveCredentialTab } from '../credentialTabs';
import { useListiniAdmin } from '../../listini/composables/useListiniAdmin';
import AiCredentialsPage from './AiCredentialsPage.vue';
import ElevenlabsCredentialsPage from '../../elevenlabs_credentials/feature/ElevenlabsCredentialsPage.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const active = computed(() => resolveCredentialTab(route.query.tab));
// Un administrador de partner (no TMWE) gestiona SOLO su clave de LLM: sin pestaña de voz ni selector de
// partner. Misma señal que el resto del ERP para distinguir TMWE: el bootstrap de la sesión del BFF.
const { isAdmin: isTmwe } = useListiniAdmin();
const own = computed(() => !isTmwe.value);

function select(tab: unknown) {
  void router.replace({ query: { ...route.query, tab: String(tab) } });
}
</script>
