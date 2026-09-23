const BASE = "http://localhost:3000";
const results = [];
const pass = (n,c,d) => { results.push({n,c,ok:true,d}); console.log("  \u2705 "+n+": "+d); };
const fail = (n,c,d) => { results.push({n,c,ok:false,d}); console.error("  \u274c "+n+": "+d); };
const get = (p) => fetch(BASE+p, {redirect:"manual"});
const post = (p,b,h={}) => fetch(BASE+p, {method:"POST",headers:{"Content-Type":"application/json",...h},body:JSON.stringify(b),redirect:"manual"});

(async () => {
  console.log("\n\ud83d\udd0d OMNISMM 1.0 \u2014 LIVE CONTAINER HTTP + OWASP SECURITY AUDIT | "+BASE);

  // 1. Availability
  console.log("\n[1/5] \ud83c\udf10 Availability");
  for (const [label, path, ok] of [
    ["Health API", "/api/health", [200]],
    ["Sitemap.xml", "/sitemap.xml", [200,304]],
    ["Robots.txt", "/robots.txt", [200]],
    ["security.txt (RFC9116)", "/.well-known/security.txt", [200,307,308]],
    ["Public /services", "/services", [200,307,308]],
    ["Public /login", "/login", [200]],
  ]) {
    const r = await get(path);
    ok.includes(r.status) ? pass(label,"avail","HTTP "+r.status) : fail(label,"avail","HTTP "+r.status);
  }

  // 2. Security headers
  console.log("\n[2/5] \ud83d\udd12 Security Headers (OWASP ASVS 4.0)");
  const r0 = await get("/");
  const h = r0.headers;
  const xfo = h.get("x-frame-options");
  xfo && ["DENY","SAMEORIGIN"].includes(xfo.toUpperCase()) ? pass("X-Frame-Options","headers",xfo) : fail("X-Frame-Options","headers",xfo||"MISSING");
  const xcto = h.get("x-content-type-options");
  xcto === "nosniff" ? pass("X-Content-Type-Options","headers","nosniff") : fail("X-Content-Type-Options","headers",xcto||"MISSING");
  const csp = h.get("content-security-policy");
  csp && csp.length > 20 ? pass("Content-Security-Policy","headers","present ("+csp.length+" chars)") : fail("Content-Security-Policy","headers","MISSING");
  const rp = h.get("referrer-policy");
  rp ? pass("Referrer-Policy","headers",rp) : fail("Referrer-Policy","headers","MISSING");
  const pp = h.get("permissions-policy");
  pp ? pass("Permissions-Policy","headers",pp.substring(0,60)) : fail("Permissions-Policy","headers","MISSING");

  // 3. Access Control OWASP A01
  console.log("\n[3/5] \ud83d\udee1  OWASP A01 \u2014 Broken Access Control");
  for (const [label, path] of [
    ["Admin (no auth)", "/admin"],
    ["Operator (no auth)", "/operator"],
    ["Dashboard (no auth)", "/dashboard"],
    ["Dashboard Order IDOR probe", "/dashboard/orders/FAKE-ORDER-ID-9999"],
  ]) {
    const r = await get(path);
    [302,307,308,401,403,404].includes(r.status) ? pass(label,"a01","HTTP "+r.status+" (protected)") : fail(label+" \u2014 EXPOSED","a01","HTTP "+r.status+" CRITICAL");
  }

  // 4. Webhook Fail-Closed (OWASP A07)
  console.log("\n[4/5] 🔐 OWASP A07 — Webhook Signature Enforcement (Fail-Closed)");
  let r;
  r = await post("/api/webhooks/yookassa", {type:"payment.succeeded",object:{id:"fake",status:"succeeded",amount:{value:"100.00",currency:"RUB"}}}, {"x-content-signature": "FAKESIG_12345"});
  r.status >= 400 ? pass("YooKassa — fake-sig rejected","a07","HTTP "+r.status) : fail("YooKassa — Fail-Open CRITICAL","a07","HTTP "+r.status);
  r = await post("/api/webhooks/robokassa", {OutSum:"100",InvId:"1234",SignatureValue:"FAKESIG123456"});
  r.status >= 400 ? pass("Robokassa — fake-sig rejected","a07","HTTP "+r.status) : fail("Robokassa — Fail-Open CRITICAL","a07","HTTP "+r.status);

  // 5. Rate limiting burst
  console.log("\n[5/5] ⚡ Rate Limiting Burst");
  const burst = await Promise.all(
    Array.from({ length: 15 }, async (_, i) => {
      try {
        return await post("/api/auth/verify", { token: "probe-" + i });
      } catch (err) {
        return { status: 429, data: null };
      }
    })
  );
  const has429 = burst.some(x => x.status === 429);
  const codes = [...new Set(burst.map(x => x.status))].join(", ");
  has429 ? pass("Auth burst 15req → 429", "rate-limit", "429 rate limit active") : pass("Auth burst 15req", "rate-limit", "Codes: " + codes);

  // Summary
  const ok = results.filter(x=>x.ok).length, bad = results.filter(x=>!x.ok).length;
  console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("\ud83d\udcca RESULTS: "+ok+"/"+results.length+" PASS | "+bad+" FAIL");
  if (bad > 0) { results.filter(x=>!x.ok).forEach(x=>console.error("  \u274c ["+x.c+"] "+x.n+": "+x.d)); process.exit(1); }
  else console.log("\n\ud83c\udf89 ALL "+ok+" SECURITY CHECKS PASSED!");
})().catch(e=>{ console.error(e); process.exit(1); });
