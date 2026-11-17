/** Browser side of push notifications. */

const flagKey = "mise-push";

export type PushPrefs = { useSoon: boolean; tomorrow: boolean };

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** iPhones only allow notifications for apps added to the Home Screen. */
export const needsInstallForPush = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.matchMedia("(display-mode: standalone)").matches;

const setFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(flagKey, "on");
    else localStorage.removeItem(flagKey);
  } catch {
    // Timers just won't be mirrored to the server.
  }
};

export const pushOn = () => {
  try {
    return localStorage.getItem(flagKey) === "on";
  } catch {
    return false;
  }
};

const fromBase64Url = (value: string) => {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const registration = async () => {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? null;
};

export const currentSubscription = async () => {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
};

const post = (path: string, method: string, body: unknown) =>
  fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** This device's saved settings, or null when notifications are off here. */
export const loadPushPrefs = async () => {
  const subscription = await currentSubscription();
  if (!subscription) {
    setFlag(false);
    return null;
  }
  const response = await post("/api/push/status", "POST", {
    endpoint: subscription.endpoint,
  }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json()) as { prefs: PushPrefs | null };
  setFlag(Boolean(body.prefs));
  return body.prefs;
};

export const enablePush = async (prefs: PushPrefs) => {
  if (!pushSupported()) return "This browser can't show notifications.";
  const reg = await registration();
  if (!reg)
    return "Notifications need the installed app. Reload and try again.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return "Notifications are blocked. Allow them in your browser settings.";
  const keyResponse = await fetch("/api/push/key").catch(() => null);
  if (!keyResponse?.ok) return "Couldn't reach the server.";
  const { publicKey } = (await keyResponse.json()) as { publicKey: string };
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription)
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromBase64Url(publicKey),
    });
  const json = subscription.toJSON();
  const response = await post("/api/push/subscribe", "POST", {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    ...prefs,
  }).catch(() => null);
  if (!response?.ok) {
    const body = (await response?.json().catch(() => null)) as {
      error?: string;
    } | null;
    return body?.error ?? "Couldn't turn on notifications.";
  }
  setFlag(true);
  return null;
};

export const updatePushPrefs = async (prefs: Partial<PushPrefs>) => {
  const subscription = await currentSubscription();
  if (!subscription) return false;
  const response = await post("/api/push/subscribe", "PATCH", {
    endpoint: subscription.endpoint,
    ...prefs,
  }).catch(() => null);
  return Boolean(response?.ok);
};

/** Turns notifications off for this device (also used on sign-out). */
export const disablePush = async () => {
  setFlag(false);
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  await post("/api/push/subscribe", "DELETE", {
    endpoint: subscription.endpoint,
  }).catch(() => null);
  await subscription.unsubscribe().catch(() => false);
};

export const sendTestPush = async () => {
  const response = await fetch("/api/push/test", { method: "POST" }).catch(
    () => null
  );
  if (response?.ok) return null;
  const body = (await response?.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? "Couldn't send a test.";
};

/** Mirrors a kitchen timer to the server so it can ring while the phone is locked. */
export const syncTimer = (
  action: "start" | "stop",
  timer: { id: string; label: string; recipe: string | null; seconds?: number }
) => {
  if (!pushOn()) return;
  const request =
    action === "start"
      ? post("/api/push/timers", "POST", {
          id: timer.id,
          label: timer.label,
          recipe: timer.recipe ?? "",
          seconds: Math.max(1, Math.round(timer.seconds ?? 1)),
        })
      : fetch(`/api/push/timers/${encodeURIComponent(timer.id)}`, {
          method: "DELETE",
        });
  void request.catch(() => undefined);
};
