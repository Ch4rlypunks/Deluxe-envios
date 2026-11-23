import { CIUDAD, HOSTS_PERMITIDOS } from "./config.js";

export const mapsUrl = d => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(d + ", " + CIUDAD);
export const waUrl = t => { const d = String(t || "").replace(/\D/g, "").slice(-10); return d.length === 10 ? "https://wa.me/52" + d : null; };

/* Anti-XSS / phishing: solo https:// sin credenciales, o código alfanumérico */
export function parseSeguimiento(raw) {
  const v = String(raw || "").trim();
  if (!v) return { ok: true, value: null };
  if (/^[A-Za-z0-9-]{4,40}$/.test(v)) return { ok: true, value: v };
  if (v.length > 300) return { ok: false };
  let u; try { u = new URL(v); } catch { return { ok: false }; }
  if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".") || u.href.length > 300) return { ok: false };
  if (HOSTS_PERMITIDOS.length && !HOSTS_PERMITIDOS.some(h => u.hostname === h || u.hostname.endsWith("." + h))) return { ok: false };
  return { ok: true, value: u.href };
}

/* NIP de autorización: nunca se guarda ni se compara en texto plano, solo su hash con sal. */
const aHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export async function hashPin(pin, salt) { return aHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin))); }
export function nuevaSal() { return aHex(crypto.getRandomValues(new Uint8Array(16)).buffer); }
