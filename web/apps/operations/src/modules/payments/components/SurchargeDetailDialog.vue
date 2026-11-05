<template>
  <v-dialog :model-value="modelValue" max-width="620" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <v-card v-if="surcharge">
      <v-card-title class="d-flex align-center ga-2 text-subtitle-1">
        <span>{{ surcharge.public_id }}</span>
        <v-chip :color="statusColor(surcharge.status)" size="small" label variant="tonal">
          {{ t(`payments.surcharges.status.${surcharge.status}`) }}
        </v-chip>
      </v-card-title>

      <v-card-text>
        <v-table density="compact" data-testid="surcharge-detail">
          <tbody>
            <tr>
              <th>{{ t("payments.list.customer") }}</th>
              <td>{{ surcharge.customer_name || '' }} <span class="text-medium-emphasis">#{{ surcharge.customer_id }}</span></td>
            </tr>
            <tr>
              <th>{{ t("payments.surcharges.col.type") }}</th>
              <td>{{ t(`payments.surcharges.type.${surcharge.surcharge_type}`) }}</td>
            </tr>
            <tr>
              <th>{{ t("payments.surcharges.col.amount") }}</th>
              <td><strong>{{ formatMinor(surcharge.amount_minor, surcharge.currency) }}</strong></td>
            </tr>
            <tr v-if="surcharge.declared_value || surcharge.measured_value">
              <th>{{ t("payments.surcharges.detail.measures") }}</th>
              <td>{{ surcharge.declared_value || "—" }} → {{ surcharge.measured_value || "—" }}</td>
            </tr>
            <tr v-if="surcharge.carrier_ref">
              <th>{{ t("payments.surcharges.detail.carrier_ref") }}</th>
              <td>{{ surcharge.carrier_ref }}</td>
            </tr>
            <tr>
              <th>{{ t("payments.surcharges.detail.evidence") }}</th>
              <td class="surcharge-evidence">{{ surcharge.evidence }}</td>
            </tr>
            <tr>
              <th>{{ t("payments.surcharges.detail.created_at") }}</th>
              <td>{{ surcharge.created_at || "—" }}</td>
            </tr>
            <tr>
              <th>{{ t("payments.surcharges.detail.notified_at") }}</th>
              <td>{{ surcharge.notified_at || "—" }}</td>
            </tr>
            <tr>
              <th>{{ t("payments.surcharges.col.notice_due") }}</th>
              <td>{{ surcharge.notice_due_at || "—" }}</td>
            </tr>
            <tr>
              <th>{{ t("payments.surcharges.col.dispute_until") }}</th>
              <td>{{ surcharge.dispute_until || "—" }}</td>
            </tr>
            <!-- Impugnación: quién, cuándo y por qué (lo que el vendedor debe resolver). -->
            <tr v-if="surcharge.disputed_at || surcharge.disputed_reason" data-testid="detail-dispute">
              <th>{{ t("payments.surcharges.detail.dispute") }}</th>
              <td>
                <div>{{ surcharge.disputed_at || "—" }}</div>
                <div class="text-medium-emphasis">{{ surcharge.disputed_reason || "—" }}</div>
              </td>
            </tr>
            <tr v-if="surcharge.waived_reason">
              <th>{{ t("payments.surcharges.detail.waived_reason") }}</th>
              <td>{{ surcharge.waived_reason }}</td>
            </tr>
            <!-- Liquidación: interna del vendedor; nunca llega al cliente final. -->
            <tr v-if="surcharge.account_source">
              <th>{{ t("payments.surcharges.detail.account_source") }}</th>
              <td>{{ t(`payments.surcharges.detail.source.${surcharge.account_source === 'tmwe_fallback' ? 'tmwe_fallback' : 'partner'}`) }}</td>
            </tr>
            <tr v-if="pendingSettlement">
              <th>{{ t("payments.surcharges.detail.settlement") }}</th>
              <td>{{ t("payments.surcharges.detail.settlement_pending") }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{ t("common.close") }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Detalle de solo lectura de un recargo para el personal: importe, medidas declaradas y medidas, evidencia, plazos
 * (preaviso e impugnación), la impugnación del cliente (fecha y motivo), el perdón (motivo) y, solo para el vendedor, quién
 * cobró (cuenta propia o respaldo de TMWE) y si falta transferir. Es el lugar donde se ve el «estado / impugnaciones».
 *
 * No ejecuta acciones (eso es `SurchargeActionDialog`). No muestra jamás referencias del proveedor, comisión ni coste:
 * la API no las envía al personal en este recurso. Props: `modelValue` (abrir/cerrar) y `surcharge` (la fila ya cargada).
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { PaySurcharge } from "@shared/payment_gateways/services/paymentGateways.service";
import { formatMinor, needsSettlement, statusColor } from "./surchargesModel";

const props = defineProps<{ modelValue: boolean; surcharge: PaySurcharge | null }>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const { t } = useI18n();
const pendingSettlement = computed(() => (props.surcharge ? needsSettlement(props.surcharge) : false));
</script>

<style scoped>
.surcharge-evidence {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
