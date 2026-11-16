import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseRecipeHtml } from "./recipe-page";

const namedBlocked = (hostname: string) => {
  const name = hostname.toLowerCase().replace(/\.$/, "");
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name.endsWith(".local") ||
    name.endsWith(".internal")
  );
};

const ipv4Blocked = (address: string) => {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
};

const ipv6Blocked = (address: string) => {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1") return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return ipv4Blocked(mapped[1]);
  const head = value.split(":")[0] ?? "";
  if (/^fe[89ab]/.test(head)) return true;
  if (/^f[cd]/.test(head)) return true;
  return false;
};

const addressBlocked = (address: string) => {
  const version = isIP(address);
  if (version === 4) return ipv4Blocked(address);
  if (version === 6) return ipv6Blocked(address);
  return true;
};

const hostAllowed = async (hostname: string) => {
  if (!hostname || namedBlocked(hostname)) return false;
  if (isIP(hostname)) return !addressBlocked(hostname);
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return (
      records.length > 0 &&
      records.every((record) => !addressBlocked(record.address))
    );
  } catch {
    return false;
  }
};

export const publicRecipeUrl = async (raw: string) => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  url.hash = "";
  if (!(await hostAllowed(url.hostname))) return null;
  return url;
};

const blockedPage = (status: number, html: string) =>
  status === 401 ||
  status === 402 ||
  status === 403 ||
  status === 429 ||
  /cdn-cgi\/challenge|cf-browser-verification|Just a moment/i.test(html);

export const importRecipeFromUrl = async (raw: string) => {
  const start = await publicRecipeUrl(raw);
  if (!start)
    return {
      ok: false as const,
      error: "Paste a public http(s) recipe link",
      status: 400 as const,
    };

  let current = start;
  try {
    for (let hop = 0; hop < 4; hop += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mise/0.1 (recipe import)",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location)
          return {
            ok: false as const,
            error: "That site did not return a recipe",
            status: 502 as const,
          };
        const next = await publicRecipeUrl(
          new URL(location, current).toString()
        );
        if (!next)
          return {
            ok: false as const,
            error: "That link left a public recipe page",
            status: 400 as const,
          };
        current = next;
        continue;
      }

      const html = await response.text();
      if (html.length > 2_000_000)
        return {
          ok: false as const,
          error: "That page was too large to import",
          status: 502 as const,
        };
      if (blockedPage(response.status, html)) {
        return {
          ok: false as const,
          error:
            "That site refused the import. Try a page that publishes a recipe without a login wall.",
          status: 502 as const,
        };
      }
      if (!response.ok)
        return {
          ok: false as const,
          error: "That site did not return a recipe",
          status: 502 as const,
        };

      const parsed = parseRecipeHtml(html);
      if (!parsed.ok)
        return {
          ok: false as const,
          error: parsed.error,
          status: 404 as const,
        };
      return { ok: true as const, recipe: parsed.recipe };
    }
  } catch {
    return {
      ok: false as const,
      error: "Could not reach that site",
      status: 502 as const,
    };
  }

  return {
    ok: false as const,
    error: "That site redirected too many times",
    status: 502 as const,
  };
};
