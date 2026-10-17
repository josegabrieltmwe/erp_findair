import { computed, ref, type Ref } from 'vue';

/**
 * Metric ⇄ Imperial conversion ported verbatim from spedy_form.php:490-509.
 *
 * Storage is always metric (kg, cm). The composable provides:
 *   - display labels (kg ⇆ Lb, cm ⇆ in)
 *   - toFraction(kgValue)        → display value in current system
 *   - fromFraction(displayValue) → metric value to store
 *
 * Conversions match the EXACT legacy factors from profilo.php:
 *   LIBR = 0.453592  (1 lb = 0.453592 kg)  → kg = lb * LIBR, lb = kg / LIBR
 *   INCH = 2.54      (1 in = 2.54 cm)      → cm = in * INCH, in = cm / INCH
 * The legacy JS (jscript_prec.php) multiplies imperial input by these factors
 * to obtain the metric value persisted in the DB. We mirror that here so the
 * SPA round-trips bit-for-bit with the legacy spedy_form.
 */
const LB_TO_KG = 0.453592;
const IN_TO_CM = 2.54;

export function useMetricImperial(initial: 'M' | 'I' = 'M') {
  const system: Ref<'M' | 'I'> = ref(initial);

  const weightLabel = computed(() => (system.value === 'I' ? 'Lb' : 'kg'));
  const lengthLabel = computed(() => (system.value === 'I' ? 'in' : 'cm'));

  function setSystem(next: 'M' | 'I'): void {
    system.value = next;
  }

  function toggle(): void {
    system.value = system.value === 'M' ? 'I' : 'M';
  }

  /** Convert a metric value (kg or cm) to the current display system. */
  function toDisplayWeight(kg: number | null | undefined): number {
    if (kg == null) return 0;
    // kg → lb = kg / LIBR (paridad legacy spedy_form, round 2 dec aplicado por el caller)
    return system.value === 'I' ? kg / LB_TO_KG : kg;
  }

  function toDisplayLength(cm: number | null | undefined): number {
    if (cm == null) return 0;
    // cm → in = cm / INCH
    return system.value === 'I' ? cm / IN_TO_CM : cm;
  }

  /** Convert a display value back to metric for persistence. */
  function fromDisplayWeight(display: number | null | undefined): number {
    if (display == null) return 0;
    // lb → kg = lb * LIBR (paridad legacy: peso = peso * frmLIBR)
    return system.value === 'I' ? display * LB_TO_KG : display;
  }

  function fromDisplayLength(display: number | null | undefined): number {
    if (display == null) return 0;
    // in → cm = in * INCH (paridad legacy: misura = misura * frmINCH)
    return system.value === 'I' ? display * IN_TO_CM : display;
  }

  return {
    system,
    weightLabel,
    lengthLabel,
    setSystem,
    toggle,
    toDisplayWeight,
    toDisplayLength,
    fromDisplayWeight,
    fromDisplayLength,
  };
}
