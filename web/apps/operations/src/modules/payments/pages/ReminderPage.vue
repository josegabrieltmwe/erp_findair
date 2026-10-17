<template>
  <div class="rem-page">
    <div class="rem-toolbar">
      <v-btn variant="text" icon="mdi-arrow-left" :to="{ name: 'payments' }" />
      <h1 class="text-h6 mb-0">{{ t("payments.reminders.title") }}</h1>
      <v-spacer />
      <v-btn-toggle
        v-model="phase"
        density="compact"
        mandatory
        variant="outlined"
        divided
        @update:model-value="loadPreview"
      >
        <v-btn value="all">{{ t("payments.reminders.phase_all") }}</v-btn>
        <v-btn value="notice">{{ t("payments.reminders.phase_notice") }}</v-btn>
        <v-btn value="overdue">{{
          t("payments.reminders.phase_overdue")
        }}</v-btn>
      </v-btn-toggle>
      <v-btn
        variant="text"
        icon="mdi-refresh"
        :title="t('common.refresh')"
        @click="loadAll"
      />
    </div>

    <v-alert
      v-if="settings && dry"
      type="warning"
      variant="tonal"
      density="compact"
      icon="mdi-email-off-outline"
    >
      <strong>{{ t("payments.reminders.dry_title") }}</strong>
      <div>{{ t("payments.reminders.dry_text") }}</div>
    </v-alert>
    <v-alert
      v-else-if="settings"
      type="success"
      variant="tonal"
      density="compact"
      icon="mdi-email-fast-outline"
    >
      {{ t("payments.reminders.active_text") }}
    </v-alert>
    <div v-if="settings" class="text-caption text-medium-emphasis">
      {{
        t("payments.reminders.rules", {
          notice: settings.notice_days,
          overdue: settings.overdue_min_days,
          repeat: settings.repeat_days,
        })
      }}
      <template v-if="settings.block_enabled">
        {{ t("payments.reminders.rules_block", { n: settings.block_days }) }}
      </template>
    </div>

    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-if="error" type="error" variant="tonal" density="compact">
      {{ t("payments.reminders.load_failed") }}
    </v-alert>
    <v-alert
      v-for="(w, i) in preview?.warnings ?? []"
      :key="i"
      type="warning"
      variant="tonal"
      density="compact"
    >
      {{ w }}
    </v-alert>

    <!-- Resultado del envío -->
    <v-card v-if="runResult" variant="outlined" class="pa-4">
      <div class="text-subtitle-1 mb-2">
        {{ t("payments.reminders.result") }}
      </div>
      <div class="d-flex flex-wrap ga-2">
        <v-chip color="success" variant="tonal">
          {{ t("payments.reminders.sent", { n: runResult.totals.sent ?? 0 }) }}
        </v-chip>
        <v-chip color="error" variant="tonal">
          {{
            t("payments.reminders.errors", {
              n: runResult.totals.send_errors ?? 0,
            })
          }}
        </v-chip>
        <v-chip color="warning" variant="tonal">
          {{
            t("payments.reminders.blocked", {
              n: runResult.totals.blocked ?? 0,
            })
          }}
        </v-chip>
      </div>
    </v-card>
    <v-alert
      v-if="runUncertain"
      type="warning"
      variant="tonal"
      density="compact"
    >
      {{ t("payments.reminders.uncertain") }}
    </v-alert>

    <v-card variant="flat" class="rem-card">
      <div class="d-flex align-center pa-3 ga-2 flex-wrap">
        <div class="text-subtitle-1">
          {{ t("payments.reminders.clients", { n: groups.length }) }}
        </div>
        <v-spacer />
        <v-btn
          size="small"
          variant="text"
          @click="selected = sendableIds(groups)"
        >
          {{ t("payments.reminders.select_all") }}
        </v-btn>
        <v-btn size="small" variant="text" @click="selected = []">
          {{ t("payments.reminders.select_none") }}
        </v-btn>
        <v-btn
          v-if="caps.canCollect"
          color="primary"
          prepend-icon="mdi-send"
          :disabled="!canSend"
          @click="confirmOpen = true"
        >
          {{ t("payments.reminders.send", { n: selected.length }) }}
        </v-btn>
      </div>
      <div
        v-if="dry && caps.canCollect"
        class="px-3 pb-2 text-caption text-warning"
      >
        {{ t("payments.reminders.send_disabled") }}
      </div>
      <v-divider />
      <v-table density="comfortable">
        <thead>
          <tr>
            <th style="width: 48px" />
            <th>{{ t("payments.col.customer") }}</th>
            <th>{{ t("payments.reminders.type") }}</th>
            <th class="text-end">{{ t("payments.reminders.amount") }}</th>
            <th>{{ t("payments.reminders.recipients") }}</th>
            <th>{{ t("payments.reminders.block") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!groups.length && !loading">
            <td colspan="6" class="text-center text-medium-emphasis pa-6">
              {{ t("payments.reminders.empty") }}
            </td>
          </tr>
          <tr v-for="g in groups" :key="g.client_id">
            <td>
              <v-checkbox-btn
                :model-value="selected.includes(g.client_id)"
                :disabled="!g.sendable"
                @update:model-value="toggle(g.client_id, $event)"
              />
            </td>
            <td>{{ g.rag_soc }}</td>
            <td>
              <div v-for="(e, i) in g.entries" :key="i" class="my-1">
                <v-chip
                  size="x-small"
                  :color="typeColor(e.tipo)"
                  variant="tonal"
                >
                  {{ typeLabel(e.tipo) }}
                </v-chip>
                <span
                  v-if="e.action !== 'would_send'"
                  class="text-caption text-medium-emphasis ms-1"
                >
                  {{ actionLabel(e.action) }}
                </span>
              </div>
            </td>
            <td class="text-end">{{ money(g.total) }}</td>
            <td class="text-caption">{{ g.recipients.join(", ") || "—" }}</td>
            <td>
              <v-icon
                v-if="g.would_block"
                icon="mdi-lock-outline"
                color="error"
                size="18"
                :title="t('payments.reminders.would_block')"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="confirmOpen" max-width="460" persistent>
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("payments.reminders.confirm_title") }}
        </v-card-title>
        <v-card-text>
          <p class="mb-2">
            {{ t("payments.reminders.confirm_text", { n: selected.length }) }}
          </p>
          <v-alert type="warning" variant="tonal" density="compact">
            {{ t("payments.reminders.irreversible") }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="sending"
            @click="confirmOpen = false"
          >
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="sending"
            :disabled="sending || !canSend"
            @click="send"
          >
            {{ t("payments.reminders.confirm_send") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { capabilities } from "../env";
import {
  canSendReminders,
  groupByClient,
  isDryRun,
  remindersApi,
  sendableIds,
  type ReminderPhase,
  type ReminderResult,
  type ReminderSettings,
} from "../services/reminders.service";

const { t } = useI18n();
const caps = capabilities();

const phase = ref<ReminderPhase>("all");
const settings = ref<ReminderSettings | null>(null);
const preview = ref<ReminderResult | null>(null);
const selected = ref<number[]>([]);
const loading = ref(false);
const error = ref(false);
const confirmOpen = ref(false);
const sending = ref(false);
const runResult = ref<ReminderResult | null>(null);
const runUncertain = ref(false);

const groups = computed(() => groupByClient(preview.value?.items ?? []));
const dry = computed(() => isDryRun(settings.value));
const canSend = computed(
  () =>
    !sending.value &&
    canSendReminders(settings.value, selected.value.length, caps.canCollect),
);

function money(v: unknown): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}
function toggle(id: number, on: unknown): void {
  selected.value = on
    ? [...new Set([...selected.value, id])]
    : selected.value.filter((x) => x !== id);
}
const TYPE_KEYS = ["AVV5", "SOLL", "BLOCCO"];
function typeLabel(tipo: string): string {
  return TYPE_KEYS.includes(tipo) ? t(`payments.reminders.type_${tipo}`) : tipo;
}
function typeColor(tipo: string): string {
  return tipo === "BLOCCO" ? "error" : tipo === "SOLL" ? "warning" : "info";
}
function actionLabel(a: string): string {
  return ["compensated", "no_recipient", "no_template"].includes(a)
    ? t(`payments.reminders.action_${a}`)
    : a;
}

async function loadPreview(): Promise<void> {
  loading.value = true;
  error.value = false;
  try {
    preview.value = await remindersApi.preview(phase.value);
    selected.value = sendableIds(groupByClient(preview.value.items));
  } catch {
    error.value = true;
    preview.value = null;
  } finally {
    loading.value = false;
  }
}
async function loadAll(): Promise<void> {
  try {
    settings.value = await remindersApi.settings();
  } catch {
    settings.value = null;
  }
  await loadPreview();
}

/** Una sola llamada: enviar recordatorios no se puede deshacer ni se reintenta. */
async function send(): Promise<void> {
  if (!canSend.value) return;
  sending.value = true;
  runUncertain.value = false;
  try {
    runResult.value = await remindersApi.run(phase.value, [...selected.value]);
    confirmOpen.value = false;
    selected.value = [];
    await loadPreview();
  } catch (e) {
    confirmOpen.value = false;
    const status = (e as { status?: number } | null)?.status;
    if (!status || status >= 500) runUncertain.value = true;
    else error.value = true;
  } finally {
    sending.value = false;
  }
}

onMounted(() => void loadAll());
</script>

<style scoped>
.rem-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rem-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rem-card {
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow: hidden;
}
</style>
