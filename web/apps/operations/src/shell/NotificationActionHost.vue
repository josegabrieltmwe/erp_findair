<template>
  <!--
    Puente entre la campana y los diálogos de la app.

    La campana vive en `packages/platform` y NO puede conocer los diálogos de
    cada módulo: emite `tmwe:notification-action` con el nombre del modal y sus
    parámetros. Este host, que sí vive dentro de operations, lo escucha y monta
    el diálogo que toque.

    Sin esto el botón "Solicitar AWB" de una notificación marcaba leído y
    cerraba el panel sin abrir nada.

    Vive en el shell (no en la página de cargo) porque una notificación se
    abre desde CUALQUIER pantalla de la SPA: el operario puede estar en la
    lista de expediciones y pulsar un aviso de stock AWB.
  -->
  <CargoAwbRequestDialog
    v-if="awbRequest.open"
    v-model="awbRequest.open"
    :id-vettore="awbRequest.idVettore"
    :partner-id="awbRequest.partnerId"
    :carrier-label="awbRequest.carrierLabel"
    :carrier-mail="awbRequest.carrierMail"
  />
</template>

<script setup lang="ts">
import { reactive, onMounted, onBeforeUnmount } from "vue";
import CargoAwbRequestDialog from "@cargo/components/cargo/awb/CargoAwbRequestDialog.vue";

interface ActionDetail {
  modal?: string;
  params?: Record<string, unknown>;
  notification_id?: number;
}

const awbRequest = reactive({
  open: false,
  idVettore: 0,
  partnerId: 0,
  carrierLabel: "",
  carrierMail: "",
});

function onAction(ev: Event): void {
  const detail = (ev as CustomEvent<ActionDetail>).detail ?? {};
  const params = detail.params ?? {};

  // Un `modal` desconocido se ignora en silencio: la notificación pudo
  // publicarse desde una versión posterior del backend que conoce diálogos
  // que este bundle todavía no tiene.
  if (detail.modal !== "awb_request") return;

  const idVettore = Number(params.id_vettore ?? 0);
  const partnerId = Number(params.partner_id ?? 0);
  if (idVettore <= 0 || partnerId <= 0) return;

  awbRequest.idVettore = idVettore;
  awbRequest.partnerId = partnerId;
  awbRequest.carrierLabel = String(params.carrier_label ?? "");
  awbRequest.carrierMail = String(params.carrier_mail ?? "");
  awbRequest.open = true;
}

onMounted(() => window.addEventListener("tmwe:notification-action", onAction));
onBeforeUnmount(() =>
  window.removeEventListener("tmwe:notification-action", onAction),
);
</script>
