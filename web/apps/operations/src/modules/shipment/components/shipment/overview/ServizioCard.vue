<template>
  <section class="card-tmwe">
    <CardHeader icon="mdi-tag-outline" :title="t('shipment.awb.card_title')">
      <template #badge>
        <!--
          Boton de "Debug Timing" (tiempos de calculo de tarifa) RETIRADO.
          El motivo y como reactivarlo estan al pie del <script setup>.
        -->
        <button
          type="button"
          class="lock-toggle"
          :class="{ 'lock-toggle--on': fornitoreLk }"
          :title="
            fornitoreLk
              ? t('shipment.awb.lock_locked_title')
              : t('shipment.awb.lock_unlocked_title')
          "
          :disabled="togglingLk"
          @click.stop="toggleFornitoreLk"
        >
          <v-icon
            :icon="
              togglingLk
                ? 'mdi-loading mdi-spin'
                : fornitoreLk
                  ? 'mdi-lock'
                  : 'mdi-lock-open-variant-outline'
            "
            size="14"
          />
        </button>
      </template>
    </CardHeader>

    <!-- Client service | supplier side by side to use the full card width
         (same pattern as the addresses card). Each is clickable to change it;
         the swap icon hints the action and now sits right next to the value
         instead of stranded across a blank row. Collapses to one column when
         the card is narrow. -->
    <div class="srv-grid">
      <!-- Servizio cliente → opens client service list directly -->
      <button type="button" class="srv-row" @click="clienteModalOpen = true">
        <span class="srv-row__icon"
          ><v-icon icon="mdi-account-outline" size="15"
        /></span>
        <span class="srv-row__body">
          <span class="srv-row__label">{{
            t("shipment.awb.client_service")
          }}</span>
          <span class="srv-row__value">{{ clientService }}</span>
        </span>
        <v-icon icon="mdi-swap-horizontal" size="15" class="srv-row__chev" />
      </button>

      <!-- Fornitore: fila normal (abre tabla fornitore) o, si el proveedor viene
           de una oferta RFQ aceptada, variante "oferta ganadora" (abre el
           detalle de la oferta). -->
      <button
        v-if="!hasAcceptedOffer"
        type="button"
        class="srv-row"
        @click="fornitoreModalOpen = true"
      >
        <span class="srv-row__icon">
          <!-- Logo del corriere (images/corr_{id_fornitore}.png). Si no existe
               logo para ese fornitore, cae al badge de texto de color y, si
               tampoco hay corriere, al icono de camión. -->
          <CourierLogo
            v-if="courierLogoId && !courierLogoFailed"
            :id="courierLogoId"
            :alt="courierLabel"
            :size="22"
            @fallback="courierLogoFailed = true"
          />
          <span
            v-else-if="courierLabel"
            class="courier-badge"
            :class="courierClass"
            >{{ courierBadge }}</span
          >
          <v-icon v-else icon="mdi-truck-outline" size="15" />
        </span>
        <span class="srv-row__body">
          <span class="srv-row__label">{{ t("shipment.awb.fornitore") }}</span>
          <span class="srv-row__value">{{ courierLabel || "—" }}</span>
          <span v-if="supplierServiceName" class="srv-row__sub">{{
            supplierServiceName
          }}</span>
        </span>
        <v-icon icon="mdi-swap-horizontal" size="15" class="srv-row__chev" />
      </button>

      <!-- Variante: proveedor asignado por una oferta RFQ aceptada. -->
      <button
        v-else
        type="button"
        class="srv-row srv-row--awarded"
        @click="rfqRepliesOpen = true"
      >
        <span class="srv-row__icon">
          <v-icon icon="mdi-trophy" size="18" color="success" />
        </span>
        <span class="srv-row__body">
          <span class="srv-row__label">{{ t("shipment.award.awarded") }}</span>
          <span class="srv-row__value">{{ acceptedCourierLabel }}</span>
          <span class="srv-row__sub">
            {{ acceptedPrice }}
          </span>
        </span>
        <v-icon icon="mdi-chevron-right" size="15" class="srv-row__chev" />
      </button>
    </div>

    <!-- AWB / Tracking — clickable to copy + inline actions -->
    <div class="srv-row srv-row--awb">
      <button type="button" class="srv-row__main" @click="copyAwb">
        <span class="srv-row__icon"
          ><v-icon icon="mdi-barcode" size="15"
        /></span>
        <span class="srv-row__body">
          <span class="srv-row__label">{{
            t("shipment.awb.awb_tracking")
          }}</span>
          <span
            class="srv-row__value"
            :class="{ 'srv-row__value--empty': !awb }"
          >
            {{ awb || t("shipment.awb.awb_unassigned") }}
          </span>
        </span>
        <v-btn
          v-if="awb"
          variant="text"
          size="x-small"
          icon="mdi-content-copy"
          class="srv-row__action"
          :title="t('shipment.awb.copy_awb')"
          @click.stop="copyAwb"
        />

        <!-- F1.3: public courier tracking link (legacy: url_real + AWB_forn,
             spedy_form.php:723 / spedy_ajax_array.php:194). Only when both the
             fornitore's tracking URL base and an AWB are present. -->
        <v-btn
          v-if="trackingUrl"
          variant="text"
          size="x-small"
          icon="mdi-truck-fast-outline"
          class="srv-row__action"
          :title="t('shipment.awb.tracking_courier')"
          @click.stop="openCourierTracking"
        />
      </button>

      <!-- Most-used action surfaced inline: print the courier label in one
           click without opening the menu. Only when an AWB exists. -->
      <v-btn
        v-if="awb"
        variant="flat"
        color="primary"
        size="small"
        rounded="lg"
        prepend-icon="mdi-printer"
        class="srv-row__print-inline"
        :loading="labels.printing.value"
        :title="t('shipment.awb.print_courier_label')"
        @click="labels.print"
      >
        {{ t("shipment.awb.print") }}
      </v-btn>

      <!-- Single LDV / AWB hub — every documento-di-vettura and courier-label
           action lives here (the topbar HVB/AWB buttons were removed). The
           ajax endpoints render labels off-FPM via the image worker. -->
      <v-menu offset="4">
        <template #activator="{ props: menuProps }">
          <!-- When an AWB exists, print is the inline button above, so this menu
               becomes a compact "more documents/options" affordance. Without an
               AWB it keeps the full label (it's the entry point to generate). -->
          <v-btn
            v-bind="menuProps"
            variant="tonal"
            color="primary"
            size="small"
            rounded="lg"
            :prepend-icon="
              awb ? 'mdi-file-document-multiple-outline' : 'mdi-printer'
            "
            append-icon="mdi-chevron-down"
            class="srv-row__print"
            :title="t('shipment.awb.menu_button')"
          >
            {{
              awb
                ? t("shipment.awb.menu_button_docs")
                : t("shipment.awb.menu_button")
            }}
          </v-btn>
        </template>
        <v-list density="compact" class="ldv-menu">
          <v-list-subheader>{{
            t("shipment.awb.ldv_internal")
          }}</v-list-subheader>
          <!-- Primary internal-LDV action: print in one click (parity with the
               courier print). View/PDF/mail stay as secondary entries below. -->
          <v-list-item
            class="ldv-menu__primary"
            :prepend-icon="
              tmwe.printing.value ? 'mdi-loading mdi-spin' : 'mdi-printer'
            "
            :title="t('shipment.awb.ldv_print')"
            :subtitle="
              tmwe.printing.value
                ? t('shipment.awb.printing')
                : t('shipment.awb.ldv_print_sub')
            "
            :disabled="tmwe.printing.value"
            @click="tmwe.printDirect"
          />
          <v-list-item
            prepend-icon="mdi-image-outline"
            :title="t('shipment.awb.ldv_view_image')"
            :subtitle="t('shipment.awb.ldv_view_image_sub')"
            @click="tmwe.openLabel('image')"
          />
          <v-list-item
            :prepend-icon="
              tmwe.pdfLoading.value
                ? 'mdi-loading mdi-spin'
                : 'mdi-file-pdf-box'
            "
            :title="t('shipment.awb.ldv_download_pdf')"
            :subtitle="
              tmwe.pdfLoading.value
                ? t('shipment.awb.generating_ldv')
                : t('shipment.awb.ldv_download_pdf_sub')
            "
            :disabled="tmwe.pdfLoading.value"
            @click="tmwe.openLabel('pdf')"
          />
          <v-list-item
            :prepend-icon="
              sendingLdvMail ? 'mdi-loading mdi-spin' : 'mdi-email-fast-outline'
            "
            :title="t('shipment.awb.ldv_send_mail')"
            :subtitle="
              sendingLdvMail
                ? t('shipment.awb.sending_mail')
                : t('shipment.awb.ldv_send_mail_sub')
            "
            :disabled="sendingLdvMail"
            @click="sendLdvMail"
          />
          <v-divider class="my-1" />
          <v-list-subheader>{{
            t("shipment.awb.courier_labels")
          }}</v-list-subheader>
          <!-- Primary, most-used action: print the courier label in one click. -->
          <v-list-item
            v-if="awb"
            class="ldv-menu__primary"
            :prepend-icon="
              labels.printing.value ? 'mdi-loading mdi-spin' : 'mdi-printer'
            "
            :title="t('shipment.awb.print_courier_label')"
            :subtitle="
              labels.printing.value
                ? t('shipment.awb.printing')
                : t('shipment.awb.print_courier_label_sub')
            "
            :disabled="labels.printing.value"
            @click="labels.print"
          />
          <v-list-item
            v-if="awb"
            prepend-icon="mdi-truck-fast-outline"
            :title="t('shipment.awb.view_courier_labels')"
            :subtitle="t('shipment.awb.view_courier_labels_sub', { awb })"
            @click="labels.openDialog"
          />
          <!-- Download every courier label as one combined PDF (parity with the
               internal-LDV 'Download PDF' entry). -->
          <v-list-item
            v-if="awb"
            prepend-icon="mdi-file-pdf-box"
            :title="t('shipment.awb.download_courier_pdf')"
            :subtitle="t('shipment.awb.download_courier_pdf_sub')"
            @click="labels.downloadAll"
          />
          <v-list-item
            v-if="awb"
            prepend-icon="mdi-email-arrow-right-outline"
            :title="t('shipment.label_share.menu_title')"
            :subtitle="t('shipment.label_share.menu_sub')"
            @click="shareLabelOpen = true"
          />
          <v-list-item
            v-else
            prepend-icon="mdi-truck-plus-outline"
            :title="t('shipment.awb.generate_awb')"
            :subtitle="
              courierLabel
                ? t('shipment.awb.generate_awb_sub_booking', {
                    courier: courierLabel,
                  })
                : t('shipment.awb.generate_awb_sub_assign')
            "
            :disabled="!courierLabel || awbGen.generating.value"
            @click="awbGen.confirm(Boolean(courierLabel))"
          />
          <v-list-item
            v-if="awb"
            prepend-icon="mdi-restart"
            :title="t('shipment.awb.reset_awb')"
            :subtitle="t('shipment.awb.reset_awb_sub')"
            base-color="error"
            @click="confirmResetAwb"
          />
        </v-list>
      </v-menu>

      <!-- Reset AWB confirmation dialog -->
      <AwbResetDialog
        v-model="resetDialogOpen"
        :awb="awb"
        :shipment-id="Number(shipment?.id ?? 0)"
        @reset-done="onResetDone"
      />

      <!-- TMWE LDV preview dialog (image inline) -->
      <TmweLabelDialog
        v-model="tmwe.dialogOpen.value"
        :labels="tmwe.labels.value"
        :loading="tmwe.loading.value"
        :error="tmwe.error.value"
        @download="tmwe.downloadLabel"
        @download-all="tmwe.downloadAll"
        @print="tmwe.printInTab"
      />

      <!-- Generate AWB confirmation dialog -->
      <GenerateAwbDialog
        v-model="awbGen.dialogOpen.value"
        :courier-label="courierLabel"
        :supplier-service-name="supplierServiceName"
        :will-book-pickup="willBookPickup"
        :validating="awbGen.validating.value"
        :generating="awbGen.generating.value"
        :errors="awbGen.errors.value"
        :warnings="awbGen.warnings.value"
        :has-blocking-errors="awbGen.hasBlockingErrors.value"
        :ship-date-label="awbGen.shipDateLabel.value"
        :ship-date-adjusted="awbGen.shipDateAdjusted.value"
        @generate="awbGen.generate"
      />

      <!-- AWB generated — success dialog with inline preview + one-click print.
           Closes the generate → see → print loop right after booking. -->
      <AwbSuccessDialog
        v-model="labels.successOpen.value"
        :tracking="labels.generatedTracking.value"
        :labels="labels.successLabels.value"
        :loading="labels.successLoading.value"
        :printing="labels.printing.value"
        :label-url="labels.labelUrl"
        :rotate-deg="labels.rotateDeg"
        :img-style="labels.imgStyle"
        @copy="copyText"
        @print="labels.print"
      />

      <!-- Courier labels dialog — inline image preview + print/download-all,
           at parity with the internal TMWE LDV dialog. -->
      <CourierLabelsDialog
        v-model="labels.dialogOpen.value"
        :list="labels.list.value"
        :items="labels.items.value"
        :loading="labels.loading.value"
        :error="labels.error.value"
        :printing="labels.printing.value"
        :label-url="labels.labelUrl"
        :title="labels.title"
        :subtitle="labels.subtitle"
        @print="labels.print"
        @download-all="labels.downloadAll"
        @open="labels.openLabel"
        @download="labels.downloadLabel"
      />

      <ShareLabelModal
        v-model="shareLabelOpen"
        :shipment-id="Number(shipment?.id ?? 0)"
      />

      <v-btn
        v-if="awb && !isReadonly"
        variant="text"
        size="x-small"
        :icon="resettingInline ? undefined : 'mdi-close-circle-outline'"
        :loading="resettingInline"
        class="srv-row__action"
        :title="t('shipment.awb.reset_awb')"
        @click.stop="onResetAwb"
      />
    </div>

    <!-- Comunicacion: un UNICO menu para los dos canales (couriers y
         partners). Antes eran dos desplegables casi identicos, cada uno con
         "enviar" + "ver respuestas" + badge: el mismo patron repetido dos
         veces, ocupando el doble de espacio. Las respuestas se unifican en una
         entrada por canal, asi el dropdown queda corto. -->
    <div class="d-flex flex-wrap ga-2 mt-3" data-quote-menu>
      <ShipmentQuoteMenu
        :disabled="!id"
        :rfq-total="rfqStore.offers.length"
        :rfq-replied="rfqReplyCount"
        :partner-total="partnerStore.offers.length"
        :partner-replied="partnerReplyCount"
        @send-rfq="rfqModalOpen = true"
        @send-partner="partnerModalOpen = true"
        @view-rfq="rfqRepliesOpen = true"
        @view-partner="partnerRepliesOpen = true"
      />
    </div>

    <!-- Sub-modals mounted here — no intermediate ServizioModal needed -->
    <ShipmentServiceClienteModal v-model:open="clienteModalOpen" />
    <ShipmentServiceFornitoreModal v-model:open="fornitoreModalOpen" />
    <ExpressRfqModal v-model="rfqModalOpen" :shipment-id="Number(id) || 0" />
    <OfferRepliesModal
      v-model="rfqRepliesOpen"
      :offers="rfqStore.offers"
      :title="t('shipment.rfq.replies_title')"
      :subtitle="t('shipment.rfq.dialog_intro')"
      icon="mdi-truck-fast-outline"
      :allow-accept="true"
      email-key="courier_email"
      :recipient-label="
        (o) => String((o as any).courier_nome ?? `#${o.id_courier}`)
      "
      :accept="acceptRfqOffer"
      :reset="resetRfqOffer"
    />
    <!-- Email de adjudicación al courier ganador (se abre tras aceptar). -->
    <ExpressAwardModal v-model="awardEmailOpen" :offer="acceptedOffer" />
    <OfferRepliesModal
      v-model="partnerRepliesOpen"
      :offers="partnerStore.offers"
      :title="t('shipment.partner_offer.replies_title')"
      :subtitle="t('shipment.partner_offer.dialog_intro')"
      icon="mdi-account-arrow-right-outline"
      :allow-accept="true"
      email-key="partner_email"
      :recipient-label="
        (o) => String((o as any).partner_nome ?? `#${o.id_courier}`)
      "
      :accept="acceptPartnerOffer"
    />
    <PartnerOfferModal
      v-model="partnerModalOpen"
      :shipment-id="Number(id) || 0"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useToastStore } from "@shipment/stores/toast.store";
import CardHeader from "@shipment/components/shell/CardHeader.vue";
import CourierLogo from "@shipment/components/shipment/CourierLogo.vue";
import ShipmentServiceClienteModal from "@shipment/components/shipment/service/ShipmentServiceClienteModal.vue";
import ShipmentServiceFornitoreModal from "@shipment/components/shipment/service/ShipmentServiceFornitoreModal.vue";
import ExpressRfqModal from "@shipment/components/shipment/ExpressRfqModal.vue";
import ShipmentQuoteMenu from "@shipment/components/shipment/overview/ShipmentQuoteMenu.vue";
import ExpressAwardModal from "@shipment/components/shipment/ExpressAwardModal.vue";
import PartnerOfferModal from "@shipment/components/shipment/PartnerOfferModal.vue";
import OfferRepliesModal, {
  type OfferReplyRow,
} from "@shipment/components/shipment/OfferRepliesModal.vue";
import { useExpressOffersStore } from "@shipment/stores/express_offers.store";
import { usePartnerOffersStore } from "@shipment/stores/partner_offers.store";
import type { ExpressOffer } from "@shipment/services/express_offers.service";
import AwbResetDialog from "@shipment/components/shipment/overview/dialogs/AwbResetDialog.vue";
import TmweLabelDialog from "@shipment/components/shipment/overview/dialogs/TmweLabelDialog.vue";
import { useTmweLabels } from "@shipment/composables/useTmweLabels";
import AwbSuccessDialog from "@shipment/components/shipment/overview/dialogs/AwbSuccessDialog.vue";
import CourierLabelsDialog from "@shipment/components/shipment/overview/dialogs/CourierLabelsDialog.vue";
import ShareLabelModal from "@shipment/components/shipment/overview/dialogs/ShareLabelModal.vue";
import { useCourierLabels } from "@shipment/composables/useCourierLabels";
import GenerateAwbDialog from "@shipment/components/shipment/overview/dialogs/GenerateAwbDialog.vue";
import { useAwbGeneration } from "@shipment/composables/useAwbGeneration";
import { labelsService } from "@shipment/services/labels.service";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment, id } = storeToRefs(store);
const shareLabelOpen = ref(false);
const { readonly } = useShipmentState(shipment);
const toasts = useToastStore();

const clienteModalOpen = ref(false);
const fornitoreModalOpen = ref(false);
const rfqModalOpen = ref(false);
const partnerModalOpen = ref(false);
const rfqRepliesOpen = ref(false);
const partnerRepliesOpen = ref(false);

// Badges de respuestas: nº de ofertas ya respondidas (con precio) y aún no
// aceptadas, por canal (courier RFQ y partner). Avisan en la ficha sin abrir el
// modal. Se cargan al montar/cambiar de expedición.
const rfqStore = useExpressOffersStore();
const partnerStore = usePartnerOffersStore();

function countReplies(list: OfferReplyRow[]): number {
  return list.filter(
    (o) =>
      !!o.data_risp &&
      o.data_risp !== "0000-00-00 00:00:00" &&
      o.accettata !== "S",
  ).length;
}
const rfqReplyCount = computed<number>(() => countReplies(rfqStore.offers));
const partnerReplyCount = computed<number>(() =>
  countReplies(partnerStore.offers),
);

watch(
  id,
  (sid) => {
    const n = Number(sid ?? 0);
    if (n > 0) {
      void rfqStore.load(n);
      void partnerStore.load(n);
    }
  },
  { immediate: true },
);

// Oferta courier aceptada (ganadora) del envío: señal fiable de "proveedor por
// oferta" (el id_fornitore de la ficha no lo distingue). Alimenta la variante de
// la fila proveedor y el modal de adjudicación.
const acceptedOffer = computed<ExpressOffer | null>(
  () => rfqStore.offers.find((o) => o.accettata === "S") ?? null,
);
const hasAcceptedOffer = computed<boolean>(() => acceptedOffer.value !== null);
const acceptedCourierLabel = computed<string>(() => {
  const o = acceptedOffer.value;
  if (!o) return "";
  return String(
    (o as Record<string, unknown>).courier_nome ?? `#${o.id_courier}`,
  );
});
const acceptedPrice = computed<string>(() => {
  const o = acceptedOffer.value;
  if (!o || !(Number(o.costo) > 0)) return "";
  return `${o.costo} ${o.change_valuta}`;
});

// Modal de email de adjudicación al ganador (se abre tras aceptar).
const awardEmailOpen = ref(false);

/** Aceptar una oferta courier: vuelca coste + exclusividad, y abre el email de
 *  adjudicación al ganador (editable, cancelable). */
async function acceptRfqOffer(o: OfferReplyRow): Promise<void> {
  const res = await rfqStore.acceptOffer(Number(o.id), Number(id.value ?? 0));
  if (res.ok) {
    if (res.costApplied) {
      toasts.push("success", t("shipment.rfq.accept_ok"));
    } else {
      toasts.push(
        "warning",
        t("shipment.rfq.accept_ok_no_cost", { reason: res.warning ?? "" }),
      );
    }
    // Cierra el modal de respuestas y abre el de adjudicación al ganador.
    rfqRepliesOpen.value = false;
    awardEmailOpen.value = true;
  }
}

/** Cancelar la selección: desmarca la ganadora, limpia proveedor/coste y
 *  cancela la AWB/pickup del courier previo si existían. */
async function resetRfqOffer(o: OfferReplyRow): Promise<void> {
  const res = await rfqStore.resetOffer(Number(o.id), Number(id.value ?? 0));
  if (res.ok) {
    toasts.push("success", t("shipment.award.reset_ok"));
    if (res.awbCanceled) {
      // La cancelación del AWB/pickup se encoló en el courier integrado.
      toasts.push("info", t("shipment.award.awb_cancel_queued"));
    } else if (res.awbWarning === "no_api") {
      // Courier sin API de cancelación: el AWB manual se limpió localmente.
      toasts.push("info", t("shipment.award.awb_cleared_local"));
    } else if (res.awbWarning) {
      // Fallo real al cancelar en el courier (credenciales, worker, etc.).
      toasts.push(
        "warning",
        t("shipment.award.awb_cancel_warning", { reason: res.awbWarning }),
      );
    }
    rfqRepliesOpen.value = false;
    // Refresca la ficha para reflejar la AWB/proveedor limpiados.
    void store.load(Number(id.value ?? 0));
  }
}

/** Aceptar una oferta partner: solo exclusividad (no vuelca coste). */
async function acceptPartnerOffer(o: OfferReplyRow): Promise<void> {
  const ok = await partnerStore.acceptOffer(
    Number(o.id),
    Number(id.value ?? 0),
  );
  if (ok) {
    toasts.push("success", t("shipment.partner_offer.accept_ok"));
  }
}

/*
 * Debug Timing (tiempos de calculo de tarifa) DESACTIVADO en la ficha.
 *
 * Antes se llamaba a `/shipment_timing` en cada montaje/navegacion solo para
 * decidir si pintar el icono del cronometro. Se retiro porque:
 *
 *   - Devolvia 400 en expediciones sin colli: el controlador hereda el
 *     `validate_request` de los endpoints de ETIQUETAS, que exige
 *     `package_number <= colli` con valor por defecto 1, asi que con
 *     `colli = 0` fallaba aunque ese parametro no pinte nada aqui.
 *   - Cuando respondia 200 venia vacio (`phases: []`, `count: 0`): lo alimenta
 *     un indice de Elasticsearch sin datos en este entorno.
 *
 * Una peticion por ficha que fallaba la mitad de las veces y en la otra mitad
 * no aportaba nada. Para reactivarlo: `timing.service.ts` y
 * `TimingDebugPanel.vue` siguen en el repo — basta volver a montar el panel y
 * llamar al servicio desde un boton.
 */

function get<T = string>(field: string): T | undefined {
  return (shipment.value as unknown as Record<string, T> | null)?.[field];
}

const isReadonly = computed<boolean>(() => readonly("AWB_forn"));

// Servizio cliente — "IT - Express Domestic"
const clientService = computed<string>(() => {
  const raw = get("servizio");
  if (raw) return raw.replace(/<\/?[bB]>/g, "").trim();
  const svc = (shipment.value as Record<string, unknown> | null)?.service;
  if (svc && typeof svc === "object" && (svc as Record<string, string>).nome) {
    return (svc as Record<string, string>).nome;
  }
  const sid = Number(shipment.value?.id_servizio ?? 0);
  return sid ? t("shipment.awb.service_placeholder", { id: sid }) : "—";
});

// Fornitore — "DHL Express (Italy) S.r.l."
const courierLabel = computed<string | null>(
  () =>
    get("fornitore_descr") ||
    get("id_fornitore_nome") ||
    get("id_fornitore_label") ||
    null,
);

// Servizio fornitore — subtitle under courier name
const supplierServiceName = computed<string | null>(
  () =>
    get("servizio_fornitore_descr") ||
    get("service_label") ||
    get("id_servizio_fornitore_nome") ||
    null,
);

const courierSlug = computed<string | null>(
  () => get("id_fornitore_slug") || get("forn_sigla") || null,
);

const courierClass = computed<string>(() => {
  const s = (courierSlug.value || "").toLowerCase();
  if (s.includes("dhl")) return "courier-badge--dhl";
  if (s.includes("ups")) return "courier-badge--ups";
  if (s.includes("fedex") || s.includes("fde")) return "courier-badge--fedex";
  if (s.includes("tnt")) return "courier-badge--tnt";
  return "";
});

const courierBadge = computed<string>(() => {
  const s = (courierSlug.value || "").toUpperCase();
  return s.length <= 5 ? s : s.slice(0, 3);
});

// Logo del corriere (images/corr_{id_fornitore}.png). id_fornitore es el id de
// anagrafica del corriere; solo hay logo para algunos (DHL/UPS/FedEx/BRT/TNT…).
const courierLogoId = computed<string>(() => {
  const raw = String(get("id_fornitore") ?? "").trim();
  return /^\d+$/.test(raw) && Number(raw) > 0 ? raw : "";
});
const courierLogoFailed = ref(false);
// Al cambiar de corriere, reintentar la carga del logo.
watch(courierLogoId, () => {
  courierLogoFailed.value = false;
});

const awb = computed<string>(() => String(get("AWB_forn") ?? ""));
const fornitoreLk = computed<boolean>(
  () => get<string>("fornitore_lk") === "S",
);

// F1.3: courier public tracking link — legacy concatenates anagrafiche.url_real
// (of the assigned fornitore) + AWB_forn. Only rendered when both are present.
const trackingUrl = computed<string | null>(() => {
  const base = String(get("courier_url_real") ?? "").trim();
  if (!base || !awb.value) return null;
  return base + awb.value;
});

function openCourierTracking(): void {
  if (!trackingUrl.value) return;
  window.open(trackingUrl.value, "_blank", "noopener");
}

// Flow rule: when presa_fornitore='S' and there is no AWB yet, generating the
// AWB also books the courier pickup (backend create_label_and_pickup). Announce
// it in the confirm dialog so the booking is never an implicit surprise.
const willBookPickup = computed<boolean>(
  () => get<string>("presa_fornitore") === "S" && !awb.value,
);

const togglingLk = ref(false);

async function toggleFornitoreLk(): Promise<void> {
  if (togglingLk.value) return;
  togglingLk.value = true;
  const next = fornitoreLk.value ? "N" : "S";
  try {
    await store.update({ fornitore_lk: next });
    toasts.push(
      "success",
      next === "S"
        ? t("shipment.awb.toast_fornitore_locked")
        : t("shipment.awb.toast_fornitore_unlocked"),
    );
  } finally {
    togglingLk.value = false;
  }
}

async function copyText(value: string | null): Promise<void> {
  if (!value) {
    toasts.push("warning", t("shipment.awb.toast_awb_unassigned"));
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toasts.push("success", t("shipment.awb.toast_awb_copied"));
  } catch {
    toasts.push("error", t("shipment.awb.toast_awb_copy_failed"));
  }
}

function copyAwb(): void {
  void copyText(awb.value);
}

const resettingInline = ref(false);

async function onResetAwb(): Promise<void> {
  if (resettingInline.value) return;
  resettingInline.value = true;
  try {
    await store.update({ AWB_forn: "" });
    toasts.push("success", t("shipment.awb.toast_awb_reset"));
  } finally {
    resettingInline.value = false;
  }
}

// ─── TMWE internal LDV (ajax_tmwe_label) ────────────────────────
// State + handlers extracted to useTmweLabels; the header actions and the
// preview dialog both consume this single instance.
const tmwe = useTmweLabels(() => Number(shipment.value?.id ?? 0));

// ─── Courier labels + AWB success (post-generation) ─────────────
// State + helpers extracted to useCourierLabels; the AWB-row print button,
// the success dialog and the full labels dialog all consume this instance.
const labels = useCourierLabels(
  () => Number(shipment.value?.id ?? 0),
  () => awb.value,
);

// ─── Genera AWB corriere (booking real) ───────────────────────
// Validation + booking flow extracted to useAwbGeneration. On success we reflect
// the new AWB locally (a full store.load() re-fires every card's watchers and
// flashes the detail) and close the loop into the success dialog for one-click
// print — same behaviour as before the extraction.
const awbGen = useAwbGeneration(
  () => Number(shipment.value?.id ?? 0),
  () => String(get("data_sped0") ?? ""),
  (tracking: string) => {
    store.mergeLocal({ AWB_forn: tracking } as Record<string, unknown>);
    labels.generatedTracking.value = tracking;
    labels.openSuccess(Number(shipment.value?.id ?? 0));
  },
);

const sendingLdvMail = ref(false);

async function sendLdvMail(): Promise<void> {
  const sid = Number(shipment.value?.id ?? 0);
  if (!sid || sendingLdvMail.value) return;
  sendingLdvMail.value = true;
  try {
    const r = await labelsService.sendLdvToMittente(sid);
    if (!r.success) {
      toasts.push("error", r.error ?? t("shipment.awb.toast_send_failed"));
      return;
    }
    toasts.push(
      "success",
      r.sent_to
        ? t("shipment.awb.toast_ldv_sent_to", { to: r.sent_to })
        : t("shipment.awb.toast_ldv_sent"),
    );
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    sendingLdvMail.value = false;
  }
}

// ─── Reset AWB ──────────────────────────────────────────────
// The confirmation dialog + its awbService.reset call live in AwbResetDialog.
// This card only owns the open state and applies the local clear on success.
const resetDialogOpen = ref(false);

function confirmResetAwb(): void {
  resetDialogOpen.value = true;
}

function onResetDone(): void {
  // Clear the AWB locally instead of a full reload (which flashes the detail
  // and re-fires every card's watchers). The reset already persisted it.
  store.mergeLocal({ AWB_forn: "" } as Record<string, unknown>);
}
</script>

<style scoped>
.lock-toggle {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 6px;
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.4);
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
}
.lock-toggle:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.lock-toggle--on {
  color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.1);
}
.lock-toggle--on:hover {
  background: rgba(var(--v-theme-warning), 0.18);
}

.srv-row {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 8px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  border-radius: 8px;
  transition: background 0.12s;
  gap: 10px;
}
/* Variante "oferta ganadora": acento success para distinguir que el proveedor
   viene de una oferta RFQ aceptada. */
.srv-row--awarded {
  background: rgba(var(--v-theme-success), 0.08);
}
.srv-row--awarded:hover {
  background: rgba(var(--v-theme-success), 0.14);
}
.srv-row--awarded .srv-row__value {
  color: rgb(var(--v-theme-success));
  font-weight: 600;
}
.srv-row + .srv-row {
  /* Sin línea separadora interna entre filas (cards sin bordes internos,
     paridad con el detalle de cargo). */
}
.srv-row:hover {
  background: rgba(var(--v-theme-primary), 0.04);
}
.srv-row:hover .srv-row__chev {
  color: rgb(var(--v-theme-primary));
}
.srv-row__icon {
  flex: 0 0 28px;
  display: grid;
  place-items: center;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.srv-row__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.srv-row__label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.srv-row__value {
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.srv-row__value--empty {
  color: rgba(var(--v-theme-on-surface), 0.35);
  font-style: italic;
  font-weight: 400;
}
.srv-row__sub {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.srv-row__chev {
  flex: 0 0 auto;
  color: rgba(var(--v-theme-on-surface), 0.3);
  transition: color 0.12s;
}
/* Client service | supplier side by side, hairline divider between — uses the
   full card width instead of two half-empty rows. The AWB row below keeps full
   width (it hosts the print / documents actions). */
.srv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 4px;
}
.srv-grid > .srv-row + .srv-row {
  border-top: 0;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.card-tmwe {
  container-type: inline-size;
}
@container (max-width: 440px) {
  .srv-grid {
    grid-template-columns: 1fr;
  }
  .srv-grid > .srv-row + .srv-row {
    border-left: 0;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  }
}
.srv-row__action {
  flex: 0 0 auto;
  color: rgba(var(--v-theme-on-surface), 0.4);
}

.courier-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.4px;
  padding: 3px 5px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1;
}
.courier-badge--dhl {
  background: #ffcc00;
  color: #cc0000;
}
.courier-badge--ups {
  background: #351c15;
  color: #ffb500;
}
.courier-badge--fedex {
  background: #4d148c;
  color: #ff6600;
}
.courier-badge--tnt {
  background: #ff6600;
  color: #fff;
}

.srv-row--awb .srv-row__value {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  letter-spacing: 0.3px;
}

/* AWB row hosts the LDV print button alongside the clickable copy area.
   Override the default `cursor:pointer` and convert the row into a flex
   container so the button sits inline without breaking the layout. */
.srv-row--awb {
  cursor: default;
  /* Sin línea separadora interna sobre la fila AWB (cards sin bordes internos,
     paridad con el detalle de cargo). */
}
.srv-row__main {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 10px;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-align: left;
}
.srv-row__main:hover .srv-row__value {
  color: rgb(var(--v-theme-primary));
}
.srv-row__print {
  flex: 0 0 auto;
  margin-left: 8px;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11.5px;
  font-weight: 600;
}
.ldv-menu {
  min-width: 260px;
}
/* Primary, most-used action (print courier label) — stand out in the menu. */
.ldv-menu__primary {
  background: rgba(var(--v-theme-primary), 0.08);
  font-weight: 600;
}
.ldv-menu__primary :deep(.v-list-item-title) {
  color: rgb(var(--v-theme-primary));
}
/* Inline print button on the AWB row — the most-used action surfaced. */
.srv-row__print-inline {
  margin-inline-start: 4px;
  flex: 0 0 auto;
}
</style>
