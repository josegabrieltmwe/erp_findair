<template>
  <div class="cm-partner-result">
    <v-alert type="success" variant="tonal" density="compact" class="mb-3">
      {{ t('anagrafiche.created_named', { name: created.rag_soc || String(created.id) }) }}
    </v-alert>

    <h3 class="text-subtitle-1 mb-1">{{ t('anagrafiche.admin_contact.result_title') }}</h3>
    <p class="mb-3">
      <span class="font-weight-medium">{{ adminContact.nome }}</span>
      <span class="text-medium-emphasis"> · {{ adminContact.mail }}</span>
    </p>

    <v-alert v-if="linkSent" type="success" variant="tonal" density="compact" class="mb-3">
      {{
        sentTo
          ? t('anagrafiche.access_link.sent_to', { mail: sentTo })
          : t('anagrafiche.access_link.sent_creation', { mail: adminContact.mail })
      }}
    </v-alert>
    <v-alert v-else type="warning" variant="tonal" density="compact" class="mb-3">
      {{ t('anagrafiche.access_link.not_sent') }}
      <div v-if="errorMessage" class="mt-1">{{ errorMessage }}</div>
      <template v-if="contactId" #append>
        <v-btn variant="outlined" size="small" :loading="sending" :disabled="sending" @click="resend">
          {{ t('anagrafiche.access_link.resend') }}
        </v-btn>
      </template>
    </v-alert>

    <div class="cm-form-actions">
      <v-btn color="primary" @click="emit('open', created.id)">
        {{ t('anagrafiche.admin_contact.open_record') }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AnagraficaCreated } from '../services/anagrafica.service';
import { contattiService } from '../services/contatti.service';
import { accessLinkErrorText } from '../utils/accessLink';

const props = defineProps<{
  created: AnagraficaCreated;
  adminContact: { nome: string; mail: string };
}>();
const emit = defineEmits<{ open: [id: number] }>();
const { t, te } = useI18n();

const sending = ref(false);
const resentOk = ref(false);
const sentTo = ref<string | null>(null);
const errorMessage = ref('');

/** Contacto administrador creado por el alta (único en un partner). */
const contactId = computed(() => props.created.created_ids?.contatti?.[0] ?? 0);
const linkSent = computed(() => resentOk.value || props.created.access_link_sent === true);

async function resend(): Promise<void> {
  if (sending.value || !contactId.value) return;
  sending.value = true;
  errorMessage.value = '';
  try {
    const res = await contattiService.sendAccessLink(contactId.value);
    sentTo.value = res.sent_to;
    resentOk.value = res.access_link_sent;
  } catch (e) {
    errorMessage.value = accessLinkErrorText(e, { t: (k, n) => t(k, n ?? {}) as string, te });
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.cm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--cm-space-sm, 8px);
  margin-top: var(--cm-space-md, 16px);
}
</style>
