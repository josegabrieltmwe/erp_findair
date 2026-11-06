<template>
  <CourierOfferPage v-if="isCourier" />
  <CarrierOfferPage v-else />
</template>

<script setup lang="ts">
/**
 * Entrada única de `/offer` (el enlace de los correos): el tipo de recurso que autorizó el OTP decide la pantalla. Sin tipo
 * conocido es la solicitud de una aerolínea, que es lo que llevan los enlaces ya enviados.
 */
import { defineAsyncComponent } from "vue";
import { getOtpBootstrap } from "@tmwe/shared-frontend/http";

const CarrierOfferPage = defineAsyncComponent(() => import("@cargo/pages/CarrierOfferPage.vue"));
const CourierOfferPage = defineAsyncComponent(() => import("@shipment/pages/CourierOfferPage.vue"));

const bootstrap = getOtpBootstrap();
const isCourier = bootstrap?.ok === true && bootstrap.resource.type === "courier_offer";
</script>
