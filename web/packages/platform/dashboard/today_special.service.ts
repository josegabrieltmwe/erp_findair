/**
 * Contadores de «Da fare oggi» que no tienen KPI propio en el backend. Cada uno lee el total
 * del listado ya filtrado (`pagination.total`) o cuenta filas. Un fallo se propaga: el store lo
 * traduce en «n/d», nunca en 0.
 */
import { http } from "../anagrafiche/services/http";
import { chatService } from "../services/chat.service";
import {
  countGiacenze,
  countOverdueCustomers,
  type GiacenzaRowLike,
} from "./today_catalog";

interface Paged<T = unknown> {
  success?: boolean;
  data?: T[];
  pagination?: { total?: number | string; total_pages?: number | string };
}

/** Total del listado; falla si el servidor no lo informa (mejor «n/d» que un 0 inventado). */
export function totalOf(res: Paged | null | undefined): number {
  const n = Number(res?.pagination?.total);
  if (res?.pagination?.total == null || !Number.isFinite(n))
    throw new Error("total no informado");
  return n;
}

const MAX_GIAC_PAGES = 25;
const MAX_PAYMENT_PAGES = 60;

/** Todas las páginas de un listado, con tope (más páginas = demasiado pesado para una home). */
async function allPages<T>(
  path: string,
  query: Record<string, string>,
  perPage: number,
  maxPages: number,
  signal?: AbortSignal,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await http<Paged<T>>(path, {
      query: { ...query, per_page: String(perPage), page: String(page) },
      signal,
    });
    const data = Array.isArray(res?.data) ? res.data : [];
    rows.push(...data);
    const pages = Number(res?.pagination?.total_pages);
    if (data.length === 0 || !Number.isFinite(pages) || page >= pages)
      return rows;
  }
  throw new Error("demasiadas páginas");
}

type Fetcher = (signal?: AbortSignal) => Promise<Record<string, number>>;

const resi: Fetcher = async (signal) => ({
  resi: totalOf(
    await http<Paged>("/api_courier_shipments", {
      query: { consegna_stato: "5", count_only: "1", per_page: "1" },
      signal,
    }),
  ),
});

const prese: Fetcher = async (signal) => {
  const res = await http<Paged<{ affidata?: string }>>("/api_pickups_crud", {
    query: { affidata: "N", per_page: "200" },
    signal,
  });
  // Un servidor que ignorase el filtro devolvería prese ya asignadas: mejor «n/d» que un número equivocado.
  if ((res.data ?? []).some((p) => String(p.affidata) === "S"))
    throw new Error("filtro affidata ignorado");
  return { prese_daaff: totalOf(res) };
};

const pratiche: Fetcher = async (signal) => ({
  pratiche_lav: totalOf(
    await http<Paged>("/api_crm_crud", {
      query: { stato_pratica: "L", per_page: "1", limit: "1" },
      signal,
    }),
  ),
});

const chat: Fetcher = async () => {
  const res = await chatService.unreadCounter();
  const express = Number(res.data?.express);
  const cargo = Number(res.data?.cargo);
  if (!Number.isFinite(express) || !Number.isFinite(cargo))
    throw new Error("contador de chat no válido");
  return { chat_express: express, chat_cargo: cargo };
};

const giacenze: Fetcher = async (signal) => {
  const rows = await allPages<GiacenzaRowLike>(
    "/api_inventory_crud",
    { open_only: "1" },
    200,
    MAX_GIAC_PAGES,
    signal,
  );
  return countGiacenze(rows);
};

const incassare: Fetcher = async (signal) => {
  const rows = await allPages<
    Parameters<typeof countOverdueCustomers>[0][number]
  >(
    "/api_payments",
    { tipo: "A", statop: "SC" },
    100,
    MAX_PAYMENT_PAGES,
    signal,
  );
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { incassare: countOverdueCustomers(rows, today) };
};

/**
 * Fuentes en dos tandas: primero las baratas (un total), después las que recorren páginas, para que
 * el primer pintado no espere a las pesadas. Las claves de cada fuente son las tarjetas que alimenta.
 */
export const LIGHT_SOURCES: Readonly<
  Record<string, { keys: readonly string[]; fetch: Fetcher; scope?: string }>
> = {
  resi: { keys: ["resi"], fetch: resi },
  prese: { keys: ["prese_daaff"], fetch: prese, scope: "pickups:read" },
  pratiche: { keys: ["pratiche_lav"], fetch: pratiche },
  chat: { keys: ["chat_express", "chat_cargo"], fetch: chat },
};

export const HEAVY_SOURCES: Readonly<
  Record<string, { keys: readonly string[]; fetch: Fetcher; scope?: string }>
> = {
  giacenze: {
    keys: ["giac_dacom", "giac_forn", "giac15"],
    fetch: giacenze,
    scope: "inventory:read",
  },
  incassare: { keys: ["incassare"], fetch: incassare, scope: "payments:read" },
};
