/**
 * Factor que multiplica los plazos de espera de las pruebas. Con el API local contra una BD remota por VPN (~0,3 s de
 * latencia por consulta) cada llamada tarda 10-20 s y los plazos pensados para un API local rápido se quedan cortos.
 * E2E_FACTOR_TIEMPO=1 (por defecto) no cambia nada; con la VPN se usa 4.
 */
export const K = Math.max(1, Number(process.env.E2E_FACTOR_TIEMPO ?? 1) || 1);
