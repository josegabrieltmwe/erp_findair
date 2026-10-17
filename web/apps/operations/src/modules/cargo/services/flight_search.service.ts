/**
 * Re-export del modulo compartido `@shared/flight-search`.
 *
 * El servicio vivia DUPLICADO en `operations` y `cargo_express`: 1024 lineas
 * cada copia, CERO de diferencia real. Cada cambio habia que escribirlo dos
 * veces, y cuando una copia se quedaba atras el fallo no daba error — solo
 * comportamiento distinto segun la app.
 *
 * Ahora la implementacion es unica y este archivo solo la reexporta, asi que
 * los imports existentes siguen funcionando sin tocar ningun consumidor.
 *
 * Los COMPONENTES de flight-search/ NO se movieron: dependen de cuatro stores
 * de Pinia (`cargo`, `ui`, `cargo_flight_manager`, `toast`), asi que extraerlos
 * seria migrar el modulo cargo entero. Ver el plan, fase B13.3.
 */
export * from "@shared/flight-search/flight_search.service";
