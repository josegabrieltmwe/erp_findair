<template>
  <EmailComposer
    :model-value="modelValue"
    :adapter="adapter"
    @update:model-value="emit('update:modelValue', $event)"
    @sent="onSent"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { EmailComposer, emailPreviewService } from "@shared/email";
import type {
  EmailComposerModel,
  EmailPreview,
  EmailScenarioAdapter,
  Recipient,
} from "@shared/email";
import { expressOffersService } from "@shipment/services/express_offers.service";
import type { ExpressOffer } from "@shipment/services/express_offers.service";

const props = defineProps<{
  modelValue: boolean;
  /** La oferta ganadora a notificar. */
  offer: ExpressOffer | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  sent: [{ sent: number; errors: string[] }];
}>();

const { t } = useI18n();

const LANG_ITEMS = [
  { title: "English", value: "ENG" },
  { title: "Italiano", value: "ITA" },
  { title: "Español", value: "SPA" },
  { title: "Français", value: "FRA" },
];

const adapter = computed<EmailScenarioAdapter>(() => ({
  scenario: "express_award",
  title: t("shipment.award.dialog_title"),
  subtitle: t("shipment.award.dialog_intro"),
  icon: "mdi-trophy-outline",
  supportsPreview: true,
  supportsManualRecipients: true,
  supportsCc: true,
  supportsAttachments: false,
  supportsLangSelect: true,
  supportsNote: false,
  langItems: () => LANG_ITEMS,
  defaultLang: () => "ENG",
  async loadRecipients(): Promise<Recipient[]> {
    const o = props.offer;
    if (!o) return [];
    // Único destinatario: el courier ganador (email ya resuelto en la oferta).
    const email = String((o as Record<string, unknown>).courier_email ?? "");
    return [
      {
        id: Number(o.id_courier),
        name: String(
          (o as Record<string, unknown>).courier_nome ?? o.id_courier,
        ),
        email,
        source: "catalog" as const,
      },
    ];
  },
  async preview(input: {
    lang: string;
    text: string;
  }): Promise<EmailPreview | null> {
    const o = props.offer;
    if (!o) return null;
    return emailPreviewService.preview("express_award", Number(o.id), {
      lang: input.lang,
    });
  },
  async send(model: EmailComposerModel) {
    const o = props.offer;
    if (!o) return { sent: 0, errors: ["no offer"] };
    // Direcciones manuales = recipients sin id (el courier ganador va con id).
    const extraEmails = model.recipients
      .filter((r) => r.id == null && r.email)
      .map((r) => r.email as string);
    const cc = model.cc
      .map((r) => r.email ?? "")
      .filter((e) => e.includes("@"));
    const r = await expressOffersService.notifyWinner(
      Number(o.id),
      model.lang,
      model.bodyHtml || undefined,
      extraEmails,
      cc,
    );
    if (r.success) {
      return { sent: 1, errors: [] };
    }
    return { sent: 0, errors: [r.error ?? t("shipment.award.send_failed")] };
  },
}));

function onSent(res: { sent: number; errors: string[] }): void {
  emit("sent", res);
}
</script>
