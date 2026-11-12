<template>
  <div class="giac-msg">
    <div class="giac-msg__actions">
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-email-outline"
        @click="openCompose('GIAc')"
      >
        {{ t("giacenze.giacenze.msg.toClient") }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-truck-outline"
        @click="openCompose('GIAf')"
      >
        {{ t("giacenze.giacenze.msg.toSupplier") }}
      </v-btn>
    </div>

    <!-- Historial -->
    <div class="giac-msg__history">
      <div v-if="loading" class="giac-msg__loading">
        <v-progress-circular indeterminate size="18" width="2" />
      </div>
      <div v-else-if="!history.length" class="giac-msg__empty">
        {{ t("giacenze.giacenze.msg.noMessages") }}
      </div>
      <v-table v-else density="compact" class="giac-msg__table">
        <thead>
          <tr>
            <th>{{ t("giacenze.giacenze.msg.date") }}</th>
            <th>{{ t("giacenze.giacenze.msg.type") }}</th>
            <th>{{ t("giacenze.giacenze.msg.recipient") }}</th>
            <th>{{ t("giacenze.giacenze.msg.status") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in history" :key="m.id">
            <td>{{ m.insert_datetime }}</td>
            <td>
              <v-chip
                size="x-small"
                :color="m.tipo === 'GIAf' ? 'deep-orange' : 'primary'"
                variant="tonal"
              >
                {{
                  m.tipo === "GIAf"
                    ? t("giacenze.giacenze.msg.supplier")
                    : t("giacenze.giacenze.msg.client")
                }}
              </v-chip>
            </td>
            <td>{{ m.dest_msg }}</td>
            <td>
              <v-chip
                size="x-small"
                :color="statusColor(m.esito)"
                variant="tonal"
              >
                {{ m.esito || "—" }}
              </v-chip>
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <!-- Modal de composición -->
    <v-dialog v-model="composeOpen" max-width="520">
      <v-card>
        <v-card-title>
          {{
            composeTipo === "GIAf"
              ? t("giacenze.giacenze.msg.toSupplier")
              : t("giacenze.giacenze.msg.toClient")
          }}
        </v-card-title>
        <v-card-text>
          <p class="giac-msg__lead">
            {{
              composeTipo === "GIAf"
                ? t("giacenze.giacenze.msg.leadSupplier")
                : t("giacenze.giacenze.msg.leadClient")
            }}
          </p>
          <v-text-field
            v-model="composeDest"
            :label="t('giacenze.giacenze.msg.recipient')"
            type="email"
            density="comfortable"
            :error-messages="
              destError ? [t('giacenze.giacenze.msg.recipientRequired')] : []
            "
          />
          <v-textarea
            v-model="composeText"
            :label="t('giacenze.giacenze.msg.extraText')"
            rows="3"
            auto-grow
            density="comfortable"
          />
          <p v-if="composeError" class="giac-msg__error" role="alert">
            {{ composeError }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="composeOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn color="primary" :loading="sending" @click="submitMessage">
            {{ t("giacenze.giacenze.msg.send") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { giacenzeService } from "../services/giacenze.service";
import type { GiacenzaMessage } from "../types";

const { t } = useI18n();
const props = defineProps<{ giacenzaId: number | null }>();
const emit = defineEmits<{ sent: [tipo: "GIAc" | "GIAf"] }>();

const history = ref<GiacenzaMessage[]>([]);
const loading = ref(false);

const composeOpen = ref(false);
const composeTipo = ref<"GIAc" | "GIAf">("GIAc");
const composeDest = ref("");
const composeText = ref("");
const sending = ref(false);
const destError = ref(false);
const composeError = ref("");
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function statusColor(esito: string | null): string {
  if (esito === "OK") return "success";
  if (esito === "KO") return "error";
  return "grey"; // WRK u otros
}

async function loadHistory(): Promise<void> {
  if (!props.giacenzaId) {
    history.value = [];
    return;
  }
  loading.value = true;
  try {
    history.value = await giacenzeService.messageHistory(props.giacenzaId);
  } catch {
    history.value = [];
  } finally {
    loading.value = false;
  }
}

/** Abre el envío con el destinatario ya sugerido (mismas fuentes que el aviso automático de apertura). */
async function openCompose(tipo: "GIAc" | "GIAf"): Promise<void> {
  composeTipo.value = tipo;
  composeDest.value = "";
  composeText.value = "";
  destError.value = false;
  composeError.value = "";
  composeOpen.value = true;
  if (!props.giacenzaId) return;
  try {
    const rec = await giacenzeService.suggestedRecipients(props.giacenzaId);
    const list = tipo === "GIAf" ? rec.supplier : rec.client;
    if (!composeDest.value) composeDest.value = list.join(", ");
  } catch {
    /* sin sugerencia: lo escribe el operador */
  }
}

async function submitMessage(): Promise<void> {
  if (!props.giacenzaId) return;
  const dest = composeDest.value.trim();
  const valid =
    dest !== "" && dest.split(/[,;]\s*/).every((a) => EMAIL.test(a.trim()));
  destError.value = !valid;
  if (!valid) return;
  sending.value = true;
  composeError.value = "";
  try {
    await giacenzeService.sendMessage(
      props.giacenzaId,
      composeTipo.value,
      dest,
      composeText.value,
    );
    composeOpen.value = false;
    await loadHistory();
    emit("sent", composeTipo.value);
  } catch (e) {
    composeError.value =
      e instanceof Error && e.message
        ? e.message
        : t("giacenze.giacenze.msg.sendFailed");
  } finally {
    sending.value = false;
  }
}

defineExpose({ openCompose, reload: loadHistory });

watch(() => props.giacenzaId, loadHistory, { immediate: true });
</script>

<style scoped>
.giac-msg {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.giac-msg__actions {
  display: flex;
  gap: 8px;
}
.giac-msg__loading,
.giac-msg__empty {
  color: rgba(0, 0, 0, 0.5);
  font-style: italic;
  font-size: 0.85rem;
}
.giac-msg__lead {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.6);
}
.giac-msg__error {
  margin: 8px 0 0;
  color: rgb(var(--v-theme-error));
  font-size: 0.85rem;
}
.giac-msg__table th {
  font-size: 0.75rem;
  text-align: left;
}
</style>
