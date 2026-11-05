import { describe, expect, it, vi } from "vitest";
import {
  KeepAlive,
  createRenderer,
  defineComponent,
  h,
  nextTick,
  shallowRef,
  type Component,
} from "vue";
import { useListEntry } from "@shared/listing/useListEntry";
import { createKpiCounter } from "@shared/listing/kpiCounter";

/**
 * Renderer mínimo sin DOM (el vitest de operations corre en `node`, sin
 * jsdom): basta para que Vue monte componentes y ejecute los hooks reales de
 * <KeepAlive> (mounted / activated / deactivated).
 */
type FakeNode = { tag: string; children: FakeNode[]; parent: FakeNode | null; text?: string };
const mk = (tag: string): FakeNode => ({ tag, children: [], parent: null });
const { createApp } = createRenderer<FakeNode, FakeNode>({
  createElement: (tag) => mk(tag),
  createText: (text) => ({ ...mk("#text"), text }),
  createComment: (text) => ({ ...mk("#comment"), text }),
  setText: (n, text) => {
    n.text = text;
  },
  setElementText: (n, text) => {
    n.children = [];
    n.text = text;
  },
  insert: (child, parent, anchor) => {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = parent;
    const i = anchor ? parent.children.indexOf(anchor) : -1;
    if (i >= 0) parent.children.splice(i, 0, child);
    else parent.children.push(child);
  },
  remove: (child) => {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = null;
  },
  parentNode: (n) => n.parent,
  nextSibling: (n) => {
    if (!n.parent) return null;
    return n.parent.children[n.parent.children.indexOf(n) + 1] ?? null;
  },
  patchProp: () => {},
});

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await nextTick();
}

describe("useListEntry bajo <KeepAlive>", () => {
  function mountWithKeepAlive(enter: () => Promise<void>, onReenter?: () => void) {
    const List = defineComponent({
      name: "List",
      setup() {
        useListEntry(enter, { onReenter });
        return () => h("div", "list");
      },
    });
    const Detail = defineComponent({ name: "Detail", render: () => h("div", "detail") });
    const current = shallowRef<Component>(List);
    const app = createApp({
      render: () => h(KeepAlive, null, [h(current.value)]),
    });
    app.mount(mk("root"));
    return { current, List, Detail, app };
  }

  it("la primera visita carga UNA vez (no mounted + activated)", async () => {
    const enter = vi.fn(async () => {});
    mountWithKeepAlive(enter);
    await flush();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it("volver del detalle recarga una vez e invalida los KPI", async () => {
    const enter = vi.fn(async () => {});
    const onReenter = vi.fn();
    const { current, List, Detail } = mountWithKeepAlive(enter, onReenter);
    await flush();
    current.value = Detail;
    await flush();
    current.value = List;
    await flush();
    expect(enter).toHaveBeenCalledTimes(2);
    expect(onReenter).toHaveBeenCalledTimes(1);
    current.value = Detail;
    await flush();
    current.value = List;
    await flush();
    expect(enter).toHaveBeenCalledTimes(3);
  });

  it("fuera de KeepAlive carga en el montaje", async () => {
    const enter = vi.fn(async () => {});
    const List = defineComponent({
      setup() {
        useListEntry(enter);
        return () => h("div");
      },
    });
    createApp(List).mount(mk("root"));
    await flush();
    expect(enter).toHaveBeenCalledTimes(1);
  });
});

describe("createKpiCounter", () => {
  it("deduplica por clave de filtro (watcher + entrada = 1 tanda)", async () => {
    const fetchTotal = vi.fn(async (key: string) => key.length);
    const kpi = createKpiCounter({ keys: ["a", "bb", "ccc"], fetchTotal });
    await Promise.all([kpi.refresh("f1"), kpi.refresh("f1")]);
    await kpi.refresh("f1");
    expect(fetchTotal).toHaveBeenCalledTimes(3);
    expect(kpi.counts.value).toEqual({ a: 1, bb: 2, ccc: 3 });
    await kpi.refresh("f2");
    expect(fetchTotal).toHaveBeenCalledTimes(6);
  });

  it("invalidate obliga a recontar el mismo filtro", async () => {
    const fetchTotal = vi.fn(async () => 7);
    const kpi = createKpiCounter({ keys: ["a"], fetchTotal });
    await kpi.refresh("f");
    kpi.invalidate();
    await kpi.refresh("f");
    expect(fetchTotal).toHaveBeenCalledTimes(2);
  });

  it("cancela la tanda anterior y no pinta su resultado", async () => {
    const signals: AbortSignal[] = [];
    let resolveFirst: (n: number) => void = () => {};
    const fetchTotal = vi.fn((_key: string, signal: AbortSignal) => {
      signals.push(signal);
      if (signals.length === 1) return new Promise<number>((r) => (resolveFirst = r));
      return Promise.resolve(2);
    });
    const kpi = createKpiCounter({ keys: ["a"], fetchTotal });
    const first = kpi.refresh("f1");
    await kpi.refresh("f2");
    expect(signals[0]!.aborted).toBe(true);
    resolveFirst(99);
    await first;
    expect(kpi.counts.value.a).toBe(2);
  });

  it("abort al salir: la siguiente entrada vuelve a pedir", async () => {
    const fetchTotal = vi.fn(
      (_k: string, signal: AbortSignal) =>
        new Promise<number>((resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
          setTimeout(() => resolve(1), 50);
        }),
    );
    const kpi = createKpiCounter({ keys: ["a"], fetchTotal });
    const p = kpi.refresh("f");
    kpi.abort();
    await p;
    expect(kpi.counts.value.a).toBeUndefined();
    await kpi.refresh("f");
    expect(fetchTotal).toHaveBeenCalledTimes(2);
  });

  it("un KPI que falla vuelve a '—' y se reintenta en la siguiente", async () => {
    const fetchTotal = vi
      .fn<(key: string, signal: AbortSignal) => Promise<number>>()
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue(4);
    const kpi = createKpiCounter({ keys: ["a"], fetchTotal });
    kpi.counts.value.a = 1;
    await kpi.refresh("f");
    expect(kpi.counts.value.a).toBeUndefined();
    await kpi.refresh("f");
    expect(kpi.counts.value.a).toBe(4);
  });
});
