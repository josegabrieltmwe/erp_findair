import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import {
  describeProposal,
  formatCountdown,
  remainingSeconds,
  targetLabel,
} from "../services/proposal";
import type { ProposalView } from "../types";

/**
 * Logic of ProposalCard (countdown, second gesture, rows) without DOM so it is unit-testable.
 * The countdown is relative to when the proposal reached the browser (`receivedAt`), never to the clock
 * of the server, and ticks once per second only while the card can still be confirmed.
 */
export function useProposalCard(
  view: () => ProposalView,
  now: () => number = Date.now,
) {
  const tick = ref(now());
  const acknowledged: Ref<boolean> = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  const open = computed(() => {
    const v = view();
    return v.status === "pending" || (v.status === "error" && !!v.retryable);
  });
  const remaining = computed(() => {
    const v = view();
    return remainingSeconds(v.receivedAt, v.proposal.expires_in, tick.value);
  });
  const expired = computed(() => remaining.value <= 0);
  const countdown = computed(() => formatCountdown(remaining.value));
  const reinforced = computed(() => view().proposal.reinforced_confirmation);
  const rows = computed(() => describeProposal(view().proposal));
  const targetName = computed(() => targetLabel(view().proposal));
  const canConfirm = computed(
    () =>
      open.value && !expired.value && (!reinforced.value || acknowledged.value),
  );

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }
  function start(): void {
    if (timer !== null) return;
    tick.value = now();
    timer = setInterval(() => {
      tick.value = now();
      if (remaining.value <= 0) stop();
    }, 1000);
  }

  watch(
    () => open.value && !expired.value,
    (running) => (running ? start() : stop()),
    { immediate: true },
  );
  onScopeDispose(stop);

  return {
    remaining,
    countdown,
    expired,
    open,
    reinforced,
    acknowledged,
    canConfirm,
    rows,
    targetName,
  };
}
