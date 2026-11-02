<template>
  <div>
    <CmSectionHeader
      :title="isAdmin ? t('pay_gateways.title_admin') : t('pay_gateways.title')"
      :subtitle="isAdmin ? t('pay_gateways.subtitle_admin') : t('pay_gateways.subtitle')"
    />

    <v-card v-if="isAdmin" class="pa-4 mb-4" variant="outlined">
      <CmAnagraficaAutocomplete v-model="partnerId" :label="t('pay_gateways.filter_partner')" />
    </v-card>

    <PayGatewayAccountsPanel :scope="scope" :partner-id="partnerId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import PayGatewayAccountsPanel from './PayGatewayAccountsPanel.vue';

/** Pantalla de Settings. `self`: el partner gestiona sus cuentas; `admin`: TMWE, solo lectura, con selector de partner. */
const props = defineProps<{ scope: 'self' | 'admin' }>();
const { t } = useI18n();
const isAdmin = computed(() => props.scope === 'admin');
const partnerId = ref<number | null>(null);
</script>
