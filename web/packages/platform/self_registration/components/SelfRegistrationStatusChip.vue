<template>
  <v-chip size="small" variant="tonal" :color="color" :data-testid="`sr-status-${status}`">
    {{ t(`self_registration.status.${status}`) }}
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SelfRegistrationStatus } from '../services/selfRegistration.service';

const props = defineProps<{ status: SelfRegistrationStatus }>();
const { t } = useI18n();

const COLORS: Record<SelfRegistrationStatus, string> = {
  pending_verification: 'grey',
  verified: 'warning',
  approved: 'success',
  rejected: 'error',
  expired: 'grey',
  blocked_config: 'deep-orange',
};
const color = computed(() => COLORS[props.status] ?? 'grey');
</script>
