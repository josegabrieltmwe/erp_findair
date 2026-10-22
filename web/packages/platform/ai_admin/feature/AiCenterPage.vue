<template>
  <div>
    <CmSectionHeader :title="t('ai_admin.center.title')" :subtitle="t('ai_admin.center.subtitle')" />
    <v-alert v-if="loaded && visible.length === 0" type="info" variant="tonal">{{ t('ai_admin.center.no_access') }}</v-alert>
    <template v-else-if="active">
      <v-tabs :model-value="active" class="mb-4" show-arrows @update:model-value="select">
        <v-tab v-for="k in visible" :key="k" :value="k">{{ t('ai_admin.center.tab_' + k) }}</v-tab>
      </v-tabs>
      <v-window :model-value="active" :touch="false">
        <v-window-item v-for="k in visible" :key="k" :value="k" :eager="k === 'health'">
          <AiUsagePanel v-if="k === 'usage'" />
          <AiBudgetsPage v-else-if="k === 'budgets'" />
          <AiFlagsPage v-else-if="k === 'flags'" />
          <AiAuditPage v-else-if="k === 'audit'" />
          <VoiceMemoryPage v-else-if="k === 'memory'" />
          <ElevenlabsHealthPanel v-else-if="k === 'health'" />
          <MyAiUsagePage v-else-if="k === 'mine'" />
        </v-window-item>
      </v-window>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import AiUsagePanel from '../components/AiUsagePanel.vue';
import ElevenlabsHealthPanel from '../components/ElevenlabsHealthPanel.vue';
import { resolveAiTab, visibleAiTabs, type AiCenterTab } from '../composables/useAiScopes';
import { useProfile } from '../../composables/useProfile';
import AiBudgetsPage from './AiBudgetsPage.vue';
import AiFlagsPage from './AiFlagsPage.vue';
import AiAuditPage from './AiAuditPage.vue';
import VoiceMemoryPage from './VoiceMemoryPage.vue';
import MyAiUsagePage from './MyAiUsagePage.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { profile, isAdmin, ensureProfile } = useProfile();

const loaded = ref(false);
const visible = computed(() => visibleAiTabs(profile.value, isAdmin.value));
const active = computed<AiCenterTab | null>(() => resolveAiTab(route.query.tab, visible.value));

function select(tab: unknown) {
  void router.replace({ query: { ...route.query, tab: String(tab) } });
}

onMounted(async () => {
  await ensureProfile();
  loaded.value = true;
});
</script>
