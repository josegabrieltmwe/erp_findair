<template>
  <v-card variant="outlined" class="carrier-card" data-testid="carrier-files">
    <v-card-title class="carrier-card__title">{{ t("cargo.carrierOffer.files_title") }}</v-card-title>
    <v-card-text class="carrier-files">
      <section v-if="view.files.length">
        <h3 class="carrier-sub">{{ t("cargo.carrierOffer.shared_files") }}</h3>
        <ul class="carrier-filelist" data-testid="carrier-shared-files">
          <li v-for="f in view.files" :key="f.id">
            <v-icon icon="mdi-paperclip" size="16" />
            <a :href="links.sharedFile(f.id)" download>{{ f.name }}</a>
            <span class="carrier-filelist__size">{{ sizeLabel(f.size_kb) }}</span>
          </li>
        </ul>
      </section>

      <section>
        <h3 class="carrier-sub">{{ t("cargo.carrierOffer.own_files") }}</h3>
        <ul v-if="view.own_files.length" class="carrier-filelist" data-testid="carrier-own-files">
          <li v-for="f in view.own_files" :key="f.n">
            <v-icon icon="mdi-paperclip" size="16" />
            <a :href="links.ownFile(f.n)" download>{{ f.name }}</a>
          </li>
        </ul>
        <p v-else class="carrier-hint">{{ t("cargo.carrierOffer.no_files_hint", { max: view.upload.max_files }) }}</p>

        <template v-if="view.upload.can_upload">
          <input ref="picker" type="file" class="carrier-files__picker" :accept="accept" data-testid="carrier-file-input" @change="onPick" />
          <v-btn variant="outlined" size="small" prepend-icon="mdi-upload" :loading="uploading" :disabled="uploading" data-testid="carrier-add-file" @click="picker?.click()">
            {{ t("cargo.carrierOffer.add_file") }}
          </v-btn>
          <p class="carrier-hint">{{ t("cargo.carrierOffer.upload_hint", { types: view.upload.extensions.join(', '), mb: view.upload.max_kb / 1024 }) }}</p>
        </template>
        <v-alert v-if="message" type="error" variant="tonal" density="compact" class="mt-2" role="alert" data-testid="carrier-upload-error">{{ message }}</v-alert>
      </section>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError } from "@tmwe/shared-frontend/http";
import { carrierOfferLinks, carrierOfferService, type CarrierOfferView } from "@cargo/services/carrier_offer.service";
import { sizeLabel, uploadErrorKey, uploadProblem, extensionOf } from "@cargo/composables/carrierOfferFiles";

/**
 * Ficheros de la solicitud: los que el operador marcó para el transportista (solo descarga) y los de la propia aerolínea (hasta 4:
 * descarga y subida). La subida avisa antes de enviar (tipo, tamaño, número) y el servidor lo vuelve a comprobar, incluido el tipo real.
 */
const props = defineProps<{ view: CarrierOfferView }>();
const emit = defineEmits<{ (e: "uploaded"): void }>();
const { t } = useI18n();

const links = carrierOfferLinks;
const picker = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const message = ref("");
const accept = computed(() => props.view.upload.extensions.map((e) => `.${e}`).join(","));

async function onPick(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // permite volver a elegir el mismo fichero
  if (!file) return;
  message.value = "";
  const problem = uploadProblem(file, props.view.upload, props.view.own_files.length);
  if (problem) {
    message.value = t(`cargo.carrierOffer.${problem}`, { ext: extensionOf(file.name) || "—", mb: props.view.upload.max_kb / 1024, max: props.view.upload.max_files });
    return;
  }
  uploading.value = true;
  try {
    await carrierOfferService.uploadFile(file);
    emit("uploaded");
  } catch (e) {
    const err = e instanceof ApiError ? e : null;
    message.value = t(`cargo.carrierOffer.${uploadErrorKey(err?.errorCode, err?.status)}`, { ext: extensionOf(file.name) || "—", mb: props.view.upload.max_kb / 1024, max: props.view.upload.max_files });
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped lang="scss">
.carrier-card__title { font-size: 1rem; font-weight: 600; }
.carrier-files { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; }
.carrier-sub { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; margin: 0 0 8px; font-weight: 600; }
.carrier-filelist { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.carrier-filelist li { display: flex; align-items: center; gap: 8px; min-width: 0; }
.carrier-filelist a { overflow-wrap: anywhere; }
.carrier-filelist__size { opacity: 0.6; font-size: 0.8rem; white-space: nowrap; }
.carrier-hint { margin: 8px 0 0; font-size: 0.85rem; opacity: 0.7; }
.carrier-files__picker { display: none; }
</style>
