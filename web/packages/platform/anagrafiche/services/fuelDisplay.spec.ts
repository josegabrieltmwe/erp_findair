import { describe, expect, it } from 'vitest';
import { formatFuelEfectivo, fuelBreakdownParts } from './fuelDisplay';

/**
 * El fuel del cliente es un delta sobre el fuel del servizio (puede ser
 * negativo = descuento). La grilla de servizi
 * (Anagrafiche_Listvol::get_service_grid_for_client) devuelve servizio_fuel,
 * fuel_cliente y fuel_efectivo = servizio_fuel + fuel_cliente con suelo en 0.
 * AnagraficaListiniSection.vue pinta fuel_efectivo junto al delta editable
 * usando estas mismas funciones (fuelBreakdownTitle/formatFuelEfectivo en el
 * componente delegan aquí), así que probarlas cubre lo que el operador ve en
 * esa columna sin tener que montar Vue/Vuetify.
 */
describe('formatFuelEfectivo', () => {
  it('formatea el porcentaje con dos decimales', () => {
    expect(formatFuelEfectivo(29)).toBe('29.00 %');
    expect(formatFuelEfectivo(4.5)).toBe('4.50 %');
  });

  it('NO oculta el 0 (a diferencia de fmtPct): es el suelo real aplicado', () => {
    expect(formatFuelEfectivo(0)).toBe('0.00 %');
  });

  it('devuelve "—" cuando el backend no manda el campo', () => {
    expect(formatFuelEfectivo(undefined)).toBe('—');
    expect(formatFuelEfectivo(null)).toBe('—');
  });
});

describe('fuelBreakdownParts', () => {
  it('ejemplo del expediente: servizio 44% + delta cliente -15% = efectivo 29%', () => {
    const parts = fuelBreakdownParts({ servizio_fuel: 44, fuel_cliente: -15, fuel_efectivo: 29 });
    expect(parts).toEqual({ servizio: '44.00', delta: '-15.00', efectivo: '29.00' });
  });

  it('delta positivo lleva signo + explícito', () => {
    const parts = fuelBreakdownParts({ servizio_fuel: 10, fuel_cliente: 2.5, fuel_efectivo: 12.5 });
    expect(parts.delta).toBe('+2.50');
  });

  it('cliente sin fila propia (fuel_cliente null) asume el delta por defecto (+4%)', () => {
    const parts = fuelBreakdownParts({ servizio_fuel: 20, fuel_cliente: null, fuel_efectivo: 24 });
    expect(parts.delta).toBe('+4.00');
  });

  it('cliente sin fila propia (fuel_cliente undefined, campo ausente) también asume +4%', () => {
    const parts = fuelBreakdownParts({ servizio_fuel: 20, fuel_efectivo: 24 });
    expect(parts.delta).toBe('+4.00');
  });

  it('delta más negativo que el servizio: fuel_efectivo queda en el suelo (0), no en negativo', () => {
    // Caso real: servizio 10% + delta cliente -20% -> el backend ya aplica
    // GREATEST(0, ...) y manda fuel_efectivo = 0. La UI debe reflejar ese 0,
    // no recalcularlo ni mostrarlo como "sin datos".
    const parts = fuelBreakdownParts({ servizio_fuel: 10, fuel_cliente: -20, fuel_efectivo: 0 });
    expect(parts).toEqual({ servizio: '10.00', delta: '-20.00', efectivo: '0.00' });
    expect(formatFuelEfectivo(0)).toBe('0.00 %');
  });
});
