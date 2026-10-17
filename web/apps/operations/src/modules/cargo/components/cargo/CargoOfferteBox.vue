<template>
  <v-card :border="!embedded" :flat="embedded" rounded="lg">
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-tag-multiple-outline" size="18" class="me-2" />
      {{ t("cargo.offerte.title") }}
      <v-chip
        v-if="offertaState.label"
        size="x-small"
        :color="offertaState.color"
        variant="tonal"
        class="ms-2"
      >
        {{ offertaState.label }}
      </v-chip>
    </v-card-title>
    <v-divider v-if="!embedded" />
    <v-card-text :class="embedded ? 'px-0' : ''">
      <v-row dense>
        <v-col cols="12" md="4">
          <v-select
            v-model="gestioneLocal"
            :items="gestioneItems"
            :label="t('cargo.offerte.management')"
            readonly
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="offertaLocal"
            :items="offertaItems"
            :label="t('cargo.col.status')"
            :loading="savingStatus"
            @update:model-value="onCommitStatus"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-btn
            variant="tonal"
            color="info"
            prepend-icon="mdi-email-arrow-right-outline"
            :disabled="!id"
            @click="openSendDialog"
          >
            {{ t("cargo.offerte.send_to_client") }}
          </v-btn>
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="quoteNotesDisplay"
            :label="t('cargo.offerte.quote_notes')"
            rows="3"
            auto-grow
            @blur="onCommitQuoteNotes"
          />
        </v-col>
      </v-row>
    </v-card-text>

    <!-- Send offer to client — vía EmailComposer compartido. -->
    <EmailComposer v-model="sendOpen" :adapter="sendAdapter" @sent="onSent" />
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { clientOfferService } from "@cargo/services/client_offer.service";
import { EmailComposer, emailPreviewService } from "@shared/email";
import type {
  EmailComposerModel,
  EmailPreview,
  EmailScenarioAdapter,
  Recipient,
} from "@shared/email";

withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });

const { t } = useI18n();
const store = useCargoStore();
const toasts = useToastStore();
const { id, cargo } = storeToRefs(store);

// gestione is read-only here (N/F/O) — set to 'O' automatically when the offer
// is sent. offerta (N/V/A/R) is the operator-editable client decision.
const gestioneLocal = computed(() => String(cargo.value?.gestione ?? "N"));
const offertaLocal = ref<string>(String(cargo.value?.offerta ?? "N"));

const savingStatus = ref(false);

async function onCommitStatus(v: string): Promise<void> {
  if (!id.value) return;
  savingStatus.value = true;
  try {
    const r = await clientOfferService.setStatus(
      Number(id.value),
      v as "N" | "V" | "A" | "R",
    );
    if (r.success) {
      toasts.push("success", t("cargo.toast.offer_saved"));
    } else {
      toasts.push("error", r.error ?? "Save failed");
      offertaLocal.value = String(cargo.value?.offerta ?? "N");
    }
  } finally {
    savingStatus.value = false;
  }
}

/**
 * offerta_txt stores HTML (literal <br>). Render plain in the textarea, convert
 * back to <br> on save so legacy renderers still work.
 */
const localTxt = ref<string>(String(cargo.value?.offerta_txt ?? ""));
const quoteNotesDisplay = computed<string>({
  get: () => htmlToPlain(localTxt.value),
  set: (v: string) => {
    localTxt.value = plainToHtml(v);
  },
});

function htmlToPlain(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function plainToHtml(s: string): string {
  return s.replace(/\r\n|\r|\n/g, "<br>");
}

async function onCommitQuoteNotes(): Promise<void> {
  if (!id.value) return;
  const r = await clientOfferService.setText(Number(id.value), localTxt.value);
  if (!r.success) toasts.push("error", r.error ?? "Save failed");
}

const gestioneItems = computed(() => [
  { title: t("cargo.offerte.gest_new"), value: "N" },
  { title: t("cargo.offerte.gest_examined"), value: "F" },
  { title: t("cargo.offerte.gest_offered"), value: "O" },
]);
const offertaItems = computed(() => [
  { title: t("cargo.offerte.off_new"), value: "N" },
  { title: t("cargo.offerte.off_viewed"), value: "V" },
  { title: t("cargo.offerte.off_accepted"), value: "A" },
  { title: t("cargo.offerte.off_refused"), value: "R" },
]);

const offertaState = computed(() => {
  switch (offertaLocal.value) {
    case "A":
      return { label: t("cargo.offerte.off_accepted"), color: "success" };
    case "R":
      return { label: t("cargo.offerte.off_refused"), color: "error" };
    case "V":
      return { label: t("cargo.offerte.off_viewed"), color: "primary" };
    default:
      return { label: t("cargo.offerte.off_new"), color: "warning" };
  }
});

// --- Send offer to client (EmailComposer) ---
const sendOpen = ref(false);

function openSendDialog(): void {
  sendOpen.value = true;
}

const LANG_ITEMS = [
  { title: "Italiano", value: "ITA" },
  { title: "English", value: "ENG" },
  { title: "Español", value: "SPA" },
  { title: "Français", value: "FRA" },
];

const sendAdapter = computed<EmailScenarioAdapter>(() => ({
  scenario: "cargo_offer",
  title: t("cargo.offerte.send_dialog_title"),
  subtitle: t("cargo.offerte.send_dialog_intro"),
  icon: "mdi-email-arrow-right-outline",
  supportsPreview: true,
  supportsManualRecipients: true,
  supportsCc: true,
  supportsAttachments: false,
  supportsLangSelect: true,
  supportsNote: false,
  langItems: () => LANG_ITEMS,
  defaultLang: () => "ITA",
  async loadRecipients(): Promise<Recipient[]> {
    if (!id.value) return [];
    const r = await clientOfferService.contacts(Number(id.value));
    if (!r.success || !r.data) return [];
    return r.data.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      lingua: c.lingua_web,
      source: "catalog" as const,
    }));
  },
  async preview(input: {
    lang: string;
    text: string;
  }): Promise<EmailPreview | null> {
    if (!id.value) return null;
    return emailPreviewService.preview("cargo_offer", Number(id.value), {
      lang: input.lang,
      text: input.text,
    });
  },
  async send(model: EmailComposerModel) {
    if (!id.value) return { sent: 0, errors: ["no cargo"] };
    const contactIds = model.recipients
      .filter((r) => r.id != null)
      .map((r) => r.id as number);
    const extraEmails = model.recipients
      .filter((r) => r.id == null && r.email)
      .map((r) => r.email as string);
    const cc = model.cc
      .map((r) => r.email ?? "")
      .filter((e) => e.includes("@"));

    if (!contactIds.length && !extraEmails.length) {
      return { sent: 0, errors: [t("cargo.offerte.no_eligible_contacts")] };
    }
    const r = await clientOfferService.send(
      Number(id.value),
      contactIds,
      extraEmails,
      cc,
      model.bodyHtml || undefined,
    );
    if (r.success) {
      const total = contactIds.length + extraEmails.length;
      return { sent: total, errors: [] };
    }
    return { sent: 0, errors: [r.error ?? "Send failed"] };
  },
}));

function onSent(res: { sent: number; errors: string[] }): void {
  if (res.sent > 0) {
    toasts.push("success", t("cargo.offerte.sent_ok"));
    // Refresca el cargo para reflejar gestione='O'.
    if (id.value) void store.load(Number(id.value));
  } else {
    toasts.push("error", res.errors[0] ?? "Send failed");
  }
}
</script>
