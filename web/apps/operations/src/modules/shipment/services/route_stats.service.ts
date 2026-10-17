import { http } from "./http";

export interface RouteStatsRow {
  id: number;
  id_fornitore: number;
  courier_label: string;
  id_servizio_fornitore: number;
  service_label: string;
  opz_par_doc: "P" | "D" | "0" | "";
  colli: number;
  peso: number;
  data_corriere: string;
  data_consegna_prevista: string;
  consegna_data: string;
}

export interface RouteStatsResponse {
  success: boolean;
  route: { country: string; cap: string; city: string };
  rows: RouteStatsRow[];
  couriers?: Record<number, string>;
  services?: Record<number, string>;
  message?: string;
  error?: string;
}

export const routeStatsService = {
  /** ajax_route_stats — top N historical deliveries per route. */
  fetch(params: {
    country: string;
    cap?: string;
    city?: string;
  }): Promise<RouteStatsResponse> {
    return http<RouteStatsResponse>("/ajax_route_stats", { query: params });
  },
};
