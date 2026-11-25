#!/usr/bin/env node
/*
 * Agregator Dobowego briefu OSINT Polska.
 *
 *   node tools/agreguj.mjs --out /tmp/wydanie.json [--godziny 24] [--data 2026-11-14]
 *   (--zrodla inny-plik.json przydaje się w testach)
 *
 * Czyta kanały RSS/Atom z tools/zrodla.json, bierze pozycje z ostatniej doby,
 * łączy te same tematy zgłoszone przez kilka kanałów i zapisuje wydanie w formacie
 * opisanym w tools/BRIEF-INSTRUKCJA.md. Nic nie analizuje: grupuje nagłówki,
 * przypisuje wymiar PMESII i region po słowach kluczowych. Bez zależności zewnętrznych.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const MAX_WATKOW = 25;
const MIN_WATKOW = 8;
const LIMIT_KANALU = 60;
const TIMEOUT_MS = 20000;

/* ---------- argumenty ---------- */
const arg = (n, d = null) => {
  const i = process.argv.indexOf("--" + n);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const OUT = arg("out", "/tmp/wydanie.json");
const GODZINY = Number(arg("godziny", "24"));

/* ---------- czas w strefie Europe/Warsaw ---------- */
const TZ = "Europe/Warsaw";
const czesci = (d) => Object.fromEntries(
  new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" })
    .formatToParts(d).map((p) => [p.type, p.value]));
const dataISO = (d) => { const c = czesci(d); return `${c.year}-${c.month}-${c.day}`; };
const krotka = (d) => { const c = czesci(d); return `${Number(c.day)}.${c.month}.${c.year}`; };
const zegar = (d) => { const c = czesci(d); return `${c.hour}:${c.minute}`; };
const strefa = (d) => (czesci(d).timeZoneName || "CET").replace("GMT+1", "CET").replace("GMT+2", "CEST");
const MIESIACE = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const slownie = (d) => { const c = czesci(d); return `${Number(c.day)} ${MIESIACE[Number(c.month) - 1]} ${c.year}`; };

const TERAZ = new Date();
const OD = new Date(TERAZ.getTime() - GODZINY * 3600e3);
const DATA_WYD = arg("data", dataISO(TERAZ));

/* ---------- parser RSS/Atom ---------- */
const ENCJE = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", oacute: "ó", bdquo: "„", rdquo: "”", ldquo: "“", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»", sbquo: "‚", rsquo: "’", lsquo: "‘" };
function odkoduj(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENCJE[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}
const tag = (xml, ...nazwy) => {
  for (const n of nazwy) {
    const m = xml.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i"));
    if (m) return odkoduj(m[1]);
  }
  return "";
};
function link(xml) {
  const a = tag(xml, "link");
  if (a && /^https?:/i.test(a)) return a;
  const m = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  return m ? odkoduj(m[1]) : "";
}
function parsuj(xml) {
  const bloki = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  return bloki.slice(0, LIMIT_KANALU).map((b) => {
    const d = tag(b, "pubDate", "published", "updated", "dc:date");
    const t = d ? new Date(d) : null;
    return { tytul: tag(b, "title"), url: link(b), czas: t && !isNaN(t) ? t : null };
  }).filter((x) => x.tytul && /^https?:\/\//i.test(x.url));
}

/* ---------- normalizacja ---------- */
const bezZnakow = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");
const plaski = (s) => bezZnakow(String(s)).toLowerCase();
const STOP = new Set("jest sie nie dla pod nad przez oraz tego temu tym ten ta to po za od do na we wo przy czy jak ich jego jej ale lub nowy nowa nowe byl byla bylo beda jako juz tylko tez tak nad przed miedzy wobec wraz podczas wedlug roku rok dnia dzien godz proc mln tys mld zl wideo foto zdjecia relacja".split(" "));
const rdzenie = (s) => [...new Set(plaski(s).replace(/[^a-z0-9ąćęłńóśźż ]/g, " ").split(/\s+/)
  .filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.slice(0, 6)))];
const wspolne = (a, b) => { const B = new Set(b); return [...new Set(a)].filter((x) => B.has(x)); };
const jaccard = (a, b) => wspolne(a, b).length / (new Set([...a, ...b]).size || 1);
// Nagłówki tego samego tematu bywają inaczej sformułowane, więc o połączeniu decydują
// wspólne słowa rzadkie w całym oknie, a nie podobieństwo całych tytułów.
function tenSamTemat(a, b, df, n) {
  const w = wspolne(a, b);
  if (!w.length) return false;
  const prog = Math.max(3, Math.round(n * 0.05));
  const rzadkie = w.filter((t) => (df.get(t) || 0) <= prog).length;
  const pokrycie = w.length / Math.min(a.length, b.length);
  return (rzadkie >= 2 && pokrycie >= 0.25) || pokrycie >= 0.6;
}
function kanoniczny(u) {
  try { const x = new URL(u); x.hash = ""; x.search = ""; x.hostname = x.hostname.replace(/^www\./, ""); return x.toString().replace(/\/$/, ""); }
  catch { return u; }
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

/* ---------- słowniki ---------- */
const WYMIARY = {
  M: ["wojsk", "armia", "żołnierz", "mundurow", "obronn", "nato", "dowództwo operacyjne", "myśliwc", "dron", "bezzałog", "przestrzeń powietrzn", "granic", "straż graniczna", "abw", "skw", "szpiegost", "dywersj", "sabotaż", "kontrwywiad", "wywiad", "służb specjaln", "policj", "prokuratur", "zatrzyman", "aresztow", "terroryst", "poligon", "manewr", "ćwiczenia wojskow", "czołg", "amunicj", "uzbrojen", "rakiet", "mon", "komandos", "białorus", "kaliningrad", "królewieck", "rosyjsk", "rosji", "wojna", "front", "ukrain"],
  I: ["cyberatak", "cyberbezpiecz", "haker", "phishing", "ransomware", "incydent", "teleinform", "dezinformacj", "fake news", "nask", "cert polska", "botów", "wyciek danych", "dane osobow", "epuap", "mobywatel", "profil zaufany", "cyfryzacj", "sztuczn inteligencj", "serwis społecznościow", "mediach społecznościow", "platform", "domen", "oprogramowan", "aplikacj"],
  E: ["gospodark", "inflacj", "nbp", "rpp", "stopy procentow", "złoty", "giełd", "budżet", "podatk", "pkb", "przedsiebiorc", "spółk", "fuzj", "przejęci", "zwolni grupow", "bezroboci", "wynagrodz", "ceny paliw", "cena prądu", "energi", "gaz", "węgiel", "orlen", "eksport", "import", "inwestycj", "kontrakt", "umow", "miliard", "milion złotych", "rynk", "bank", "kredyt", "akcjonariusz", "fabry"],
  P: ["prezydent", "premier", "rząd", "sejm", "senat", "minist", "ustaw", "weto", "zawetowa", "rozporządzen", "koalicj", "opozycj", "partia", "pis", "platforma obywatelsk", "konfederacj", "lewic", "trybunał konstytucyjn", "sąd najwyższ", "wybory", "kampani", "głosowan", "unia europejsk", "komisja europejsk", "tsue", "szczyt", "dyplomac", "ambasad", "nominacj", "dymisj", "marszałek sejmu", "kancelaria prezydenta"],
  S: ["protest", "manifestac", "strajk", "marsz", "zgromadzen", "szkoł", "uczni", "student", "szpital", "pacjent", "lekarz", "zdrowi", "epidemi", "wypadek", "ofiar", "ranny", "zginął", "pożar", "powódź", "mieszkań", "czynsz", "emerytur", "rodzin", "dzieci", "kościół", "społeczn", "mieszkańc", "kultur", "pogrzeb", "żałob", "strażac", "ewakuac"],
  X: ["kolei", "kolejow", "pkp", "pociąg", "torach", "torowisk", "dworzec", "droga krajow", "autostrad", "ekspresow", "most", "lotnisk", "portow", "porcie", "prom", "energetyk", "elektrowni", "sieć przesył", "gazociąg", "rurociąg", "wodociąg", "awaria", "infrastruktur", "imgw", "ostrzeżeni", "śnieg", "wiatr", "mróz", "remont", "budow", "tunel", "ruch drogow", "przerwa w dostaw", "blackout"],
};
// miasto -> [szerokość, długość, województwo]
const MIASTA = {
  "warszaw": [52.23, 21.01, "mazowieckie"], "kraków": [50.06, 19.94, "małopolskie"], "łódź": [51.76, 19.46, "łódzkie"],
  "wrocław": [51.11, 17.03, "dolnośląskie"], "poznań": [52.41, 16.93, "wielkopolskie"], "gdańsk": [54.35, 18.65, "pomorskie"],
  "gdyni": [54.52, 18.53, "pomorskie"], "sopot": [54.44, 18.56, "pomorskie"], "szczecin": [53.43, 14.55, "zachodniopomorskie"],
  "bydgoszcz": [53.12, 18.00, "kujawsko-pomorskie"], "toruń": [53.01, 18.60, "kujawsko-pomorskie"], "lublin": [51.25, 22.57, "lubelskie"],
  "białystok": [53.13, 23.16, "podlaskie"], "katowic": [50.26, 19.02, "śląskie"], "gliwic": [50.29, 18.67, "śląskie"],
  "częstochow": [50.81, 19.12, "śląskie"], "sosnowiec": [50.28, 19.13, "śląskie"], "rybnik": [50.09, 18.54, "śląskie"],
  "bielsk": [49.82, 19.04, "śląskie"], "rzeszów": [50.04, 22.00, "podkarpackie"], "przemyśl": [49.78, 22.77, "podkarpackie"],
  "kielc": [50.87, 20.63, "świętokrzyskie"], "olsztyn": [53.78, 20.48, "warmińsko-mazurskie"], "elbląg": [54.16, 19.40, "warmińsko-mazurskie"],
  "opol": [50.67, 17.93, "opolskie"], "zielon": [51.94, 15.51, "lubuskie"], "gorzów": [52.74, 15.23, "lubuskie"],
  "radom": [51.40, 21.15, "mazowieckie"], "płock": [52.55, 19.71, "mazowieckie"], "siedlc": [52.17, 22.29, "mazowieckie"],
  "legnic": [51.21, 16.16, "dolnośląskie"], "wałbrzych": [50.77, 16.28, "dolnośląskie"], "kalisz": [51.76, 18.09, "wielkopolskie"],
  "konin": [52.22, 18.25, "wielkopolskie"], "koszalin": [54.19, 16.17, "zachodniopomorskie"], "kołobrzeg": [54.18, 15.58, "zachodniopomorskie"],
  "słupsk": [54.46, 17.03, "pomorskie"], "suwałk": [54.10, 22.93, "podlaskie"], "łomż": [53.18, 22.08, "podlaskie"],
  "zamoś": [50.72, 23.25, "lubelskie"], "chełm": [51.14, 23.47, "lubelskie"], "tarnów": [50.01, 20.99, "małopolskie"],
  "nowy sącz": [49.62, 20.70, "małopolskie"], "oświęcim": [50.04, 19.22, "małopolskie"], "inowrocław": [52.80, 18.26, "kujawsko-pomorskie"],
  "włocławek": [52.65, 19.07, "kujawsko-pomorskie"], "piotrków": [51.41, 19.70, "łódzkie"], "ostrowiec": [50.93, 21.39, "świętokrzyskie"],
  "stalowa wol": [50.58, 22.05, "podkarpackie"], "świnoujści": [53.91, 14.25, "zachodniopomorskie"], "augustów": [53.84, 22.98, "podlaskie"],
};
// Dopasowanie od początku wyrazu: "warszaw" złapie "Warszawie", ale "rzym" nie złapie "utrzymał".
const ucieczka = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function odsl(tekst, klucz) {
  const slowa = plaski(klucz).split(/\s+/).filter(Boolean);
  // Fraza: wszystkie człony muszą wystąpić jako początki wyrazów (odmiana nie przeszkadza).
  if (slowa.length > 1) return slowa.every((w) => new RegExp(`(^|[^a-z0-9])${ucieczka(w)}`).test(tekst));
  const w = slowa[0];
  // Krótki rdzeń dopuszcza najwyżej dwie litery końcówki, żeby "gaz" nie trafiało w "gazeta".
  const wzor = w.length <= 4 ? `(^|[^a-z0-9])${ucieczka(w)}[a-ząćęłńóśźż]{0,2}([^a-z0-9ąćęłńóśźż]|$)` : `(^|[^a-z0-9])${ucieczka(w)}`;
  return new RegExp(wzor).test(tekst);
}
// Potoczne nazwy regionów i rdzenie przymiotników, bo nagłówki rzadko odmieniają "województwo" wprost.
const REGIONY = {
  "dolnośląskie": ["dolnoslask", "dolny slask", "dolnego slaska"], "kujawsko-pomorskie": ["kujawsko-pomorsk", "kujawy"],
  "lubelskie": ["lubelsk", "lubelszczyzn"], "lubuskie": ["lubusk", "ziemia lubusk"], "łódzkie": ["lodzk"],
  "małopolskie": ["malopolsk", "malopolska"], "mazowieckie": ["mazowieck", "mazowsz"], "opolskie": ["opolsk", "opolszczyzn"],
  "podkarpackie": ["podkarpack", "podkarpaci"], "podlaskie": ["podlask", "podlasi"], "pomorskie": ["pomorsk", "pomorz", "trojmiast"],
  "śląskie": ["slask", "gornoslask", "gornego slask"], "świętokrzyskie": ["swietokrzysk"],
  "warmińsko-mazurskie": ["warminsko-mazursk", "warmii", "warmia", "mazur"], "wielkopolskie": ["wielkopolsk", "wielkopolska"],
  "zachodniopomorskie": ["zachodniopomorsk"],
};
const ZAGRANICA = "bruksel waszyngton moskw kijów kijow berlin pary londyn dublin bratysław bratyslaw praga budapeszt wilno ryga tallin madryt rzym wiedeń wieden sztokholm kopenhag helsink ankar pekin tokio nowy jork strasburg luksemburg haga genew".split(" ");

function wymiar(t) {
  const s = plaski(t);
  let best = "P", score = 0;
  for (const [k, slowa] of Object.entries(WYMIARY)) {
    let n = 0;
    for (const w of slowa) if (odsl(s, w)) n++;
    if (n > score) { score = n; best = k; }
  }
  return score ? best : "S"; // bez trafienia: traktuj jak wiadomość ogólną
}
function miejsce(t) {
  const s = plaski(t);
  const woj = new Set(), pts = [];
  for (const [klucz, [la, lo, w]] of Object.entries(MIASTA)) {
    if (odsl(s, klucz)) {
      woj.add(w);
      const nazwa = klucz === "warszaw" ? "Warszawa" : klucz[0].toUpperCase() + klucz.slice(1);
      if (!pts.some((p) => p[2] === nazwa)) pts.push(klucz === "warszaw" ? [la, lo, "Warszawa", "l"] : [la, lo, nazwa]);
    }
  }
  for (const [w, warianty] of Object.entries(REGIONY)) if (warianty.some((v) => odsl(s, v))) woj.add(w);
  const zagr = !woj.size && !pts.length && ZAGRANICA.some((z) => odsl(s, z));
  return { woj: [...woj].slice(0, 3), pts: pts.slice(0, 3), zagr };
}

/* ---------- pobieranie ---------- */
async function pobierz(k) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(k.url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "DobowyBriefOSINT/1.0 (+https://piwojold.github.io/dobowy-brief.html)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
    if (!r.ok) return { k, blad: "HTTP " + r.status, poz: [] };
    const poz = parsuj(await r.text()).map((p) => ({ ...p, zrodlo: k.nazwa, typ: k.typ, host: host(p.url) }));
    return { k, poz };
  } catch (e) {
    return { k, blad: String(e.name === "AbortError" ? "timeout" : e.message).slice(0, 80), poz: [] };
  } finally { clearTimeout(t); }
}

/* ---------- główna część ---------- */
const konfig = JSON.parse(fs.readFileSync(arg("zrodla", path.join(KATALOG, "zrodla.json")), "utf8"));
const wyniki = await Promise.all(konfig.kanaly.map(pobierz));
const dzialajace = wyniki.filter((w) => !w.blad && w.poz.length);
const niedzialajace = wyniki.filter((w) => w.blad || !w.poz.length);
for (const w of wyniki) console.log(`${w.blad || !w.poz.length ? "✗" : "✓"} ${w.k.nazwa}: ${w.blad || w.poz.length + " poz."}`);

// pozycje z okna
const widziane = new Set();
const pozycje = [];
for (const w of dzialajace) for (const p of w.poz) {
  if (!p.czas || p.czas < OD || p.czas > new Date(TERAZ.getTime() + 36e5)) continue;
  const kan = kanoniczny(p.url);
  if (widziane.has(kan)) continue;
  widziane.add(kan);
  pozycje.push({ ...p, kan, rdz: rdzenie(p.tytul) });
}
pozycje.sort((a, b) => b.czas - a.czas);
console.log(`\nPozycje w oknie ${GODZINY} h: ${pozycje.length} z ${dzialajace.length} kanałów`);

// grupowanie tematów
const DF = new Map();
for (const p of pozycje) for (const t of p.rdz) DF.set(t, (DF.get(t) || 0) + 1);
const grupy = [];
for (const p of pozycje) {
  const g = grupy.find((g) => g.czlonkowie.some((m) => tenSamTemat(m.rdz, p.rdz, DF, pozycje.length)));
  if (g) { g.czlonkowie.push(p); if (p.czas < g.od) g.od = p.czas; }
  else grupy.push({ czlonkowie: [p], od: p.czas });
}
for (const g of grupy) {
  g.hosty = new Set(g.czlonkowie.map((m) => m.host));
  g.urzad = g.czlonkowie.some((m) => m.typ === "urzad");
}
grupy.sort((a, b) => (b.hosty.size - a.hosty.size) || (b.czlonkowie.length - a.czlonkowie.length) || (b.czlonkowie[0].czas - a.czlonkowie[0].czas));

const wybrane = grupy.slice(0, MAX_WATKOW);
if (wybrane.length < MIN_WATKOW) {
  console.error(`\nBŁĄD: tylko ${wybrane.length} wątków (minimum ${MIN_WATKOW}). Nie zapisuję wydania.`);
  process.exit(1);
}

const uzyteId = new Set();
const events = wybrane.map((g, i) => {
  const glowny = g.czlonkowie.slice().sort((a, b) => b.tytul.length - a.tytul.length)[0];
  const tekst = g.czlonkowie.map((m) => m.tytul).join(" ");
  const { woj, pts, zagr } = miejsce(tekst);
  let id = plaski(glowny.tytul).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").filter(Boolean).slice(0, 4).join("-").slice(0, 40) || "watek";
  while (uzyteId.has(id)) id += "-" + (i + 1);
  uzyteId.add(id);
  const inne = g.czlonkowie.filter((m) => m !== glowny).slice(0, 3).map((m) => `„${m.tytul}” (${m.zrodlo})`);
  const e = {
    id,
    dim: wymiar(tekst),
    sec: [],
    title: glowny.tytul.slice(0, 160),
    summary: `Temat zgłoszony przez ${g.hosty.size} ${g.hosty.size === 1 ? "kanał" : g.hosty.size < 5 ? "kanały" : "kanałów"} między ${zegar(g.od)} a ${zegar(g.czlonkowie[0].czas)}.`
      + (inne.length ? ` Inne nagłówki: ${inne.join("; ")}.` : " Pozostałe kanały nie podały tego tematu w tym oknie.")
      + " Treść wpisu to nagłówki kanałów, nie streszczenie artykułów. Szczegóły w źródłach.",
    prov: `Wpis zbudowany automatycznie: zgrupowane nagłówki ${g.czlonkowie.length} pozycji RSS. Wymiar PMESII i region przypisane po słowach kluczowych, więc mogą być nietrafione. Brak oceny wiarygodności i znaczenia.`,
    sources: [...new Map(g.czlonkowie.map((m) => [m.host, [m.zrodlo, m.url, "PL"]])).values()].slice(0, 4),
    date: g.od && dataISO(g.od) !== DATA_WYD ? `${krotka(g.od).slice(0, 5)}–${krotka(TERAZ).slice(0, 5)}` : krotka(TERAZ).slice(0, 5),
    region: woj.length ? woj.join(", ") : zagr ? "Poza Polską" : "Polska, bez przypisanego regionu",
    label: g.urzad ? "Informacja urzędowa" : "Doniesienie medialne",
    rel: g.hosty.size >= 3 ? "Wysoka" : "Średnia",
    follow: false,
    woj,
  };
  if (!woj.length) e.scope = zagr ? "zagr" : "kraj";
  if (pts.length && woj.length) e.pts = pts;
  return e;
});

// pięć tematów z największą liczbą kanałów
events.slice(0, 5).forEach((e, i) => {
  e.top = i + 1;
  e.lead = `Zgłoszone przez ${e.sources.length} ${e.sources.length === 1 ? "kanał" : e.sources.length < 5 ? "kanały" : "kanałów"}: ${e.sources.map((s) => s[0]).join(", ")}.`;
});

// oznacz kontynuacje wobec poprzedniego wydania
try {
  const dane = fs.readFileSync(path.join(KATALOG, "..", "dobowy-brief-data.js"), "utf8").trim().replace("window.BRIEF_EDITIONS = ", "").replace(/;$/, "");
  const poprzednie = JSON.parse(dane).filter((w) => w.date !== DATA_WYD)[0];
  if (poprzednie) for (const e of events) {
    const r = rdzenie(e.title);
    if (poprzednie.events.some((p) => jaccard(rdzenie(p.title), r) >= 0.4)) e.follow = true;
  }
} catch { /* pierwsze wydanie */ }

const licznik = {};
for (const e of events) licznik[e.dim] = (licznik[e.dim] || 0) + 1;
const NAZWY = { P: "polityka", M: "wojsko i bezpieczeństwo", E: "gospodarka", S: "społeczeństwo", I: "informacja i cyber", X: "infrastruktura" };
const rozklad = Object.entries(licznik).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${NAZWY[k]}: ${n}`).join(", ");

const wydanie = {
  date: DATA_WYD,
  win: `${krotka(OD)} ${zegar(OD)} – ${krotka(TERAZ)} ${zegar(TERAZ)} ${strefa(TERAZ)}`,
  stop: `${slownie(TERAZ)}, ${zegar(TERAZ)} ${strefa(TERAZ)}`,
  kind: "auto",
  note: "Wydanie automatyczne: zgrupowane nagłówki z kanałów RSS, bez analizy i bez redakcji człowieka.",
  obraz: [
    `To wydanie powstało automatycznie. Skrypt odpytał ${konfig.kanaly.length} kanałów RSS, odpowiedziało ${dzialajace.length}, i zebrał ${pozycje.length} pozycji opublikowanych w ciągu ostatnich ${GODZINY} godzin. Powtarzające się tematy zostały połączone w ${grupy.length} wątków, z których w wydaniu znalazło się ${events.length} najszerzej relacjonowanych.`,
    `Rozkład wątków po przypisaniu słowami kluczowymi: ${rozklad}. Przypisanie wymiaru PMESII i regionu jest mechaniczne i bywa błędne, a kolejność wątków odzwierciedla tylko liczbę kanałów, które podały temat, a nie jego wagę.`,
    `Czego tu nie ma: zbiorczej oceny sytuacji, weryfikacji informacji, wskazania rozbieżności między źródłami ani wniosków analitycznych. Każdy wpis to zestaw nagłówków z linkami, które trzeba otworzyć i ocenić samodzielnie.${niedzialajace.length ? ` W tym przebiegu nie odpowiedziało ${niedzialajace.length} kanałów: ${niedzialajace.map((w) => w.k.nazwa).join(", ")}.` : ""}`,
  ],
  events,
};

fs.writeFileSync(OUT, JSON.stringify(wydanie, null, 1));
console.log(`\nZapisano ${OUT}: ${events.length} wątków, ${new Set(events.flatMap((e) => e.sources.map((s) => s[1]))).size} linków.`);
