<template>
  <!--
    Menú ÚNICO de comunicación del servicio: agrupa los dos canales por los que
    se pide precio (couriers vía RFQ, partners vía oferta).

    Sustituye a los dos desplegables anteriores, que repetían el mismo patrón
    —«enviar» + «ver respuestas» + badge— y ocupaban el doble de espacio para
    una estructura idéntica.

    Vive DENTRO de ServizioCard, no en la barra superior (a diferencia de
    cargo): lo que se cotiza es el servicio del proveedor que esta card muestra,
    con su coste y su estado. Sacarlo a la barra habría roto el contexto que
    justifica la acción, sin ganar espacio — aquí no hay card que eliminar.
  -->
  <v-badge
    :model-value="pendingCount > 0"
    :content="pendingCount"
    color="warning"
    offset-x="6"
    offset-y="6"
    :title="t('shipment.quote_menu.pending_hint', { n: pendingCount })"
  >
    <v-menu location="bottom start">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          variant="tonal"
          color="info"
          size="small"
          rounded="lg"
          prepend-icon="mdi-email-fast-outline"
          append-icon="mdi-chevron-down"
          :disabled="disabled"
        >
          {{ t("shipment.quote_menu.label") }}
        </v-btn>
      </template>

      <v-list density="compact" min-width="270">
        <!-- ── Couriers ─────────────────────────────────────────────── -->
        <v-list-subheader>{{ t("shipment.rfq.menu_label") }}</v-list-subheader>
        <v-list-item
          prepend-icon="mdi-email-arrow-right-outline"
          :title="t('shipment.rfq.open_button')"
          @click="emit('send-rfq')"
        />
        <v-list-item
          prepend-icon="mdi-email-check-outline"
          :disabled="rfqTotal === 0"
          :title="t('shipment.rfq.view_replies')"
          @click="emit('view-rfq')"
        >
          <template v-if="rfqTotal" #append>
            <v-chip size="x-small" variant="tonal" :color="rfqColor">
              {{ rfqReplied }}/{{ rfqTotal }}
            </v-chip>
          </template>
        </v-list-item>

        <v-divider class="my-1" />

        <!-- ── Partners ─────────────────────────────────────────────── -->
        <v-list-subheader>
          {{ t("shipment.partner_offer.menu_label") }}
        </v-list-subheader>
        <v-list-item
          prepend-icon="mdi-account-arrow-right-outline"
          :title="t('shipment.partner_offer.open_button')"
          @click="emit('send-partner')"
        />
        <v-list-item
          prepend-icon="mdi-email-check-outline"
          :disabled="partnerTotal === 0"
          :title="t('shipment.partner_offer.view_replies')"
          @click="emit('view-partner')"
        >
          <template v-if="partnerTotal" #append>
            <v-chip size="x-small" variant="tonal" :color="partnerColor">
              {{ partnerReplied }}/{{ partnerTotal }}
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-badge>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  disabled?: boolean;
  /** Solicitudes enviadas a couriers y cuántas han contestado. */
  rfqTotal: number;
  rfqReplied: number;
  /** Ofertas enviadas a partners y cuántas han contestado. */
  partnerTotal: number;
  partnerReplied: number;
}>();

const emit = defineEmits<{
  "send-rfq": [];
  "send-partner": [];
  "view-rfq": [];
  "view-partner": [];
}>();

const { t } = useI18n();

/**
 * Pendientes = enviadas sin contestar, sumando ambos canales. Es el número que
 * exige acción; el badge lo muestra en `warning` porque señala espera, no logro
 * (los contadores por canal usan `success` cuando ya contestaron todas).
 */
const pendingCount = computed(
  () =>
    Math.max(0, props.rfqTotal - props.rfqReplied) +
    Math.max(0, props.partnerTotal - props.partnerReplied),
);

const rfqColor = computed(() =>
  props.rfqReplied >= props.rfqTotal ? "success" : "primary",
);
const partnerColor = computed(() =>
  props.partnerReplied >= props.partnerTotal ? "success" : "primary",
);
</script>
