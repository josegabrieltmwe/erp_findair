<template>
  <FilesBox
    :ext="ext"
    :int="int"
    :loading="filesStore.loading"
    :uploading="filesStore.uploading"
    :download-url="
      (f) =>
        filesStore.downloadUrl(Number(id ?? 0), f as unknown as ShipmentFileRow)
    "
    :on-upload="onUpload"
    :on-remove="onRemove"
    :on-toggle-visibility="onToggleVisibility"
  />
</template>

<script setup lang="ts">
import { watch } from "vue";
import { storeToRefs } from "pinia";
import FilesBox, {
  type FileScope,
  type FileRecipient,
} from "@shared/detail/FilesBox.vue";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentFilesStore } from "@shipment/stores/files.store";
import type { ShipmentFileRow } from "@shipment/services/files.service";

const { id } = storeToRefs(useShipmentStore());
const filesStore = useShipmentFilesStore();
const { ext, int } = storeToRefs(filesStore);

async function onUpload(list: File[], scope: FileScope): Promise<void> {
  if (!id.value) return;
  for (const f of list) await filesStore.upload(Number(id.value), f, "", scope);
}
async function onRemove(fileId: number, scope: FileScope): Promise<void> {
  if (!id.value) return;
  await filesStore.remove(Number(id.value), fileId, scope);
}
async function onToggleVisibility(
  fileId: number,
  r: FileRecipient,
  visible: boolean,
): Promise<void> {
  if (!id.value) return;
  await filesStore.setVisibility(Number(id.value), fileId, r, visible);
}

// `immediate: true` already fires on mount, so a separate onMounted would
// double every file fetch (refreshAll = ext + int → 4 requests instead of 2).
watch(
  id,
  (newId) => {
    if (newId) void filesStore.refreshAll(Number(newId));
  },
  { immediate: true },
);
</script>
