<template>
  <div>
    <CmSectionHeader :title="t('ai_admin.center.title')" :subtitle="t('ai_admin.center.subtitle')" />
    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="usage">{{ t('ai_admin.center.tab_usage') }}</v-tab>
      <v-tab value="health">{{ t('ai_admin.center.tab_health') }}</v-tab>
    </v-tabs>
    <v-window v-model="tab">
      <v-window-item value="usage"><AiUsagePanel /></v-window-item>
      <v-window-item value="health" eager><ElevenlabsHealthPanel /></v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import AiUsagePanel from '../components/AiUsagePanel.vue';
import ElevenlabsHealthPanel from '../components/ElevenlabsHealthPanel.vue';

const { t } = useI18n();
const tab = ref('usage');
</script>
