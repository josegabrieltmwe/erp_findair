<template>
  <v-snackbar-queue
    v-model="queue"
    location="bottom right"
    multi-line
    :timeout="-1"
  >
    <template #default="{ item }">
      <v-alert
        :type="(item as Toast).kind"
        variant="tonal"
        density="compact"
        closable
        @click:close="toastStore.dismiss((item as Toast).id)"
      >
        {{ (item as Toast).message }}
      </v-alert>
    </template>
  </v-snackbar-queue>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import {
  useToastStore,
  type Toast,
} from "@shared/anagrafiche/stores/toast.store";
import { onHttpEvent } from "@shared/anagrafiche/services/http";
import { useI18n } from "vue-i18n";

const toastStore = useToastStore();
const { t } = useI18n();

// Vuetify's v-snackbar-queue uses v-model for the queue array directly.
// Declared as a writable computed to satisfy its expected interface.
const queue = computed<Toast[]>({
  get: () => toastStore.toasts,
  set: () => {
    /* mutations come exclusively through toastStore actions */
  },
});

// Bridge HTTP layer events → toasts.
onMounted(() => {
  onHttpEvent((ev, payload) => {
    if (ev === "rate-limit") toastStore.warning(t("errors.rateLimit"));
    else if (ev === "forbidden")
      toastStore.error(humanMessage(extract(payload)) || t("errors.forbidden"));
    else if (ev === "server-error")
      toastStore.error(extract(payload) || t("errors.server"));
  });
});

// Los codigos de maquina (p. ej. `not_a_partner`) no son texto para el usuario.
function humanMessage(msg: string | null): string | null {
  return msg && /^[a-z0-9_]+$/.test(msg) ? null : msg;
}

function extract(payload: unknown): string | null {
  if (payload && typeof payload === "object") {
    const o = payload as { error?: unknown; message?: unknown };
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
  }
  return null;
}
</script>
