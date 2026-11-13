#!/usr/bin/env node
/* Diagnostyka kanałów: node tools/sprawdz.mjs plik-z-adresami.txt
   Dla każdego adresu podaje status HTTP, typ treści i liczbę pozycji w kanale. */
import fs from "node:fs";
const adresy = fs.readFileSync(process.argv[2], "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
const wynik = await Promise.all(adresy.map(async (u) => {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch(u, { signal: c.signal, redirect: "follow", headers: { "user-agent": "DobowyBriefOSINT/1.0 (+https://piwojold.github.io/dobowy-brief.html)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
    const txt = await r.text();
    const n = (txt.match(/<(item|entry)(\s|>)/gi) || []).length;
    return `${n > 0 ? "OK " : "-- "} ${String(r.status).padEnd(3)} poz:${String(n).padEnd(3)} ${(r.headers.get("content-type") || "?").split(";")[0].padEnd(26)} ${u}${n === 0 ? "   | początek: " + txt.slice(0, 90).replace(/\s+/g, " ") : ""}`;
  } catch (e) { return `ERR     ${(e.cause?.code || e.name || "błąd").padEnd(22)} ${u}`; }
  finally { clearTimeout(t); }
}));
console.log(wynik.sort().join("\n"));
