<template>
  <div class="hre">
    <!-- Barra de herramientas -->
    <div class="hre-toolbar">
      <v-btn
        v-for="b in BUTTONS"
        :key="b.cmd"
        :icon="b.icon"
        size="x-small"
        variant="text"
        :title="b.title"
        @mousedown.prevent
        @click="exec(b.cmd, b.value)"
      />

      <v-divider vertical class="mx-1" />

      <v-btn
        size="x-small"
        variant="text"
        :icon="mdiLinkVariant"
        :title="linkTitle"
        @mousedown.prevent
        @click="insertLink"
      />
      <v-btn
        size="x-small"
        variant="text"
        :icon="mdiFormatClear"
        :title="clearTitle"
        @mousedown.prevent
        @click="exec('removeFormat')"
      />

      <v-spacer />

      <!-- Marcadores: lo más pedido por quien redacta. -->
      <v-menu v-if="tokens.length" location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            size="x-small"
            variant="tonal"
            :prepend-icon="mdiCodeBraces"
          >
            {{ tokensLabel }}
          </v-btn>
        </template>
        <v-list density="compact" max-height="340">
          <v-list-item
            v-for="tk in tokens"
            :key="tk.token"
            @click="insertToken(tk.token)"
          >
            <v-list-item-title><code>{{ tk.token }}</code></v-list-item-title>
            <v-list-item-subtitle>{{ tk.desc }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!--
      Superficie editable. `v-html` inicial es intencionado y seguro aquí: el
      contenido lo escribe un operador autenticado con permiso de edición, es
      el mismo que ya está guardado, y el envío real lo sanea aparte.
      No se re-renderiza en cada pulsación (ver syncFromProp) para no mover
      el cursor mientras se escribe.
    -->
    <div
      ref="surface"
      class="hre-surface"
      contenteditable="true"
      spellcheck="false"
      @input="onInput"
      @blur="onInput"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import {
  mdiFormatBold,
  mdiFormatItalic,
  mdiFormatUnderline,
  mdiFormatListBulleted,
  mdiFormatListNumbered,
  mdiLinkVariant,
  mdiFormatClear,
  mdiCodeBraces,
} from '@mdi/js';

/** Marcador ofrecido en el desplegable. */
export interface EditorToken {
  token: string;
  desc: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    tokens?: EditorToken[];
    tokensLabel?: string;
    linkTitle?: string;
    clearTitle?: string;
  }>(),
  {
    tokens: () => [],
    tokensLabel: 'Marcadores',
    linkTitle: 'Insertar enlace',
    clearTitle: 'Quitar formato',
  },
);

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const surface = ref<HTMLDivElement | null>(null);

const BUTTONS: Array<{ cmd: string; icon: string; title: string; value?: string }> = [
  { cmd: 'bold', icon: mdiFormatBold, title: 'Negrita' },
  { cmd: 'italic', icon: mdiFormatItalic, title: 'Cursiva' },
  { cmd: 'underline', icon: mdiFormatUnderline, title: 'Subrayado' },
  { cmd: 'insertUnorderedList', icon: mdiFormatListBulleted, title: 'Lista' },
  { cmd: 'insertOrderedList', icon: mdiFormatListNumbered, title: 'Lista numerada' },
];

/**
 * Última cadena emitida. Permite distinguir un cambio que viene de fuera (hay
 * que repintar) de uno que produjo el propio usuario (no tocar el DOM, o el
 * cursor saltaría al principio en cada tecla).
 */
let lastEmitted = '';

function syncFromProp(): void {
  const el = surface.value;
  if (!el) return;
  if (props.modelValue === lastEmitted) return;
  if (el.innerHTML === props.modelValue) return;
  el.innerHTML = props.modelValue ?? '';
}

function onInput(): void {
  const el = surface.value;
  if (!el) return;
  lastEmitted = el.innerHTML;
  emit('update:modelValue', lastEmitted);
}

/**
 * document.execCommand está formalmente obsoleto, pero es la única API de
 * edición disponible sin añadir dependencias y sigue implementada en todos los
 * navegadores actuales. Se usa SOLO para formateo puntual sobre la selección:
 * no normaliza ni reescribe el resto del documento, que es justo lo que hacía
 * inviable un editor de modelo de documento aquí (285 de 336 plantillas son
 * HTML de email con tablas anidadas y estilos inline).
 */
function exec(cmd: string, value?: string): void {
  surface.value?.focus();
  document.execCommand(cmd, false, value);
  onInput();
}

function insertLink(): void {
  const url = window.prompt('URL:');
  if (!url) return;
  exec('createLink', url);
}

function insertToken(token: string): void {
  surface.value?.focus();
  // insertText respeta la posición del cursor y no interpreta HTML, así que
  // el marcador entra como texto literal.
  document.execCommand('insertText', false, token);
  onInput();
}

onMounted(syncFromProp);
watch(() => props.modelValue, syncFromProp);
</script>

<style scoped>
.hre {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.22);
  border-radius: 8px;
  overflow: hidden;
}

.hre-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.hre-surface {
  min-height: 320px;
  max-height: 460px;
  overflow: auto;
  padding: 12px;
  outline: none;
  background: #fff;
  color: #222;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  line-height: 1.5;
}

/* Las plantillas traen tablas de maquetación sin bordes; se marcan en tenue
   solo dentro del editor para que se vea la estructura al redactar. */
.hre-surface :deep(table) {
  border-collapse: collapse;
  max-width: 100%;
}

.hre-surface :deep(td),
.hre-surface :deep(th) {
  outline: 1px dashed rgba(0, 0, 0, 0.12);
}

.hre-surface :deep(img) {
  max-width: 100%;
}
</style>
