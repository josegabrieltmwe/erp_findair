<template>
  <EntityNewPage
    entity-label="cargo"
    icon="mdi-airplane-plus"
    :search-clients="searchClients"
    :create-fn="createFn"
    :build-detail-path="(id) => detailHref('cargo', id)"
  />
</template>

<script setup lang="ts">
import EntityNewPage from "@shared/detail/EntityNewPage.vue";
import { detailHref } from "@shared/platform/navTargets";
import {
  toClientOptions,
  type ClientOption,
} from "@tmwe/shared-frontend/composables/useEntityCreate";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { anagraficaService } from "@cargo/services/anagrafica.service";

const store = useCargoStore();

async function searchClients(text: string): Promise<ClientOption[]> {
  return toClientOptions(await anagraficaService.search(text));
}

// Cargo needs only the client to create a draft (backend fills the rest).
function createFn(customerId: number): Promise<number | null> {
  return store.create(customerId);
}
</script>
