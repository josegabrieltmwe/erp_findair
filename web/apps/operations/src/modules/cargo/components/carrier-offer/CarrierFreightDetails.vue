<template>
  <v-card variant="outlined" class="carrier-card" data-testid="carrier-freight">
    <v-card-title class="carrier-card__title">{{ t("cargo.carrierOffer.freight_title") }}</v-card-title>
    <v-card-text class="carrier-freight">
      <section>
        <h3 class="carrier-sub">{{ t("cargo.carrierOffer.parcels_title") }}</h3>
        <ul class="carrier-parcels" data-testid="carrier-parcels">
          <li v-for="p in parcels" :key="p.n">
            <span class="carrier-parcels__n">{{ p.n }}</span>
            <span>{{ p.side1 }} × {{ p.side2 }}, h {{ p.height }} cm · {{ weight(p.weight) }} kg</span>
            <v-icon v-if="!p.turnable" icon="mdi-rotate-3d-variant" size="16" color="error" :title="t('cargo.carrierOffer.not_turnable')" />
            <v-icon v-if="!p.stackable" icon="mdi-layers-off-outline" size="16" color="error" :title="t('cargo.carrierOffer.not_stackable')" />
          </li>
        </ul>
        <p v-if="hasRestrictions" class="carrier-legend">
          <strong>{{ t("cargo.carrierOffer.legend") }}</strong>
          <span v-if="parcels.some((p) => !p.turnable)"><v-icon icon="mdi-rotate-3d-variant" size="14" color="error" /> {{ t("cargo.carrierOffer.not_turnable") }}</span>
          <span v-if="parcels.some((p) => !p.stackable)"><v-icon icon="mdi-layers-off-outline" size="14" color="error" /> {{ t("cargo.carrierOffer.not_stackable") }}</span>
        </p>
      </section>
      <section>
        <h3 class="carrier-sub">{{ t("cargo.carrierOffer.freight_summary") }}</h3>
        <dl class="carrier-facts">
          <dt>{{ t("cargo.carrierOffer.total_weight") }}</dt><dd>{{ weight(freight.weight) }} kg</dd>
          <dt>{{ t("cargo.carrierOffer.total_volume") }}</dt><dd>{{ weight(freight.volume) }} m³</dd>
          <dt>{{ t("cargo.carrierOffer.parcels_count") }}</dt><dd>{{ freight.parcels_count }}</dd>
          <dt>{{ t("cargo.carrierOffer.departure") }}</dt><dd>{{ freight.departure || "—" }}</dd>
          <dt>{{ t("cargo.carrierOffer.arrival") }}</dt><dd>{{ freight.arrival || "—" }}</dd>
          <dt>{{ t("cargo.carrierOffer.pallets") }}</dt><dd>{{ freight.pallets ? t("cargo.carrierOffer.yes") : t("cargo.carrierOffer.no") }}</dd>
          <dt>{{ t("cargo.carrierOffer.goods") }}</dt><dd>{{ freight.goods || "—" }}</dd>
        </dl>
        <a :href="packagesUrl" download class="carrier-csv" data-testid="carrier-packages-csv">
          <v-icon icon="mdi-file-delimited-outline" size="16" /> {{ t("cargo.carrierOffer.download_parcels") }}
        </a>
      </section>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { carrierOfferLinks, type CarrierOfferView } from "@cargo/services/carrier_offer.service";

const props = defineProps<{ freight: CarrierOfferView["freight"]; parcels: CarrierOfferView["parcels"] }>();
const { t } = useI18n();

const packagesUrl = carrierOfferLinks.packages();
const hasRestrictions = computed(() => props.parcels.some((p) => !p.turnable || !p.stackable));

function weight(n: number): string {
  return Number(n).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
</script>

<style scoped lang="scss">
.carrier-card__title { font-size: 1rem; font-weight: 600; }
.carrier-freight { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; }
.carrier-sub { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; margin: 0 0 8px; font-weight: 600; }
.carrier-parcels { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow: auto; display: flex; flex-direction: column; gap: 4px; }
.carrier-parcels li { display: flex; align-items: center; gap: 8px; font-variant-numeric: tabular-nums; }
.carrier-parcels__n { min-width: 24px; opacity: 0.6; }
.carrier-legend { margin: 12px 0 0; font-size: 0.85rem; display: flex; flex-wrap: wrap; gap: 4px 16px; }
.carrier-facts { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
.carrier-facts dt { opacity: 0.7; }
.carrier-csv { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 0.85rem; }
.carrier-facts dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
