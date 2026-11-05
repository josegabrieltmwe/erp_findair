<template>
  <!--
    Pila fija abajo a la derecha. Antes era un v-snackbar-queue con slot #default: en Vuetify 3.12 ese slot
    sustituye al VSnackbar, así que el v-alert se pintaba en el flujo de la página (debajo del área visible) y la
    cola se quedaba atascada tras el primero: ningún aviso de la SPA llegaba a verse. La caducidad la lleva el store.
  -->
  <div class="app-toaster" role="status" aria-live="polite">
    <TransitionGroup name="app-toast">
      <v-alert
        v-for="item in queue"
        :key="item.id"
        :type="item.kind"
        variant="elevated"
        density="compact"
        closable
        class="app-toast"
        @click:close="toastStore.dismiss(item.id)"
      >
        {{ item.message }}
      </v-alert>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import {
  useToastStore,
  type Toast,
} from "@shared/anagrafiche/stores/toast.store";
import { onHttpEvent } from "@shared/anagrafiche/services/http";
import { useI18n } from "vue-i18n";
import { isExpectedUnavailable } from "./expectedUnavailable";

const toastStore = useToastStore();
const { t } = useI18n();

// Los más recientes al final (abajo); como mucho 5 a la vez.
const queue = computed<Toast[]>(() => toastStore.toasts.slice(-5));

// Bridge HTTP layer events → toasts.
onMounted(() => {
  onHttpEvent((ev, payload) => {
    if (ev === "rate-limit") toastStore.warning(t("errors.rateLimit"));
    else if (ev === "forbidden")
      toastStore.error(humanMessage(extract(payload)) || t("errors.forbidden"));
    else if (ev === "server-error") {
      // 503 de pasarela apagada (PAYMENT_NOT_ACTIVE...): estado esperado que la propia pantalla explica; sin toast rojo.
      if (isExpectedUnavailable(payload)) return;
      toastStore.error(extract(payload) || t("errors.server"));
    }
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

<style scoped>
.app-toaster {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(420px, calc(100vw - 32px));
  pointer-events: none;
}
.app-toast {
  pointer-events: auto;
}
.app-toast-enter-active,
.app-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
