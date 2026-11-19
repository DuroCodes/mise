/** where a received recipe waits for the editor to pick it up. */
export const receivedKey = "mise-received";

/**
 * the "Send to Mise" bookmark. On a recipe page it opens Mise's /receive page
 * and, once that page says it's ready, hands it the page's URL and HTML. The
 * message only goes to this Mise origin, and only to the window it opened.
 */
export const bookmarkletFor = (origin: string) => {
  const code = `(()=>{const O=${JSON.stringify(origin)};const w=window.open(O+"/receive","mise-receive");if(!w){alert("Allow pop-ups for this site to send recipes to Mise.");return}const d={type:"mise-page",url:location.href,html:document.documentElement.outerHTML.slice(0,4500000)};const f=e=>{if(e.origin!==O||e.source!==w||e.data!=="mise-ready")return;w.postMessage(d,O);removeEventListener("message",f)};addEventListener("message",f);setTimeout(()=>removeEventListener("message",f),180000)})();`;
  return `javascript:${encodeURIComponent(code)}`;
};

export type ReceivedPage = { url: string; html: string };

/** accepts only a well-formed page message (it comes from an untrusted site). */
export const readPageMessage = (data: unknown) => {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (value.type !== "mise-page") return null;
  if (typeof value.url !== "string" || typeof value.html !== "string")
    return null;
  if (!/^https?:\/\//i.test(value.url) || value.url.length > 2000) return null;
  if (!value.html.length || value.html.length > 5_000_000) return null;
  return { url: value.url, html: value.html };
};
