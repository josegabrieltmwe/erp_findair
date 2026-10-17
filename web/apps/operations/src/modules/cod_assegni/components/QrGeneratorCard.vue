<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  createSession,
  type CreateSessionPayload,
} from "../services/cod.service";
import type { Carrier, CreatedSession } from "../types";

const props = defineProps<{ carriers: Carrier[]; loading?: boolean }>();
const emit = defineEmits<{ (e: "created", session: CreatedSession): void }>();

const { t } = useI18n();

/** Today, as YYYY-MM-DD for <input type="date">.
 *
 *  Local time, not toISOString(): that converts to UTC first, so anywhere east
 *  of Greenwich the date flips to yesterday for part of the evening. A batch
 *  dated one day off is a reconciliation that does not match. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const carrierId = ref<number | null>(null);
const billNo = ref("");
// A batch is almost always registered the day it arrives, so today is the right
// default. Still editable: paperwork does turn up late.
const billDate = ref(today());
const descriz = ref("");

const generating = ref(false);
const error = ref<string | null>(null);
const created = ref<CreatedSession | null>(null);
const copied = ref(false);

const canGenerate = computed(
  () => carrierId.value !== null && !generating.value,
);

const qrSrc = computed(() =>
  created.value?.qr_png_base64
    ? `data:image/png;base64,${created.value.qr_png_base64}`
    : null,
);

const carrierLabel = computed(
  () => props.carriers.find((c) => c.id === carrierId.value)?.label ?? "",
);

async function generate(): Promise<void> {
  if (carrierId.value === null) {
    error.value = t("errors.carrier_required");
    return;
  }

  generating.value = true;
  error.value = null;
  copied.value = false;

  const payload: CreateSessionPayload = { id_fornitore: carrierId.value };
  if (billNo.value.trim()) payload.bill_no = billNo.value.trim();
  if (billDate.value) payload.bill_date = billDate.value;
  if (descriz.value.trim()) payload.descriz = descriz.value.trim();

  try {
    const session = await createSession(payload);
    created.value = session;
    emit("created", session);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load_failed");
  } finally {
    generating.value = false;
  }
}

async function copyLink(): Promise<void> {
  if (!created.value) return;
  try {
    await navigator.clipboard.writeText(created.value.url);
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 2000);
  } catch {
    // Clipboard denied (it needs a secure context and a user gesture). The URL
    // is on screen and selectable, so this is a convenience, not a dependency.
  }
}

function reset(): void {
  created.value = null;
  billNo.value = "";
  // Back to today, not blank: the next batch is almost certainly today's too.
  billDate.value = today();
  descriz.value = "";
  error.value = null;
}

function formatExpiry(value: string): string {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
</script>

<template>
  <v-card class="qr-card" variant="outlined">
    <v-card-title class="text-subtitle-1">{{
      t("cod_assegni.qr.heading")
    }}</v-card-title>

    <v-card-text v-if="!created">
      <v-select
        v-model="carrierId"
        :items="carriers"
        item-title="label"
        item-value="id"
        :label="t('cod_assegni.qr.carrier')"
        :hint="t('cod_assegni.qr.carrier_hint')"
        :loading="loading"
        persistent-hint
        density="comfortable"
        variant="outlined"
        class="mb-4"
      />

      <v-row dense>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="billNo"
            :label="t('cod_assegni.qr.bill_no')"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="billDate"
            :label="t('cod_assegni.qr.bill_date')"
            type="date"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </v-col>
      </v-row>

      <v-text-field
        v-model="descriz"
        :label="t('cod_assegni.qr.descriz')"
        density="comfortable"
        variant="outlined"
        hide-details
        class="mt-3"
      />

      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-4"
      >
        {{ error }}
      </v-alert>
    </v-card-text>

    <v-card-actions v-if="!created" class="px-4 pb-4">
      <v-btn
        color="primary"
        variant="flat"
        block
        :loading="generating"
        :disabled="!canGenerate"
        @click="generate"
      >
        {{
          generating
            ? t("cod_assegni.qr.generating")
            : t("cod_assegni.qr.generate")
        }}
      </v-btn>
    </v-card-actions>

    <!-- The QR -->
    <v-card-text v-else class="text-center">
      <p class="text-body-2 text-medium-emphasis mb-1">{{ carrierLabel }}</p>
      <p v-if="created.id" class="text-caption text-medium-emphasis mb-4">
        #{{ created.id }}
      </p>

      <!--
        The worker is a BLOCKING RPC: if it is down the session still exists and
        the OTP is already persisted, so we show the link and let them retry the
        image rather than lose the batch.
      -->
      <v-alert
        v-if="created.warning"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-4 text-left"
      >
        {{ t("cod_assegni.qr.worker_down") }}
      </v-alert>

      <img
        v-if="qrSrc"
        :src="qrSrc"
        :alt="t('cod_assegni.qr.scan_me')"
        class="qr-card__img"
      />

      <p class="text-body-2 mt-3 mb-1">{{ t("cod_assegni.qr.scan_me") }}</p>
      <p class="text-caption text-medium-emphasis">
        {{
          t("cod_assegni.qr.expires", { date: formatExpiry(created.scadenza) })
        }}
      </p>

      <!--
        The QR is a credential on paper. It cannot be un-sent once printed, so
        say plainly what it grants — the only remedy is closing the batch.
      -->
      <v-alert
        type="info"
        variant="tonal"
        density="compact"
        class="mt-4 text-left"
      >
        {{ t("cod_assegni.qr.warning_share") }}
      </v-alert>

      <v-btn
        variant="tonal"
        size="small"
        class="mt-4"
        :prepend-icon="copied ? 'mdi-check' : 'mdi-link-variant'"
        @click="copyLink"
      >
        {{
          copied ? t("cod_assegni.qr.copied") : t("cod_assegni.qr.copy_link")
        }}
      </v-btn>

      <!-- Open the capture page in a new tab. Useful when testing from the PC,
           or to hand the operator the page without scanning. noopener/noreferrer:
           the opened page never gets a handle back to this one, and the OTP in
           the URL never leaks through a Referer header. -->
      <v-btn
        variant="tonal"
        size="small"
        class="mt-4 ml-2"
        prepend-icon="mdi-open-in-new"
        :href="created.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t("cod_assegni.qr.open") }}
      </v-btn>

      <v-btn variant="text" size="small" class="mt-4 ml-2" @click="reset">
        {{ t("cod_assegni.qr.generate") }}
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.qr-card {
  max-width: 420px;
}

.qr-card__img {
  width: 100%;
  max-width: 260px;
  height: auto;
  border: 1px solid rgb(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
}
</style>
