<template>
  <!-- Cargo modal stack. Each modal binds to a ui.activeModal name and
       reuses the existing box components from `components/cargo/` so we
       don't duplicate edit logic. Open with `ui.openModal('xxx')`. -->
  <ClienteModal />
  <PickupAddressModal />
  <DestAddressModal />
  <AgencyAddressModal />
  <HandlerAddressModal />
  <ColliModal />
  <CostiModal />
  <PostInvoiceModal />
  <ServizioModal />
  <MawbModal />
  <FlightsModal />
  <ConsolidationModal />
  <FlightSearchModal />
  <CustomsModal />
  <InsuranceModal />
  <StatoModal />
  <DeliveryModal />
  <CotizacionModal />
  <PartnersModal />
  <CancelCargoModal />
  <EmailDocumentModal />
  <ValidateLdvModal />
  <BookingDetailModal />
  <BookingCancelModal />
  <HawbFormModal />
  <HawbListModal />
  <TactDetailModal />
  <PricingBreakdownModal />
  <FlightLegsManualModal />
  <CurrencyDayModal />
  <DgrDeclarationDialog />
</template>

<script setup lang="ts">
import ClienteModal from "./ClienteModal.vue";
import PickupAddressModal from "./PickupAddressModal.vue";
import DestAddressModal from "./DestAddressModal.vue";
import AgencyAddressModal from "./AgencyAddressModal.vue";
import HandlerAddressModal from "./HandlerAddressModal.vue";
import ColliModal from "./ColliModal.vue";
import CostiModal from "./CostiModal.vue";
import PostInvoiceModal from "./PostInvoiceModal.vue";
import ServizioModal from "./ServizioModal.vue";
import MawbModal from "./MawbModal.vue";
import FlightsModal from "./FlightsModal.vue";
import FlightSearchModal from "./FlightSearchModal.vue";
import ConsolidationModal from "./ConsolidationModal.vue";
import CustomsModal from "./CustomsModal.vue";
import InsuranceModal from "./InsuranceModal.vue";
import StatoModal from "./StatoModal.vue";
import DeliveryModal from "./DeliveryModal.vue";
import CotizacionModal from "./CotizacionModal.vue";
import PartnersModal from "./PartnersModal.vue";
import CancelCargoModal from "./CancelCargoModal.vue";
import EmailDocumentModal from "./EmailDocumentModal.vue";
import ValidateLdvModal from "./ValidateLdvModal.vue";
import BookingDetailModal from "./BookingDetailModal.vue";
import BookingCancelModal from "./BookingCancelModal.vue";
import HawbFormModal from "./HawbFormModal.vue";
import HawbListModal from "./HawbListModal.vue";
import TactDetailModal from "./TactDetailModal.vue";
import PricingBreakdownModal from "../pricing/PricingBreakdownModal.vue";
import FlightLegsManualModal from "../flight-manager/FlightLegsManualModal.vue";
import CurrencyDayModal from "./CurrencyDayModal.vue";
import DgrDeclarationDialog from "../dgr/DgrDeclarationDialog.vue";
</script>
