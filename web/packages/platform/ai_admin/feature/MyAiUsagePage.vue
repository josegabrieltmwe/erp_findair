<template>
  <div>
    <CmSectionHeader :title="t('ai_admin.mine.title')" :subtitle="t('ai_admin.mine.subtitle')" />
    <AiUsagePanel own />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import AiUsagePanel from '../components/AiUsagePanel.vue';

const { t } = useI18n();
</script>
