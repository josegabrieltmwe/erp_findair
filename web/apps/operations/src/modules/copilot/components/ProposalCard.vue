<template>
  <v-card
    class="proposal-card mt-2"
    variant="outlined"
    :color="card.reinforced.value ? 'error' : undefined"
    data-testid="proposal-card"
  >
    <v-card-title class="d-flex align-center flex-wrap ga-2 text-subtitle-1">
      <v-icon :icon="icon" size="20" />
      <span>{{ t(`copilot.proposal.actions.${proposal.action}`) }}</span>
      <v-spacer />
      <v-chip
        size="x-small"
        :color="proposal.risk === 'high' ? 'error' : 'warning'"
        variant="flat"
      >
        {{ t(`copilot.proposal.risk.${proposal.risk}`) }}
      </v-chip>
      <v-chip v-if="proposal.draft" size="x-small" variant="tonal">
        {{ t("copilot.proposal.draft") }}
      </v-chip>
    </v-card-title>

    <v-card-text class="pt-0">
      <div class="text-caption text-medium-emphasis mb-2">
        {{ t(`copilot.proposal.kind.${proposal.target.kind}`) }}
      </div>

      <dl class="rows">
        <template v-for="(row, i) in card.rows.value" :key="i">
          <dt>
            {{
              row.labelKey
                ? t(`copilot.proposal.fields.${row.labelKey}`)
                : row.label
            }}
          </dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>

      <dl v-if="proposal.costs?.length" class="rows mt-2">
        <template v-for="(cost, i) in proposal.costs" :key="`c${i}`">
          <dt>{{ cost.label || t("copilot.proposal.fields.cost") }}</dt>
          <dd>{{ cost.amount }} {{ cost.currency ?? "" }}</dd>
        </template>
      </dl>

      <!-- Reinforced confirmation (cancels): a second, explicit gesture. -->
      <v-checkbox
        v-if="card.reinforced.value && card.open.value"
        v-model="card.acknowledged.value"
        density="compact"
        hide-details
        color="error"
        :label="
          t('copilot.proposal.reinforced_ack', {
            target: card.targetName.value,
          })
        "
        data-testid="proposal-ack"
      />

      <!-- Real state of the operation -->
      <v-alert
        v-if="statusAlert"
        class="mt-3"
        density="compact"
        variant="tonal"
        :type="statusAlert.type"
        data-testid="proposal-status"
      >
        {{ statusAlert.text }}
      </v-alert>
    </v-card-text>

    <v-card-actions v-if="view.status !== 'dismissed'">
      <span
        v-if="card.open.value"
        class="text-caption ml-2"
        :class="card.expired.value ? 'text-error' : 'text-medium-emphasis'"
        data-testid="proposal-countdown"
      >
        {{
          card.expired.value
            ? t("copilot.proposal.expired")
            : t("copilot.proposal.expires_in", { time: card.countdown.value })
        }}
      </span>
      <v-spacer />
      <v-btn
        v-if="card.open.value || view.status === 'confirming'"
        variant="text"
        :disabled="view.status === 'confirming'"
        data-testid="proposal-dismiss"
        @click="store.dismiss(bubbleId)"
      >
        {{ t("copilot.proposal.dismiss") }}
      </v-btn>
      <v-btn
        v-if="card.open.value || view.status === 'confirming'"
        :color="card.reinforced.value ? 'error' : 'primary'"
        variant="flat"
        :loading="view.status === 'confirming'"
        :disabled="!card.canConfirm.value || view.status === 'confirming'"
        data-testid="proposal-confirm"
        @click="store.confirm(bubbleId, card.acknowledged.value)"
      >
        {{
          view.status === "error"
            ? t("copilot.proposal.retry")
            : t("copilot.proposal.confirm")
        }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useChatStore } from "../stores/chat.store";
import { useProposalCard } from "../composables/useProposalCard";
import type { ProposalView } from "../types";

const props = defineProps<{ bubbleId: number; view: ProposalView }>();
const { t } = useI18n();
const store = useChatStore();

const proposal = computed(() => props.view.proposal);
const card = useProposalCard(() => props.view);

const icon = computed(() =>
  proposal.value.action.startsWith("cancel_")
    ? "mdi-close-octagon-outline"
    : proposal.value.action === "edit_cargo"
      ? "mdi-pencil-outline"
      : "mdi-package-variant-plus",
);

type AlertType = "success" | "warning" | "error" | "info";

/** Only `verified` is shown as done; every other state states what really happened. */
const statusAlert = computed<{ type: AlertType; text: string } | null>(() => {
  const v = props.view;
  const o = v.outcome;
  switch (v.status) {
    case "verified":
      return {
        type: "success",
        text:
          o?.createdId !== undefined
            ? t("copilot.proposal.status.verified_created", { id: o.createdId })
            : t("copilot.proposal.status.verified"),
      };
    case "unverified":
      return {
        type: "warning",
        text: t("copilot.proposal.status.unverified", {
          fields: (o?.notCompared ?? []).join(", ") || "-",
        }),
      };
    case "mismatch":
      return { type: "error", text: t("copilot.proposal.status.mismatch") };
    case "rejected":
      return {
        type: "error",
        text: t("copilot.proposal.status.rejected", {
          error: o?.error ?? t("copilot.proposal.status.no_detail"),
        }),
      };
    case "dismissed":
      return { type: "info", text: t("copilot.proposal.status.dismissed") };
    case "error":
      return {
        type: "error",
        text: t(`copilot.proposal.errors.${v.errorKind ?? "unknown"}`),
      };
    default:
      return null;
  }
});
</script>

<style scoped>
.proposal-card {
  white-space: normal;
  max-width: 100%;
}
.rows {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 12px;
  margin: 0;
}
.rows dt {
  opacity: 0.7;
  font-size: 12px;
}
.rows dd {
  margin: 0;
  word-break: break-word;
}
</style>
