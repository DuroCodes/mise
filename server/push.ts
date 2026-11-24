import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { aisleFor } from "../src/shared/aisles";
import { dataDir, db, getRecipe } from "./db";
import { pushSubscriptions } from "./db/schema";
import { listPantry } from "./pantry";
import { listPlan } from "./plan";

const keyFile = `${dataDir}/vapid.json`;

const loadKeys = () => {
  const fromEnv = {
    publicKey: process.env.MISE_VAPID_PUBLIC_KEY?.trim() ?? "",
    privateKey: process.env.MISE_VAPID_PRIVATE_KEY?.trim() ?? "",
  };
  if (fromEnv.publicKey && fromEnv.privateKey) return fromEnv;
  if (existsSync(keyFile)) {
    const saved = JSON.parse(readFileSync(keyFile, "utf8")) as typeof fromEnv;
    if (saved.publicKey && saved.privateKey) return saved;
  }
  const generated = webpush.generateVAPIDKeys();
  writeFileSync(keyFile, JSON.stringify(generated), { mode: 0o600 });
  return generated;
};

const keys = loadKeys();
// the VAPID subject must be an https: URL or mailto:. Use the site's own
// address when it's https (never anyone's email); otherwise the project page,
// so a plain-http install still starts.
const site = process.env.BETTER_AUTH_URL?.trim() ?? "";
webpush.setVapidDetails(
  /^https:\/\//i.test(site) ? site : "https://github.com/durocodes/mise",
  keys.publicKey,
  keys.privateKey
);

export const publicKey = keys.publicKey;

// only real browser push services, so the server can't be pointed elsewhere.
const pushHosts = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "push.apple.com",
  "notify.windows.com",
];

export const allowedEndpoint = (raw: string) => {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return pushHosts.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
};

export type Prefs = { useSoon: boolean; tomorrow: boolean };

export const subscriptionFor = (userId: string, endpoint: string) => {
  const row = db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, userId)
      )
    )
    .get();
  return row ? { useSoon: row.useSoon, tomorrow: row.tomorrow } : null;
};

/** saves a device's subscription for this person (a shared device moves to whoever enabled it last). */
export const saveSubscription = (
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string } & Prefs
) => {
  // a new device starts tomorrow for any reminder whose time already passed today.
  const now = new Date();
  const today = dayKey(now);
  db.insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      userId,
      ...input,
      lastUseSoon: now.getHours() >= 9 ? today : null,
      lastTomorrow: now.getHours() >= 18 ? today : null,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: input.p256dh,
        auth: input.auth,
        useSoon: input.useSoon,
        tomorrow: input.tomorrow,
      },
    })
    .run();
};

export const updatePrefs = (
  userId: string,
  endpoint: string,
  prefs: Partial<Prefs>
) => {
  if (!subscriptionFor(userId, endpoint)) return false;
  db.update(pushSubscriptions)
    .set(prefs)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, userId)
      )
    )
    .run();
  return true;
};

export const removeSubscription = (userId: string, endpoint: string) => {
  db.delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, userId)
      )
    )
    .run();
};

export type Note = {
  title: string;
  body: string;
  url: string;
  tag: string;
  kind: "timer" | "use-soon" | "tomorrow" | "test";
};

const deliver = async (
  row: typeof pushSubscriptions.$inferSelect,
  note: Note
) => {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(note),
      {
        TTL: note.kind === "timer" ? 600 : 6 * 3600,
        urgency: note.kind === "timer" ? "high" : "normal",
      }
    );
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    // the browser dropped this subscription; forget it.
    if (status === 404 || status === 410)
      db.delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, row.id))
        .run();
    else console.error("push failed", status ?? error);
    return false;
  }
};

export const sendToUser = async (
  userId: string,
  note: Note,
  only?: (row: typeof pushSubscriptions.$inferSelect) => boolean
) => {
  const rows = db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all()
    .filter((row) => (only ? only(row) : true));
  const results = await Promise.all(rows.map((row) => deliver(row, note)));
  return results.filter(Boolean).length;
};

export const hasSubscription = (userId: string) =>
  Boolean(
    db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .get()
  );

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const perUser = new Map<string, Set<string>>();

export const scheduleTimer = (
  userId: string,
  input: { id: string; label: string; recipe: string; seconds: number }
) => {
  cancelTimer(userId, input.id);
  const mine = perUser.get(userId) ?? new Set<string>();
  if (mine.size >= 20) return false;
  const key = `${userId}:${input.id}`;
  const handle = setTimeout(() => {
    timers.delete(key);
    perUser.get(userId)?.delete(key);
    void sendToUser(userId, {
      title: `${input.label} is done`,
      body: input.recipe || "Your timer finished.",
      url: "/",
      tag: `timer-${input.id}`,
      kind: "timer" as const,
    });
  }, input.seconds * 1000);
  timers.set(key, handle);
  mine.add(key);
  perUser.set(userId, mine);
  return true;
};

export const cancelTimer = (userId: string, id: string) => {
  const key = `${userId}:${id}`;
  const handle = timers.get(key);
  if (handle) clearTimeout(handle);
  timers.delete(key);
  perUser.get(userId)?.delete(key);
};

/** YYYY-MM-DD in the server's time zone. */
export const dayKey = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const plusDays = (day: string, count: number) => {
  const [year, month, date] = day.split("-").map(Number);
  return dayKey(new Date(year ?? 1970, (month ?? 1) - 1, (date ?? 1) + count));
};

/** "Use soon" text for one person's pantry, or null when nothing is close. */
export const soonNote = (userId: string, today: string) => {
  const tomorrow = plusDays(today, 1);
  const soon = listPantry(userId)
    .filter(
      (item) =>
        item.expiresOn &&
        item.expiresOn <= tomorrow &&
        item.expiresOn >= plusDays(today, -2)
    )
    .sort((a, b) => (a.expiresOn ?? "").localeCompare(b.expiresOn ?? ""));
  if (!soon.length) return null;
  const describe = (item: (typeof soon)[number]) =>
    `${item.name} (${item.expiresOn === today ? "today" : item.expiresOn === tomorrow ? "tomorrow" : "expired"})`;
  return {
    title:
      soon.length === 1
        ? `Use your ${soon[0]?.name} soon`
        : `Use soon: ${soon.length} items`,
    body: soon.slice(0, 6).map(describe).join(", "),
    url: "/pantry?tab=make",
    tag: `use-soon-${today}`,
    kind: "use-soon" as const,
  };
};

/** tomorrow's meals, with a thaw reminder when one needs meat or seafood. */
export const tomorrowNote = (userId: string, today: string) => {
  const tomorrow = plusDays(today, 1);
  const meals = listPlan(userId, tomorrow, tomorrow, false);
  if (!meals.length) return null;
  const thaw = new Set<string>();
  for (const meal of meals) {
    const recipe = getRecipe(meal.recipeId, userId);
    for (const item of recipe?.ingredients ?? [])
      if (aisleFor(item.name) === "Meat & Seafood") thaw.add(item.name);
  }
  const titles = meals.map((meal) => meal.title);
  return {
    title: `Tomorrow: ${titles.slice(0, 2).join(" & ")}${titles.length > 2 ? ` +${titles.length - 2}` : ""}`,
    body: thaw.size
      ? `Thaw the ${[...thaw].slice(0, 3).join(", ")} tonight if it's frozen.`
      : "Check you have everything.",
    url: `/plan?week=${tomorrow}`,
    tag: `tomorrow-${today}`,
    kind: "tomorrow" as const,
  };
};

const runDaily = async (now = new Date()) => {
  const today = dayKey(now);
  const hour = now.getHours();
  const rows = db.select().from(pushSubscriptions).all();
  const users = [...new Set(rows.map((row) => row.userId))];
  for (const userId of users) {
    const mine = rows.filter((row) => row.userId === userId);
    if (hour >= 9) {
      const due = mine.filter(
        (row) => row.useSoon && row.lastUseSoon !== today
      );
      if (due.length) {
        const note = soonNote(userId, today);
        if (note)
          await sendToUser(userId, note, (row) =>
            due.some((entry) => entry.id === row.id)
          );
        for (const row of due)
          db.update(pushSubscriptions)
            .set({ lastUseSoon: today })
            .where(eq(pushSubscriptions.id, row.id))
            .run();
      }
    }
    if (hour >= 18) {
      const due = mine.filter(
        (row) => row.tomorrow && row.lastTomorrow !== today
      );
      if (due.length) {
        const note = tomorrowNote(userId, today);
        if (note)
          await sendToUser(userId, note, (row) =>
            due.some((entry) => entry.id === row.id)
          );
        for (const row of due)
          db.update(pushSubscriptions)
            .set({ lastTomorrow: today })
            .where(eq(pushSubscriptions.id, row.id))
            .run();
      }
    }
  }
};

/** checks every few minutes; each reminder goes out at most once a day per device. */
export const startReminders = () => {
  const tick = () =>
    void runDaily().catch((error) => console.error("reminders failed", error));
  setTimeout(tick, 30_000);
  return setInterval(tick, 5 * 60_000);
};
