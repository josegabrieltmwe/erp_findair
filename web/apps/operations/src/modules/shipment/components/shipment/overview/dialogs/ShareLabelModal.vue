<template>
  <EmailComposer
    :model-value="modelValue"
    :adapter="adapter"
    @update:model-value="emit('update:modelValue', $event)"
    @sent="onSent"
  >
    <template #scenario-fields>
      <div class="sf-label">{{ t("shipment.label_share.document") }}</div>
      <v-select
        v-model="docType"
        :items="docItems"
        item-title="label"
        item-value="value"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-file-document-outline"
        hide-details
      />
    </template>
  </EmailComposer>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { EmailComposer } from "@shared/email";
import type {
  EmailComposerModel,
  EmailScenarioAdapter,
  Recipient,
} from "@shared/email";
import { useToastStore } from "@shipment/stores/toast.store";
import { labelShareService } from "@shipment/services/label_share.service";

const props = defineProps<{ modelValue: boolean; shipmentId: number }>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const { t } = useI18n();
const toasts = useToastStore();

const docType = ref<"ldv" | "courier_label">("courier_label");

const docItems = computed(() => [
  {
    value: "courier_label",
    label: t("shipment.label_share.doc_courier_label"),
  },
  { value: "ldv", label: t("shipment.label_share.doc_ldv") },
]);

/** Extrae emails de una lista de recipients (catálogo o manuales). */
function emailsOf(list: Recipient[]): string[] {
  return list.map((r) => (r.email ?? "").trim()).filter((e) => e !== "");
}

const adapter = computed<EmailScenarioAdapter>(() => ({
  scenario: "label",
  title: t("shipment.label_share.title"),
  subtitle: t("shipment.label_share.intro"),
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
    if (!props.shipmentId) return [];
    const rows = await labelShareService.recipients(props.shipmentId);
    return rows.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      source: "catalog" as const,
    }));
  },
  async preview() {
    return null;
  },
  async send(model: EmailComposerModel) {
    const to = emailsOf(model.recipients);
    const cc = emailsOf(model.cc);
    if (!to.length) {
      return {
        sent: 0,
        errors: [t("shipment.label_share.no_valid_recipients")],
      };
    }
    const r = await labelShareService.send(
      props.shipmentId,
      to,
      cc,
      docType.value,
    );
    if (r.success) {
      return { sent: to.length, errors: [] };
    }
    return {
      sent: 0,
      errors: [r.error ?? t("shipment.label_share.send_failed")],
    };
  },
}));

function onSent(res: { sent: number; errors: string[] }): void {
  if (res.sent > 0) {
    toasts.push(
      "success",
      t("shipment.label_share.sent_ok", { count: res.sent }),
    );
  } else {
    toasts.push(
      "error",
      res.errors[0] ?? t("shipment.label_share.send_failed"),
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
</style>
