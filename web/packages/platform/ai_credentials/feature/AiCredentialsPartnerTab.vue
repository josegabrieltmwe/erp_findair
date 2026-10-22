<template>
  <div>
    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="llm">{{ t('ai_credentials.tab_llm') }}</v-tab>
      <v-tab value="voice">{{ t('ai_credentials.tab_voice') }}</v-tab>
    </v-tabs>
    <v-window v-model="tab" :touch="false">
      <v-window-item value="llm"><AiCredentialsPage :id-anagrafica="idAnagrafica" /></v-window-item>
      <v-window-item value="voice"><ElevenlabsCredentialsPartnerTab :id-anagrafica="idAnagrafica" /></v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
/** Copia de la ficha de anagrafica de las credenciales de IA: pestañas LLM y Voz. */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CredentialTab } from '../credentialTabs';
import AiCredentialsPage from './AiCredentialsPage.vue';
import ElevenlabsCredentialsPartnerTab from '../../elevenlabs_credentials/feature/ElevenlabsCredentialsPartnerTab.vue';

defineProps<{ idAnagrafica: number }>();
const { t } = useI18n();
const tab = ref<CredentialTab>('llm');
</script>
