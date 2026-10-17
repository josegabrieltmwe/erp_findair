<script lang="ts">
/**
 * Thin re-export of the shared @tmwe/platform CountryFlag so the whole
 * SPA renders flags from a single implementation. Kept as a local file
 * (rather than rewriting every import) so existing consumers —
 * AddressSummary, ShipmentHeader — keep their `@/components/common/CountryFlag`
 * import paths working unchanged.
 *
 * The shared component eager-globs the flag SVGs (inlined as data-URIs),
 * which also collapses the ~260 per-flag lazy chunks the old dynamic-
 * import version emitted into the listing bundle.
 */
export { default } from "@shared/listing/CountryFlag.vue";
</script>
