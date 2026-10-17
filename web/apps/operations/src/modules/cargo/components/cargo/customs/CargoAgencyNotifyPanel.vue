<template>
  <!--
    Panel de "Notificar agencias de aduanas" — extraído de CargoMailAgenzieDialog
    para vivir como TAB dentro del modal de aduanas (todo el trabajo de aduanas
    concentrado en un punto). Sin wrapper de diálogo: solo el formulario + botón.
  -->
  <div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      {{ t("cargo.mailag.intro") }}
    </p>
    <v-row dense>
      <v-col cols="12" class="mb-2">
        <v-btn-toggle
          v-model="agencyType"
          mandatory
          density="comfortable"
          color="primary"
          variant="outlined"
          divided
        >
          <v-btn value="B" prepend-icon="mdi-email-multiple-outline">
            {{ t("cargo.mailag.both") }}
          </v-btn>
          <v-btn value="E" prepend-icon="mdi-airplane-takeoff">
            {{ t("cargo.mailag.export_only") }}
          </v-btn>
          <v-btn value="I" prepend-icon="mdi-airplane-landing">
            {{ t("cargo.mailag.import_only") }}
          </v-btn>
        </v-btn-toggle>
      </v-col>
      <v-col cols="12">
        <v-text-field
          :model-value="exportMail"
          :label="t('cargo.mailag.export_email')"
          prepend-inner-icon="mdi-email-outline"
          variant="plain"
          density="compact"
          disabled
        />
      </v-col>
      <v-col cols="12">
        <v-text-field
          :model-value="importMail"
          :label="t('cargo.mailag.import_email')"
          prepend-inner-icon="mdi-email-outline"
          variant="plain"
          density="compact"
          disabled
        />
      </v-col>
      <v-col cols="12">
        <!-- CC vía el RecipientPicker compartido: contactos del cliente +
             emails manuales (paridad "manuales+CC siempre"). -->
        <RecipientPicker
          v-model="ccList"
          :audience="ccAudience"
          :loading="customsStore.loadingRecipients"
          :allow-manual="true"
          :label="t('cargo.mailag.cc_label')"
          :hint="t('cargo.mailag.hint')"
        />
      </v-col>
    </v-row>

    <div class="d-flex justify-end mt-4">
      <v-btn
        color="primary"
        variant="flat"
        rounded="lg"
        class="text-none"
        prepend-icon="mdi-email-fast-outline"
        :disabled="!cargoId || !hasSelectedRecipient"
        :loading="sending"
        @click="sendAll"
      >
        {{ t("cargo.mailag.send") }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, computed, watch, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCustomsStore } from "@cargo/stores/customs.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { http } from "@cargo/services/http";
import { RecipientPicker } from "@shared/email";
import type { Recipient } from "@shared/email";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const toasts = useToastStore();
const customsStore = useCustomsStore();

const cargoId = computed<number | null>(() =>
  store.id ? Number(store.id) : null,
);

const sending = ref(false);
const exportMail = computed(() => cargo.value?.export_ag_mail ?? "");
const importMail = computed(() => cargo.value?.import_ag_mail ?? "");

// B=both (default, paridad legacy), E=export, I=import.
const agencyType = ref<"B" | "E" | "I">("B");
const ccList = ref<Recipient[]>([]);

/** Audiencia elegible del CC = contactos del cliente (customs store). */
const ccAudience = computed<Recipient[]>(() =>
  customsStore.recipients.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    source: "catalog" as const,
  })),
);

const hasSelectedRecipient = computed(() => {
  if (agencyType.value === "E") return !!exportMail.value;
  if (agencyType.value === "I") return !!importMail.value;
  return !!exportMail.value || !!importMail.value;
});

// Cargar destinatarios (contactos del cliente) al montar / cambiar de cargo.
onMounted(() => {
  if (cargoId.value) void customsStore.fetchRecipients(cargoId.value);
});
watch(cargoId, (id) => {
  if (id) void customsStore.fetchRecipients(id);
});

async function sendAll(): Promise<void> {
  if (!cargoId.value) return;
  sending.value = true;
  try {
    const ccEmails = ccList.value
      .map((r) => (r.email ?? "").trim())
      .filter((e) => e.includes("@"));

    const res = await http<{ success: boolean; error?: string }>(
      "/api_notification_trigger",
      {
        method: "POST",
        body: {
          type: "agency",
          entity_id: cargoId.value,
          agency_type: agencyType.value,
          ...(ccEmails.length > 0 ? { recipients: ccEmails } : {}),
        },
      },
    );

    if (res.success) {
      toasts.push("success", t("cargo.mailag.dispatched"));
      // Refresca el cargo para ver los timestamps data_mail_ag_export/import.
      try {
        await store.load(cargoId.value);
      } catch {
        /* swallow */
      }
    } else {
      toasts.push("error", res.error ?? t("cargo.mailag.dispatch_failed"));
    }
  } catch (err) {
    toasts.push("error", (err as Error).message);
  } finally {
    sending.value = false;
  }
}
</script>
