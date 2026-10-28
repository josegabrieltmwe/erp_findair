import { test as base, expect } from "@playwright/test";

/**
 * REGLA INVIOLABLE: las pruebas automáticas NUNCA reservan ni hacen booking de vuelos
 * (ni confirman/cancelan reservas con la aerolínea). Cualquier petición que no sea de
 * lectura a estas acciones se aborta en el navegador y hace fallar la prueba.
 * Si aparece una acción nueva de booking en routes.spa.yaml, añádala aquí.
 */
export const FLIGHT_BOOKING_ACTIONS = [
  "api_cargo_booking",
  "api_cargo_klm_booking",
  "api_cargo_klm_booking_cancel",
  "api_cargo_webcargo_booking",
  "api_cargo_webcargo_booking_cancel",
  "api_cargo_awb_request",
  "api_cargo_mawb_confirmation",
  "api_cargo_cancel",
];

const BOOKING_RE = new RegExp(`/(${FLIGHT_BOOKING_ACTIONS.join("|")})(\\b|/|\\?|$)`);

export const test = base.extend<{ noBooking: void }>({
  noBooking: [
    async ({ context }, use) => {
      const blocked: string[] = [];
      await context.route("**/bff/**", (route) => {
        const req = route.request();
        if (req.method() !== "GET" && req.method() !== "HEAD" && BOOKING_RE.test(req.url())) {
          blocked.push(`${req.method()} ${req.url()}`);
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      await use();
      expect(blocked, "REGLA: se intentó reservar/cancelar un vuelo; las pruebas no deben hacerlo").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
