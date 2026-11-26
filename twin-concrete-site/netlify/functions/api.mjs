import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "node:crypto";

export const config = { path: "/api/*" };

const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const user = () => (process.env.ADMIN_USER || "").trim().toLowerCase();
const base = () => process.env.ADMIN_PASSWORD_BASE || "";
// The password is the base plus the current year in Kenya, so it changes on 1 January.
const year = () =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Nairobi", year: "numeric" }).format(new Date());
const todayPassword = () => base() + year();
const secret = () => process.env.ADMIN_SECRET || base() + user();
const sign = (t) => createHmac("sha256", secret()).update(String(t)).digest("hex");
const makeToken = () => {
  const exp = Date.now() + 12 * 3600 * 1000;
  return exp + "." + sign(exp);
};
const same = (x, y) => {
  const a = Buffer.from(String(x)), b = Buffer.from(String(y));
  return a.length === b.length && timingSafeEqual(a, b);
};
const authed = (req) => {
  const [exp, sig] = (req.headers.get("authorization") || "").replace("Bearer ", "").split(".");
  return !!exp && !!sig && Number(exp) > Date.now() && same(sig, sign(exp));
};

export default async (req) => {
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD_BASE)
    return json({ error: "ADMIN_USER and ADMIN_PASSWORD_BASE are not set on Netlify" }, 500);
  const route = new URL(req.url).pathname.replace(/^\/api\//, "");
  const site = getStore("site");
  const imgs = getStore("photos");

  if (route === "login" && req.method === "POST") {
    const { username, password } = await req.json().catch(() => ({}));
    const userOk = same(String(username || "").trim().toLowerCase(), user());
    const passOk = same(password || "", todayPassword());
    return userOk && passOk
      ? json({ token: makeToken() })
      : json({ error: "Wrong password" }, 401);
  }

  if (route === "data") {
    return json({
      prices: (await site.get("prices", { type: "json" })) || null,
      photos: (await site.get("photos", { type: "json" })) || [],
    });
  }

  if (route.startsWith("photo/")) {
    const data = await imgs.get(route.slice(6), { type: "arrayBuffer" });
    return data
      ? new Response(data, {
          headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
        })
      : new Response("Not found", { status: 404 });
  }

  if (!authed(req)) return json({ error: "Please log in again" }, 401);

  if (route === "prices" && req.method === "POST") {
    const prices = await req.json().catch(() => null);
    if (!Array.isArray(prices) || prices.length > 60) return json({ error: "Invalid price list" }, 400);
    const clean = prices.map((p) => ({
      name: String(p.name || "").slice(0, 80),
      unit: String(p.unit || "").slice(0, 30),
      price: String(p.price || "").replace(/[^\d.]/g, "").slice(0, 12),
    }));
    await site.setJSON("prices", clean);
    return json({ ok: true });
  }

  if (route === "photos" && req.method === "POST") {
    const { image, caption } = await req.json().catch(() => ({}));
    if (!image || image.length > 4_000_000) return json({ error: "Photo missing or too large" }, 400);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const buf = Buffer.from(String(image).split(",").pop(), "base64");
    await imgs.set(id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const list = (await site.get("photos", { type: "json" })) || [];
    list.unshift({ id, caption: String(caption || "").slice(0, 120), at: Date.now() });
    await site.setJSON("photos", list);
    return json({ ok: true, id });
  }

  if (route.startsWith("photos/") && req.method === "DELETE") {
    const id = route.slice(7);
    await imgs.delete(id);
    const list = ((await site.get("photos", { type: "json" })) || []).filter((p) => p.id !== id);
    await site.setJSON("photos", list);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
};
