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
import { useExpressOffersStore } from "@shipment/stores/express_offers.store";
import { selectableCarriersService } from "@shipment/services/selectable_carriers.service";

const props = defineProps<{ modelValue: boolean; shipmentId: number }>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const { t } = useI18n();
const store = useExpressOffersStore();

const LANG_ITEMS = [
  { title: "English", value: "ENG" },
  { title: "Italiano", value: "ITA" },
  { title: "Español", value: "SPA" },
  { title: "Français", value: "FRA" },
];

const adapter = computed<EmailScenarioAdapter>(() => ({
  scenario: "express_rfq",
  title: t("shipment.rfq.dialog_title"),
  subtitle: t("shipment.rfq.dialog_intro"),
  icon: "mdi-truck-fast-outline",
  supportsPreview: true,
  supportsManualRecipients: true,
  supportsCc: true,
  supportsAttachments: false,
  supportsLangSelect: true,
  // Sin campo Nota separado: el operador edita todo el cuerpo directamente en
  // el WYSIWYG (evita la caja redundante). El texto de la solicitud que ve el
  // courier (txt_richiesta) se deriva del cuerpo en el backend.
  supportsNote: false,
  langItems: () => LANG_ITEMS,
  defaultLang: () => "ENG",
  async loadRecipients(): Promise<Recipient[]> {
    const carriers = await selectableCarriersService.list();
    return carriers.map((c) => ({
      id: c.id,
      name: c.label,
      source: "catalog" as const,
    }));
  },
  async preview(input: {
    lang: string;
    text: string;
  }): Promise<EmailPreview | null> {
    if (!props.shipmentId) return null;
    return emailPreviewService.preview("express_rfq", props.shipmentId, {
      lang: input.lang,
      text: input.text,
    });
  },
  async send(model: EmailComposerModel) {
    if (!props.shipmentId) return { sent: 0, errors: ["no shipment"] };
    const courierIds = model.recipients
      .filter((r) => r.id != null)
      .map((r) => r.id as number);
    const extraEmails = model.recipients
      .filter((r) => r.id == null && r.email)
      .map((r) => r.email as string);
    const cc = model.cc
      .map((r) => r.email ?? "")
      .filter((e) => e.includes("@"));

    if (!courierIds.length) {
      return { sent: 0, errors: [t("shipment.rfq.need_courier")] };
    }
    const res = await store.distribute(
      props.shipmentId,
      courierIds,
      model.text,
      [],
      extraEmails,
      cc,
      model.bodyHtml || undefined,
    );
    // Devolvemos el resultado al composer, que muestra el feedback y cierra.
    return { sent: res.ok ? courierIds.length : 0, errors: res.errors };
  },
}));

function onSent(): void {}
</script>
