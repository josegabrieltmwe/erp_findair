<template>
  <!--
    Tarjeta de credenciales "shown once" reutilizable. Muestra loginn (opcional)
    y password en codeboxes con botón de copiar, dentro de un card de aviso.
    Centraliza el patrón duplicado en UserCreateDialog y ResetPasswordDialog y
    lo reutiliza en la sección Contatti (creación de contacto).
  -->
  <v-card variant="outlined" color="error" class="pa-4 crc-card">
    <p class="crc-warn mb-3">{{ t('users.credentials_warn') }}</p>
    <div v-if="loginn" class="crc-row">
      <span class="crc-label">{{ t('users.field_login') }}</span>
      <code class="crc-value">{{ loginn }}</code>
      <v-btn
        :icon="mdiContentCopy"
        size="x-small"
        variant="text"
        :title="t('common.copy')"
        @click="copy(loginn)"
      />
    </div>
    <div class="crc-row">
      <span class="crc-label">{{ t('users.field_password') }}</span>
      <code class="crc-value">{{ password }}</code>
      <v-btn
        :icon="mdiContentCopy"
        size="x-small"
        variant="text"
        :title="t('common.copy')"
        @click="copy(password)"
      />
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { mdiContentCopy } from '@mdi/js';
import { useToast } from '../composables/useToast';

defineProps<{
  /** Login del usuario; omitir cuando solo se revela password (reset). */
  loginn?: string | null;
  password: string;
}>();

const { t } = useI18n();
const toast = useToast();

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t('common.copied'));
  } catch {
    toast.error(t('common.copy_failed'));
  }
}
</script>

<style scoped>
.crc-warn {
  font-size: 0.85em;
  color: var(--cm-text-secondary);
}
.crc-row {
  display: flex;
  align-items: center;
  gap: var(--cm-space-sm);
  padding: var(--cm-space-xs) 0;
}
.crc-label {
  min-width: 90px;
  font-size: 0.85em;
  color: var(--cm-text-muted);
}
.crc-value {
  flex: 1;
  font-family: var(--cm-font-mono, monospace);
  background: rgba(0, 0, 0, 0.04);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  word-break: break-all;
}
</style>
