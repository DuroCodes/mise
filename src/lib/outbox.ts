/**
 * offline changes to the shopping list. Each change is tried right away; if
 * the network is down it's saved on the device and replayed in order once the
 * connection is back. The list on screen always includes waiting changes.
 */
import type { ShoppingItem } from "@/lib/api";
import { matchListItem } from "@/shared/pantry";

export type Op =
  | { kind: "check"; id: string; checked: boolean }
  | { kind: "remove"; id: string }
  | {
      kind: "add";
      tempId: string;
      name: string;
      amount: string;
      checked: boolean;
    };

let account = "";
export const outboxFor = (userId: string) => {
  account = userId;
};

const key = () => `mise-outbox:${account}`;
const isTemp = (id: string) => id.startsWith("local-");

const read = () => {
  try {
    const raw = localStorage.getItem(key());
    const value = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(value) ? (value as Op[]) : [];
  } catch {
    return [];
  }
};

const write = (ops: Op[]) => {
  try {
    if (ops.length) localStorage.setItem(key(), JSON.stringify(ops));
    else localStorage.removeItem(key());
  } catch {
    // storage full or blocked; the change stays on screen until reload.
  }
  listeners.forEach((listener) => listener(ops.length));
};

const listeners = new Set<(count: number) => void>();
export const onOutboxChange = (listener: (count: number) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const pendingCount = () => read().length;

/** adds a change, folding it into earlier ones for the same item. */
const enqueue = (op: Op) => {
  let ops = read();
  if (op.kind === "add") ops.push(op);
  else if (isTemp(op.id)) {
    ops = ops.flatMap((entry) => {
      if (entry.kind !== "add" || entry.tempId !== op.id) return [entry];
      if (op.kind === "remove") return [];
      return [{ ...entry, checked: op.checked }];
    });
  } else {
    ops = ops.filter(
      (entry) => !(entry.kind === "check" && entry.id === op.id)
    );
    ops.push(op);
  }
  write(ops);
};

export const withOutbox = (items: ShoppingItem[]) => {
  let list = [...items];
  for (const op of read()) {
    if (op.kind === "check")
      list = list.map((item) =>
        item.id === op.id ? { ...item, checked: op.checked } : item
      );
    else if (op.kind === "remove")
      list = list.filter((item) => item.id !== op.id);
    else
      list.push({
        id: op.tempId,
        name: op.name,
        amount: op.amount,
        unit: "",
        note: "",
        sources: [],
        checked: op.checked,
      });
  }
  return list;
};

const request = async (method: string, path: string, body?: unknown) => {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { network: false };
  }
  // the service worker answers 503 when there's no connection.
  if (response.status === 503) return { network: false };
  const data = (await response.json().catch(() => null)) as unknown;
  return {
    network: true,
    ok: response.ok,
    list: Array.isArray(data) ? (data as ShoppingItem[]) : null,
  };
};

const perform = async (op: Op) => {
  if (op.kind === "check")
    return request("PATCH", `/api/shopping/${op.id}`, { checked: op.checked });
  if (op.kind === "remove") return request("DELETE", `/api/shopping/${op.id}`);
  const amount = op.amount.trim();
  const added = await request(
    "POST",
    "/api/shopping",
    amount ? { name: op.name, amount } : { name: op.name }
  );
  if (!added.network || !added.ok || !op.checked || !added.list) return added;
  const match =
    matchListItem(op.name, added.list) ??
    added.list.find((item) => !item.checked && item.name === op.name);
  return match
    ? request("PATCH", `/api/shopping/${match.id}`, { checked: true })
    : added;
};

let flushing: Promise<boolean> | null = null;

const run = async () => {
  try {
    let ops = read();
    while (ops.length) {
      const [next] = ops;
      if (!next) break;
      const sent = await perform(next);
      if (!sent.network) return false;
      // sent, or rejected for good (e.g. the item was deleted elsewhere): either way it's done.
      ops = read().slice(1);
      write(ops);
    }
    return true;
  } finally {
    flushing = null;
  }
};

/**
 * sends waiting changes in order. Resolves true once nothing is left. If an
 * earlier attempt is still running (and may fail), waits for it, then tries
 * again rather than reporting its stale result.
 */
export const flush = async () => {
  if (flushing) await flushing;
  if (!read().length) return true;
  flushing ??= run();
  return flushing;
};

/**
 * sends one change, or saves it for later when offline. Returns the fresh
 * list when the server answered with one.
 */
export const send = async (op: Op) => {
  if (op.kind !== "add" && isTemp(op.id)) {
    enqueue(op);
    void flush();
    return { queued: true };
  }
  if (pendingCount() > 0) {
    const empty = await flush();
    if (!empty) {
      enqueue(op);
      return { queued: true };
    }
  }
  const sent = await perform(op);
  if (!sent.network) {
    enqueue(op);
    return { queued: true };
  }
  return { queued: false, ok: sent.ok, list: sent.list };
};

export const clearOutbox = () => {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const name = localStorage.key(index);
      if (name?.startsWith("mise-outbox:")) localStorage.removeItem(name);
    }
  } catch {}
};
