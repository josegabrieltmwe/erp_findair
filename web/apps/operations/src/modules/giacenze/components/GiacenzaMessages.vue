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

const history = ref<GiacenzaMessage[]>([]);
const loading = ref(false);

const composeOpen = ref(false);
const composeTipo = ref<"GIAc" | "GIAf">("GIAc");
const composeDest = ref("");
const composeText = ref("");
const sending = ref(false);
const destError = ref(false);

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

function openCompose(tipo: "GIAc" | "GIAf"): void {
  composeTipo.value = tipo;
  composeDest.value = "";
  composeText.value = "";
  destError.value = false;
  composeOpen.value = true;
}

async function submitMessage(): Promise<void> {
  if (!props.giacenzaId) return;
  if (!composeDest.value.trim()) {
    destError.value = true;
    return;
  }
  sending.value = true;
  try {
    await giacenzeService.sendMessage(
      props.giacenzaId,
      composeTipo.value,
      composeDest.value.trim(),
      composeText.value,
    );
    composeOpen.value = false;
    await loadHistory();
  } finally {
    sending.value = false;
  }
}

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
.giac-msg__table th {
  font-size: 0.75rem;
  text-align: left;
}
</style>
