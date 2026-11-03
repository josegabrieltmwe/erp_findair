import { describe, expect, it, vi } from "vitest";
import { buildCsv, csvEscape, fetchAllRows } from "./listing/csv";
import type { QueueItem, QueuePage } from "./types";

describe("CSV", () => {
  it("BOM UTF-8, separador ; y comillas solo cuando hacen falta", () => {
    const csv = buildCsv(
      [
        { id: 1, name: "Acme; S.L.", note: 'dice "hola"' },
        { id: 2, name: "Ñandú", note: null },
      ],
      [
        { label: "ID", value: (r) => r.id },
        { label: "Cliente", value: (r) => r.name },
        { label: "Nota", value: (r) => r.note },
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("ID;Cliente;Nota");
    expect(lines[1]).toBe('1;"Acme; S.L.";"dice ""hola"""');
    expect(lines[2]).toBe("2;Ñandú;");
  });

  it("csvEscape con saltos de línea", () => {
    expect(csvEscape("a\nb")).toBe('"a\nb"');
    expect(csvEscape(undefined)).toBe("");
  });

  it("fetchAllRows pide páginas de 100 hasta el máximo y avisa del recorte", async () => {
    const page = (p: number): QueuePage => ({
      items: Array.from(
        { length: 100 },
        (_, i) => ({ id: (p - 1) * 100 + i }) as QueueItem,
      ),
      count: 450,
      current_page: p,
      max_page: 5,
    });
    const fetcher = vi.fn(async (q: Record<string, string | number>) =>
      page(Number(q.page)),
    );
    const res = await fetchAllRows({ stato: "A,P,C" }, fetcher, 250);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][0]).toMatchObject({
      stato: "A,P,C",
      page: 1,
      per_page: 100,
    });
    expect(res.rows).toHaveLength(250);
    expect(res.truncated).toBe(true);
    expect(res.total).toBe(450);
  });
});
