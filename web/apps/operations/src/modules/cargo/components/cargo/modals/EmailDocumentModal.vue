<template>
  <!--
    AWB document email modal (MAWB / HAWB / Manifest / Pouch / colli lists).
    Store-driven (ui.pendingEmailType + ui.activeModal). Reescrito sobre el
    EmailComposer compartido: los destinatarios (catálogo + manuales + CC) los
    gestiona el componente; los controles propios del escenario (selector HAWB
    y modo enlaces/adjunto) van en el slot scenario-fields.
  -->
  <EmailComposer
    :model-value="isOpen"
    :adapter="adapter"
    @update:model-value="onOpenChange"
    @sent="onSent"
  >
    <template #scenario-fields>
      <div v-if="needsAwbId" class="mb-3">
        <div class="sf-label">{{ t("cargo.emaildoc.hawb_to_send") }}</div>
        <v-select
          v-model="selectedAwbId"
          :items="hawbOptions"
          item-title="label"
          item-value="id"
          density="comfortable"
          variant="outlined"
          prepend-inner-icon="mdi-tag-outline"
          :loading="loadingHawbList"
          :hint="
            hawbOptions.length === 0 ? t('cargo.emaildoc.no_hawb_hint') : ''
          "
          persistent-hint
          hide-details="auto"
        />
      </div>
      <div class="sf-label">{{ t("cargo.emailmawb.send_mode") }}</div>
      <v-radio-group v-model="mode" inline density="compact" hide-details>
        <v-radio :label="t('cargo.emailmawb.mode_links')" value="links" />
        <v-radio
          :label="t('cargo.emailmawb.mode_attachment')"
          value="attachment"
        />
      </v-radio-group>
    </template>
  </EmailComposer>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { cargoActionsService } from "@cargo/services/cargo_actions.service";
import { hawbService, type HawbRow } from "@cargo/services/hawb.service";
import { http } from "@cargo/services/http";
import { EmailComposer } from "@shared/email";
import type {
  EmailComposerModel,
  EmailScenarioAdapter,
  Recipient,
} from "@shared/email";

interface RecipientRow {
  id: number;
  email: string;
  name: string;
}
interface RecipientsResponse {
  success: boolean;
  cargo_id: number;
  recipients: RecipientRow[];
  count: number;
}

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const toasts = useToastStore();
const { id } = storeToRefs(cargoStore);

const cargoId = computed<number | null>(() => {
  if (!id.value) return null;
  const n = Number(id.value);
  return Number.isFinite(n) ? n : null;
});

const isOpen = computed<boolean>(() => ui.activeModal === "email_document");

const KIND_LABEL: Record<string, string> = {
  mawb: "MAWB",
  hawb: "HAWB",
  manifest: "Manifest",
  pouch: "Pouch",
  mawb_colli: "Master colli list",
  hawb_colli: "House colli list",
};
const docLabel = computed<string>(
  () => KIND_LABEL[ui.pendingEmailType] ?? "MAWB",
);

const needsAwbId = computed<boolean>(
  () => ui.pendingEmailType === "hawb" || ui.pendingEmailType === "hawb_colli",
);

// Controles propios del escenario (viven fuera del composer).
const mode = ref<"links" | "attachment">("links");
const selectedAwbId = ref<number | null>(null);
const hawbOptions = ref<Array<{ id: number; label: string }>>([]);
const loadingHawbList = ref(false);

/** Carga la lista de HAWB cuando el tipo lo requiere (al abrir). */
async function loadHawbList(): Promise<void> {
  selectedAwbId.value = null;
  hawbOptions.value = [];
  if (!needsAwbId.value || !cargoId.value) return;
  loadingHawbList.value = true;
  try {
    const list: HawbRow[] = await hawbService.list(cargoId.value);
    hawbOptions.value = list.map((h) => ({
      id: h.id,
      label: h.awb_number
        ? `${h.awb_number} — ${h.consignee_name || "—"}`
        : `HAWB #${h.id}`,
    }));
    if (hawbOptions.value.length === 1) {
      selectedAwbId.value = hawbOptions.value[0].id;
    }
  } finally {
    loadingHawbList.value = false;
  }
}

// Reset de controles propios + carga HAWB al abrir.
watch(isOpen, (open) => {
  if (!open) return;
  mode.value = "links";
  void loadHawbList();
});
// Cambiar de tipo mientras está abierto (raro, pero seguro).
watch(needsAwbId, () => {
  if (isOpen.value) void loadHawbList();
});

function onOpenChange(open: boolean): void {
  if (!open) ui.closeModal();
}

const adapter = computed<EmailScenarioAdapter>(() => ({
  scenario: "awb_document",
  title: t("cargo.emaildoc.title", { doc: docLabel.value }),
  subtitle: t("cargo.emaildoc.intro", {
    doc: docLabel.value,
    id: cargoId.value ?? "",
  }),
  icon: "mdi-email-arrow-right-outline",
  supportsPreview: false,
  supportsManualRecipients: true,
  supportsCc: true,
  supportsAttachments: false,
  supportsLangSelect: false,
  supportsNote: false,
  langItems: () => [],
  defaultLang: () => "",
  async loadRecipients(): Promise<Recipient[]> {
    if (!cargoId.value) return [];
    const r = await http<RecipientsResponse>(
      "/api_cargo_mawb_share_recipients",
      {
        query: { cargo_id: cargoId.value },
      },
    );
    if (!r?.success || !Array.isArray(r.recipients)) return [];
    return r.recipients.map((it) => ({
      id: it.id,
      email: it.email,
      name: it.name,
      source: "catalog" as const,
    }));
  },
  async preview() {
    return null;
  },
  async send(model: EmailComposerModel) {
    if (!cargoId.value) return { sent: 0, errors: ["no cargo"] };
    if (needsAwbId.value && !selectedAwbId.value) {
      return { sent: 0, errors: [t("cargo.emaildoc.select_hawb_first")] };
    }
    const to = model.recipients
      .map((r) => r.email ?? "")
      .filter((e) => e.includes("@"));
    const cc = model.cc
      .map((r) => r.email ?? "")
      .filter((e) => e.includes("@"));
    if (!to.length) {
      return { sent: 0, errors: [t("cargo.emailmawb.no_contacts")] };
    }
    const r = await cargoActionsService.emailDocument(
      cargoId.value,
      ui.pendingEmailType,
      to,
      { cc, mode: mode.value, awbId: selectedAwbId.value ?? undefined },
    );
    if (r.success) {
      return { sent: to.length, errors: [] };
    }
    return { sent: 0, errors: [r.error ?? t("cargo.emailmawb.send_failed")] };
  },
}));

function onSent(res: { sent: number; errors: string[] }): void {
  if (res.sent > 0) {
    toasts.push("success", t("cargo.emaildoc.sent", { doc: docLabel.value }));
  } else {
    toasts.push("error", res.errors[0] ?? t("cargo.emailmawb.send_failed"));
  }
}
</script>

<style scoped lang="scss">
.sf-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 7px;
}
</style>
