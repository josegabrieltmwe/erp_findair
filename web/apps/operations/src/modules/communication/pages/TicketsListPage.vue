<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { useCommunicationStore } from "../stores/communication.store";
import { useCommStream } from "../composables/useCommStream";
import NewTicketDialog from "../components/NewTicketDialog.vue";
import type { Conversation, ConversationStatusFilter } from "../types";

const store = useCommunicationStore();
const router = useRouter();
const { t } = useI18n();

const showNewTicket = ref(false);
const search = ref("");

const headers = computed(() => [
  { title: t("communication.list.subject"), key: "subject" },
  { title: t("communication.list.contact"), key: "contact", width: 180 },
  { title: t("communication.list.opened_at"), key: "opened_at", width: 110 },
  { title: t("communication.list.status"), key: "is_open", width: 100, align: "center" as const },
  { title: "", key: "unread_count", width: 60, sortable: false, align: "center" as const },
]);

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

function openThread(_evt: unknown, row: { item: Conversation }): void {
  const idNum = row.item.id.split(":")[1];
  router.push({ name: "communication-thread", params: { id: idNum } });
}

function onCreated(conversation: Conversation): void {
  const idNum = conversation.id.split(":")[1];
  router.push({ name: "communication-thread", params: { id: idNum } });
}

function refresh(): void {
  void store.setSearch(search.value);
}

function onStatusChange(next: ConversationStatusFilter): void {
  void store.setStatus(next);
}

function onTableOptions(opts: { page: number }): void {
  if (opts.page !== store.page) void store.setPage(opts.page);
}

const { start, stop } = useCommStream({
  onMessageCreated: store.applyMessageCreated,
  onUnreadChanged: store.applyUnreadChanged,
  onConversationClosed: store.applyConversationClosed,
});

let hasMountedOnce = false;

onMounted(() => {
  hasMountedOnce = true;
  void store.fetchList();
  void start();
});

// KeepAlive (ver OperationsShell.vue KEEP_ALIVE_INCLUDE): volver del hilo no
// remonta esta página — igual que CrmListPage.
onActivated(() => {
  if (!hasMountedOnce) return;
  void store.fetchList();
});

onUnmounted(stop);
</script>

<template>
  <div class="communication-list pa-4">
    <div class="d-flex align-center mb-4">
      <h2 class="text-h5">{{ t("communication.list.title") }}</h2>
      <v-chip v-if="store.unreadTotal > 0" class="ml-3" color="error" size="small" label>
        {{ t("communication.list.unread_total", { n: store.unreadTotal }) }}
      </v-chip>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showNewTicket = true">
        {{ t("communication.list.new_ticket") }}
      </v-btn>
    </div>

    <v-card>
      <v-card-text>
        <div class="d-flex flex-wrap ga-3 mb-2">
          <v-text-field
            v-model="search"
            :label="t('communication.list.search')"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 280px"
            @keyup.enter="refresh"
            @click:clear="refresh"
          >
            <template #append-inner>
              <v-icon icon="mdi-magnify" style="cursor: pointer" @click="refresh" />
            </template>
          </v-text-field>
          <v-select
            :model-value="store.filters.status ?? 'open'"
            :items="[
              { title: t('communication.status.open'), value: 'open' },
              { title: t('communication.status.closed'), value: 'closed' },
              { title: t('communication.status.all'), value: 'all' },
            ]"
            :label="t('communication.list.status')"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 180px"
            @update:model-value="onStatusChange"
          />
        </div>
      </v-card-text>

      <v-data-table-server
        :headers="headers"
        :items="store.items"
        :items-length="store.total"
        :loading="store.loadingList"
        :page="store.page"
        :items-per-page="store.perPage"
        item-value="id"
        hover
        @click:row="openThread"
        @update:options="onTableOptions"
      >
        <template #[`item.subject`]="{ item }">
          <span class="font-weight-medium">{{ item.subject || `#${item.id}` }}</span>
          <div class="text-caption text-medium-emphasis">
            {{ item.last_message?.body_preview ?? "" }}
          </div>
        </template>

        <template #[`item.contact`]="{ item }">
          {{ item.contact?.name ?? "" }}
        </template>

        <template #[`item.opened_at`]="{ item }">
          {{ fmtDate(item.opened_at) }}
        </template>

        <template #[`item.is_open`]="{ item }">
          <v-chip :color="item.is_open ? 'success' : 'grey'" size="small" label>
            {{ item.is_open ? t("communication.status.open") : t("communication.status.closed") }}
          </v-chip>
        </template>

        <template #[`item.unread_count`]="{ item }">
          <v-badge v-if="item.unread_count > 0" :content="item.unread_count" color="error" inline />
        </template>
      </v-data-table-server>
    </v-card>

    <NewTicketDialog v-model="showNewTicket" @created="onCreated" />
  </div>
</template>
