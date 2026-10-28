<template>
  <div>
    <v-alert type="info" density="compact" class="mb-4">{{ t('partner_smtp.partner_tab_hint') }}</v-alert>
    <PartnerSmtpAccountsPanel scope="admin" :partner-id="idAnagrafica" />
  </div>
</template>

<script setup lang="ts">
/** Pestaña de la ficha de anagrafica: las cuentas SMTP de ESTE partner (administración de TMWE). */
import { useI18n } from 'vue-i18n';
import PartnerSmtpAccountsPanel from './PartnerSmtpAccountsPanel.vue';

defineProps<{ idAnagrafica: number }>();
const { t } = useI18n();
</script>
