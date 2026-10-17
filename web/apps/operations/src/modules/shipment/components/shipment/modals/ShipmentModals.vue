<template>
  <ClienteModal />
  <PickupAddressModal />
  <DestAddressModal />
  <ColliModal />
  <CostiModal />
  <CodModal />
  <InsuranceModal />
  <CustomsModal />
  <SupplementsModal />
  <PickupScheduleModal />
  <DatesModal />
  <ProformaModal />
  <PostInvoiceModal />
  <StatoModal />
  <RiaddebitoDialog />
  <ShipmentPricingBreakdownModal />
  <WifiScaleDialog />
  <CurrencyDayModal />
  <NotesModal />
  <PartnersModal />
  <DgrDeclarationDialog />
  <FlagsModal />
  <CheckfornModal />
</template>

<script setup lang="ts">
import ClienteModal from "./ClienteModal.vue";
import PickupAddressModal from "./PickupAddressModal.vue";
import DestAddressModal from "./DestAddressModal.vue";
import ColliModal from "./ColliModal.vue";
import CostiModal from "./CostiModal.vue";
import CodModal from "./CodModal.vue";
import InsuranceModal from "./InsuranceModal.vue";
import CustomsModal from "./CustomsModal.vue";
import SupplementsModal from "./SupplementsModal.vue";
import PickupScheduleModal from "./PickupScheduleModal.vue";
import DatesModal from "./DatesModal.vue";
import ProformaModal from "./ProformaModal.vue";
import PostInvoiceModal from "./PostInvoiceModal.vue";
import StatoModal from "./StatoModal.vue";
import RiaddebitoDialog from "../recharge/RiaddebitoDialog.vue";
import ShipmentPricingBreakdownModal from "../pricing/ShipmentPricingBreakdownModal.vue";
import WifiScaleDialog from "../weights/WifiScaleDialog.vue";
import CurrencyDayModal from "./CurrencyDayModal.vue";
import NotesModal from "./NotesModal.vue";
import PartnersModal from "./PartnersModal.vue";
import DgrDeclarationDialog from "../dgr/DgrDeclarationDialog.vue";
import FlagsModal from "./FlagsModal.vue";
import CheckfornModal from "./CheckfornModal.vue";

// No emits — all modal interactions stay inside the modal stack.
</script>
