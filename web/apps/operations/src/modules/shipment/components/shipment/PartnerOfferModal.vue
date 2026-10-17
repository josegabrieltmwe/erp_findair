<template>
  <EmailComposer
    :model-value="modelValue"
    :adapter="adapter"
    @update:model-value="emit('update:modelValue', $event)"
    @sent="onSent"
  >
    <template #scenario-fields>
      <!-- Modo: cotizar (EXPQUOT + OTP) vs informar (PARTINFO). Cambia el tipo
           de plantilla del preview. -->
      <div class="sf-label">{{ t("shipment.partner_offer.mode_label") }}</div>
      <div class="po-modes">
        <button
          type="button"
          class="po-mode"
          :class="{ 'po-mode--on': mode === 'Q' }"
          @click="mode = 'Q'"
        >
          <v-icon icon="mdi-cash-multiple" size="16" />
          {{ t("shipment.partner_offer.mode_quote") }}
        </button>
        <button
          type="button"
          class="po-mode"
          :class="{ 'po-mode--on': mode === 'I' }"
          @click="mode = 'I'"
        >
          <v-icon icon="mdi-information-outline" size="16" />
          {{ t("shipment.partner_offer.mode_info") }}
        </button>
      </div>
    </template>
  </EmailComposer>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { EmailComposer } from "@shared/email";
import type {
  EmailComposerModel,
  EmailPreview,
  EmailScenarioAdapter,
  Recipient,
} from "@shared/email";
import { selectablePartnersService } from "@shipment/services/selectable_partners.service";
import {
  partnerOffersService,
  type PartnerOfferMode,
} from "@shipment/services/partner_offers.service";
import { useToastStore } from "@shipment/stores/toast.store";

const props = defineProps<{ modelValue: boolean; shipmentId: number }>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const { t } = useI18n();
const toasts = useToastStore();

// Modo Q/I: control propio del escenario (afecta al tipo de plantilla). Al
// cambiar, el adapter se recomputa (nueva identidad) y el EmailComposer recarga
// el preview con el nuevo tipo (EXPQUOT ↔ PARTINFO).
const mode = ref<PartnerOfferMode>("Q");

const LANG_ITEMS = [
  { title: "Italiano", value: "ITA" },
  { title: "English", value: "ENG" },
  { title: "Español", value: "SPA" },
  { title: "Français", value: "FRA" },
];

const adapter = computed<EmailScenarioAdapter>(() => {
  // Depender de mode.value hace que el adapter se recomputa al cambiar de modo.
  const currentMode = mode.value;
  return {
    scenario: "partner_offer",
    title: t("shipment.partner_offer.dialog_title"),
    subtitle: t("shipment.partner_offer.dialog_intro"),
    icon: "mdi-account-arrow-right-outline",
    supportsPreview: true,
    supportsManualRecipients: true,
    supportsCc: true,
    supportsAttachments: false,
    supportsLangSelect: true,
    supportsNote: false,
    langItems: () => LANG_ITEMS,
    defaultLang: () => "ITA",
    async loadRecipients(): Promise<Recipient[]> {
      // Audiencia = partners del catálogo (por id, sin email; el backend
      // resuelve sus contactos elegibles).
      const partners = await selectablePartnersService.search("");
      return partners.map((p) => ({
        id: p.id,
        name: p.label,
        source: "catalog" as const,
      }));
    },
    async preview(input: {
      lang: string;
      text: string;
    }): Promise<EmailPreview | null> {
      if (!props.shipmentId) return null;
      return partnerOffersService.preview(
        props.shipmentId,
        currentMode,
        input.text,
        input.lang,
      );
    },
    async send(model: EmailComposerModel) {
      if (!props.shipmentId) return { sent: 0, errors: ["no shipment"] };
      // Partition: recipients con id → partners; recipients manuales → emails.
      const partnerIds = model.recipients
        .filter((r) => r.id != null)
        .map((r) => r.id as number);
      const extraEmails = model.recipients
        .filter((r) => r.id == null && r.email)
        .map((r) => r.email as string);
      const cc = model.cc
        .map((r) => r.email ?? "")
        .filter((e) => e.includes("@"));

      if (!partnerIds.length) {
        return { sent: 0, errors: [t("shipment.partner_offer.need_partner")] };
      }

      const res = await partnerOffersService.distribute(
        props.shipmentId,
        partnerIds,
        currentMode,
        model.text,
        [],
        model.bodyHtml || undefined,
        extraEmails,
        cc,
      );
      const sent = res?.data?.sent ?? 0;
      if (sent > 0) return { sent, errors: [] };
      return {
        sent: 0,
        errors: [
          res?.data?.errors?.[0] ?? t("shipment.partner_offer.toast_error"),
        ],
      };
    },
  };
});

function onSent(res: { sent: number; errors: string[] }): void {
  if (res.sent > 0) {
    toasts.push(
      "success",
      t("shipment.partner_offer.toast_sent", { count: res.sent }),
    );
  } else {
    toasts.push(
      "error",
      res.errors[0] ?? t("shipment.partner_offer.toast_error"),
    );
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
.po-modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.po-mode {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background 0.14s ease,
    color 0.14s ease;
}
.po-mode:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.po-mode--on {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
</style>
