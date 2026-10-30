<template>
  <div>
    <CmSectionHeader
      :title="isAdmin ? t('partner_smtp.title_admin') : t('partner_smtp.title')"
      :subtitle="isAdmin ? t('partner_smtp.subtitle_admin') : t('partner_smtp.subtitle')"
    />

    <v-card v-if="isAdmin" class="pa-4 mb-4" variant="outlined">
      <CmAnagraficaAutocomplete v-model="partnerId" :label="t('partner_smtp.filter_partner')" />
    </v-card>

    <PartnerSmtpAccountsPanel :scope="scope" :partner-id="partnerId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import PartnerSmtpAccountsPanel from './PartnerSmtpAccountsPanel.vue';

/** Pantalla de Settings. `self`: el administrador del partner; `admin`: TMWE con selector de partner. */
const props = defineProps<{ scope: 'self' | 'admin' }>();
const { t } = useI18n();
const isAdmin = computed(() => props.scope === 'admin');
const partnerId = ref<number | null>(null);
</script>
