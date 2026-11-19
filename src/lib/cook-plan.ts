export type CookPlan = { mode: "start" | "ready"; time: string; gap: number };

export const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

/** today at HH:MM as epoch ms (tomorrow if a ready-by time has already passed). */
export const anchorFor = (plan: CookPlan, now = Date.now()) => {
  const [hours, minutes] = plan.time.split(":").map(Number);
  const date = new Date(now);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  if (plan.mode === "ready" && date.getTime() < now)
    date.setDate(date.getDate() + 1);
  return date.getTime();
};

/** now, rounded up to the next five minutes, as HH:MM. */
export const nextFiveMinutes = (now = new Date()) => {
  const date = new Date(now);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const key = (recipeId: string) => `mise-cook-${recipeId}-plan`;

export const readPlan = (recipeId: string) => {
  try {
    const raw = sessionStorage.getItem(key(recipeId));
    const value = raw ? (JSON.parse(raw) as Partial<CookPlan>) : null;
    if (
      value &&
      (value.mode === "start" || value.mode === "ready") &&
      typeof value.time === "string" &&
      /^\d{2}:\d{2}$/.test(value.time) &&
      typeof value.gap === "number"
    )
      return {
        mode: value.mode,
        time: value.time,
        gap: Math.min(60, Math.max(1, Math.round(value.gap))),
      };
  } catch {
  }
  return null;
};

export const savePlan = (recipeId: string, plan: CookPlan) => {
  try {
    sessionStorage.setItem(key(recipeId), JSON.stringify(plan));
  } catch {
    // the plan still applies until the page reloads.
  }
};
