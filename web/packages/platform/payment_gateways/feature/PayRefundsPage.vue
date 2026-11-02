<template>
  <div>
    <CmSectionHeader :title="t('pay_refunds.title')" :subtitle="t('pay_refunds.subtitle')" />

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4" data-testid="refund-load-error">{{ loadError }}</v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="text-subtitle-2 mb-1">{{ t('pay_refunds.awaiting_title') }}</div>
      <div class="text-body-2 cm-cell-hint mb-3">{{ t('pay_refunds.awaiting_hint') }}</div>
      <v-table density="compact" data-testid="refund-awaiting">
        <thead>
          <tr>
            <th>{{ t('pay_refunds.col_refund') }}</th>
            <th class="text-right">{{ t('pay_refunds.col_amount') }}</th>
            <th>{{ t('pay_refunds.col_reason') }}</th>
            <th>{{ t('pay_refunds.col_requested_by') }}</th>
            <th>{{ t('pay_refunds.col_created') }}</th>
            <th class="text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && !awaiting.length">
            <td colspan="6" class="text-center cm-cell-hint py-4">{{ t('pay_refunds.awaiting_empty') }}</td>
          </tr>
          <tr v-for="r in awaiting" :key="r.id" :data-testid="`refund-row-${r.id}`">
            <td class="cm-mono">{{ r.id }}</td>
            <td class="text-right">{{ formatMinor(r.amount_minor) }}</td>
            <td>{{ t(`pay_refunds.reason_${r.reason}`) }}</td>
            <td>#{{ r.requested_by }}</td>
            <td class="cm-cell-hint">{{ r.created_at }}</td>
            <td class="text-right">
              <v-btn size="small" color="primary" variant="flat" class="mr-1" :loading="busy === r.id" data-testid="refund-approve" @click="approve(r)">
                {{ t('pay_refunds.approve') }}
              </v-btn>
              <v-btn size="small" variant="text" color="error" :disabled="busy === r.id" data-testid="refund-reject" @click="reject(r)">
                {{ t('pay_refunds.reject') }}
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="text-subtitle-2 mb-1">{{ t('pay_refunds.review_title') }}</div>
      <div class="text-body-2 cm-cell-hint mb-3">{{ t('pay_refunds.review_hint') }}</div>
      <v-table density="compact" data-testid="refund-review">
        <thead>
          <tr>
            <th>{{ t('pay_refunds.col_payment') }}</th>
            <th>{{ t('pay_refunds.col_installment') }}</th>
            <th class="text-right">{{ t('pay_refunds.col_amount') }}</th>
            <th>{{ t('pay_refunds.col_payment_status') }}</th>
            <th>{{ t('pay_refunds.col_reversed') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && !review.length">
            <td colspan="5" class="text-center cm-cell-hint py-4">{{ t('pay_refunds.review_empty') }}</td>
          </tr>
          <tr v-for="i in review" :key="`${i.payment_id}-${i.installment_id}`">
            <td class="cm-mono">{{ i.payment_public_id }}</td>
            <td>#{{ i.installment_id }}</td>
            <td class="text-right">{{ formatMinor(i.amount_minor) }}</td>
            <td>{{ i.payment_status }}</td>
            <td class="cm-cell-hint">{{ i.reversed_at }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { payRefunds, type PayInstallmentReview, type PayRefund } from '../services/paymentGateways.service';

/**
 * Reembolsos. Un reembolso grande espera a que lo apruebe OTRA persona (la API lo exige: quien lo pidió recibe 403).
 * Abajo, las cuotas cuyo cobro se revirtió y siguen cerradas: se reabren a mano, no automáticamente.
 */
const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const awaiting = ref<PayRefund[]>([]);
const review = ref<PayInstallmentReview[]>([]);
const loading = ref(false);
const loadError = ref('');
const busy = ref('');

/** Unidades menores → texto (todas las divisas admitidas tienen 2 decimales). */
function formatMinor(minor: number): string {
  return (minor / 100).toFixed(2);
}
function errMsg(e: unknown): string {
  return e instanceof Error && e.message ? e.message : t('pay_refunds.error_generic');
}

async function reload(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    [awaiting.value, review.value] = await Promise.all([payRefunds.listAwaitingApproval(), payRefunds.installmentsReview()]);
  } catch (e) {
    loadError.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

async function approve(r: PayRefund): Promise<void> {
  const ok = await confirm.ask({
    title: t('pay_refunds.confirm_approve_title'),
    message: t('pay_refunds.confirm_approve_message', { amount: formatMinor(r.amount_minor) }),
    confirmLabel: t('pay_refunds.approve'),
  });
  if (!ok) return;
  busy.value = r.id;
  try {
    await payRefunds.approve(r.id);
    toast.success(t('pay_refunds.approved'));
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    busy.value = '';
    await reload();
  }
}

async function reject(r: PayRefund): Promise<void> {
  const ok = await confirm.ask({
    title: t('pay_refunds.confirm_reject_title'),
    message: t('pay_refunds.confirm_reject_message', { amount: formatMinor(r.amount_minor) }),
    variant: 'danger',
    confirmLabel: t('pay_refunds.reject'),
  });
  if (!ok) return;
  busy.value = r.id;
  try {
    await payRefunds.reject(r.id);
    toast.success(t('pay_refunds.rejected'));
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    busy.value = '';
    await reload();
  }
}

onMounted(reload);
</script>
