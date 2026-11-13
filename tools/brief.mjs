#!/usr/bin/env node
// Narzędzie do danych Dobowego briefu OSINT.
//   node tools/brief.mjs validate            – sprawdza dobowy-brief-data.js
//   node tools/brief.mjs add wydanie.json    – waliduje i dodaje wydanie (zastępuje wydanie z tą samą datą)
import fs from "node:fs";
const FILE = new URL("../dobowy-brief-data.js", import.meta.url);
const PRE = "window.BRIEF_EDITIONS = ";
const KEEP = 90;
const DIMS = ["P","M","E","S","I","X"];
const LABELS = ["Potwierdzona decyzja","Informacja urzędowa","Twierdzenie strony","Doniesienie medialne","Projekt","Zapowiedź"];
const WOJ = ["dolnośląskie","kujawsko-pomorskie","lubelskie","lubuskie","łódzkie","małopolskie","mazowieckie","opolskie","podkarpackie","podlaskie","pomorskie","śląskie","świętokrzyskie","warmińsko-mazurskie","wielkopolskie","zachodniopomorskie"];
const load = () => JSON.parse(fs.readFileSync(FILE, "utf8").trim().replace(PRE, "").replace(/;$/, ""));
const save = eds => fs.writeFileSync(FILE, PRE + JSON.stringify(eds, null, 1) + ";\n");
const str = v => typeof v === "string" && v.trim().length > 0;
function check(ed) {
  const err = [], bad = m => err.push(`${ed.date || "?"}: ${m}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ed.date || "")) bad("date musi mieć format RRRR-MM-DD");
  if (!str(ed.win)) bad("brak win"); if (!str(ed.stop)) bad("brak stop");
  if (!Array.isArray(ed.obraz) || ed.obraz.length < 2 || !ed.obraz.every(str)) bad("obraz: co najmniej 2 akapity");
  if (ed.kind !== undefined && !["auto","redakcja"].includes(ed.kind)) bad("kind: auto albo redakcja");
  if (ed.note !== undefined && !str(ed.note)) bad("note: niepusty tekst albo brak pola");
  const auto = ed.kind === "auto";
  if (!Array.isArray(ed.events) || ed.events.length < 8) { bad("events: co najmniej 8 wątków"); return err; }
  const ids = new Set(), tops = [];
  for (const e of ed.events) {
    const b = m => bad(`[${e.id || "?"}] ${m}`);
    if (!/^[a-z0-9-]+$/.test(e.id || "")) b("id: małe litery, cyfry, myślniki");
    if (ids.has(e.id)) b("powtórzone id"); ids.add(e.id);
    if (!DIMS.includes(e.dim)) b("dim spoza P,M,E,S,I,X");
    if (!Array.isArray(e.sec) || !e.sec.every(x => DIMS.includes(x))) b("sec: tablica wymiarów");
    for (const k of ["title","summary","date","region"]) if (!str(e[k])) b(`brak ${k}`);
    if (auto) { if (!str(e.prov)) b("wydanie auto wymaga prov"); }
    else if (!str(e.why)) b("brak why");
    if (!LABELS.includes(e.label)) b("label spoza listy etykiet");
    if (!["Wysoka","Średnia"].includes(e.rel)) b("rel: Wysoka albo Średnia");
    if (typeof e.follow !== "boolean") b("follow: true/false");
    if (!Array.isArray(e.woj) || !e.woj.every(w => WOJ.includes(w))) b("woj: nazwy województw małymi literami");
    if (e.scope !== undefined && !["kraj","zagr"].includes(e.scope)) b("scope: kraj albo zagr");
    if (!e.scope && !(e.woj || []).length) b("potrzebne woj albo scope");
    if (e.pts !== undefined && !(Array.isArray(e.pts) && e.pts.length && e.pts.every(p => typeof p[0] === "number" && typeof p[1] === "number" && str(p[2]) && p[0] > 48.9 && p[0] < 55 && p[1] > 14 && p[1] < 24.3))) b("pts: [[szer, dług, \"podpis\"]] w granicach Polski");
    if (!Array.isArray(e.sources) || !e.sources.length) b("brak źródeł");
    else for (const s of e.sources) { try { if (!str(s[0]) || !/^https?:$/.test(new URL(s[1]).protocol) || !/^[A-Z]{2}$/.test(s[2])) b("źródło: [nazwa, url, KRAJ]"); } catch { b("zły url: " + s[1]); } }
    if (e.top !== undefined) { tops.push(e.top); if (!str(e.lead)) b("top wymaga lead"); }
  }
  if (tops.slice().sort().join() !== "1,2,3,4,5") bad("top: dokładnie pięć wątków z numerami 1–5");
  return err;
}
const [cmd, arg] = process.argv.slice(2);
let eds = load(), errs = [];
if (cmd === "add") {
  const ed = JSON.parse(fs.readFileSync(arg, "utf8"));
  errs = check(ed);
  const istnieje = eds.find(x => x.date === ed.date);
  if (istnieje && (istnieje.kind || "redakcja") !== "auto" && ed.kind === "auto") {
    // Wydanie redagowane ręcznie ma pierwszeństwo: agregator go nie nadpisuje.
    console.log(`Wydanie ${ed.date} jest redagowane, zostawiam je bez zmian.`);
    process.exit(0);
  }
  if (!errs.length) { eds = [ed, ...eds.filter(x => x.date !== ed.date)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP); save(eds); }
} else if (cmd !== "validate") { console.error("użycie: validate | add plik.json"); process.exit(2); }
errs = errs.concat(eds.flatMap(check));
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log(`OK: ${eds.length} wydań, najnowsze ${eds[0].date} (${eds[0].events.length} wątków)`);
