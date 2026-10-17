<template>
  <FilesBox
    :ext="ext"
    :int="int"
    :loading="filesStore.loading"
    :uploading="filesStore.uploading"
    :download-url="
      (f) => filesStore.downloadUrl(Number(id ?? 0), f as unknown as CargoFile)
    "
    :on-upload="onUpload"
    :on-remove="onRemove"
    :on-toggle-visibility="onToggleVisibility"
  />
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import FilesBox, {
  type FileScope,
  type FileRecipient,
} from "@shared/detail/FilesBox.vue";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoFilesStore } from "@cargo/stores/files.store";
import type { CargoFile } from "@cargo/services/files.service";

const { id } = storeToRefs(useCargoStore());
const filesStore = useCargoFilesStore();
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

watch(
  id,
  (newId) => {
    if (newId) void filesStore.refreshAll(Number(newId));
  },
  { immediate: true },
);
onMounted(() => {
  if (id.value) void filesStore.refreshAll(Number(id.value));
});
</script>
