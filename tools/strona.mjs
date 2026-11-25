#!/usr/bin/env node
// =====================================================================
//  Szyfrowanie witryny piwojold.github.io jednym hasłem
// ---------------------------------------------------------------------
//  Każda strona .html w repozytorium jest zaszyfrowana (AES-256-GCM,
//  klucz z hasła przez PBKDF2-SHA256, 600 000 iteracji, wspólna sól).
//  Hasło wpisane raz odblokowuje całą witrynę w tej przeglądarce.
//
//  Niezaszyfrowane źródła trzymasz lokalnie w katalogu zrodla/
//  (jest w .gitignore i NIGDY nie trafia do repozytorium).
//
//  Klucz podajesz przez zmienną środowiskową:
//    BW_HASLO="..."  – hasło witryny, albo
//    BW_KLUCZ="..."  – klucz w base64 (to samo, co sekret BW_KLUCZ w GitHub Actions)
//
//  Polecenia:
//    node tools/strona.mjs odszyfruj        – repo → zrodla/ (do edycji)
//    node tools/strona.mjs zaszyfruj        – zrodla/ → repo (tylko zmienione pliki)
//    node tools/strona.mjs klucz            – wypisuje klucz base64 (do sekretu BW_KLUCZ)
//    node tools/strona.mjs dane-odszyfruj   – *.enc z danymi → plik .js obok (dla automatów)
//    node tools/strona.mjs dane-zaszyfruj   – plik .js z danymi → *.enc, plik .js usuwany
//    node tools/strona.mjs sprawdz          – kontrola: czy w repo nie ma niezaszyfrowanej strony
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "zrodla");
const SOL = "AegZ/f3XZ9ioaEkkfG0mwQ=="; // sól witryny (jawna, wspólna dla wszystkich stron)
const ITER = 600000;
const ZNACZNIK = "bw-brama-witryny";
// Pliki z danymi ładowane przez <script src>: w repo leżą jako .enc,
// a bramka wstawia je do strony po odszyfrowaniu.
const DANE = ["dobowy-brief-data.js", "materialy.js"];
const POMIN_KATALOGI = new Set([".git", "node_modules", "zrodla", "tests", "tools", ".github", "test-results", "playwright-report"]);

function klucz() {
  if (process.env.BW_KLUCZ) {
    const k = Buffer.from(process.env.BW_KLUCZ.trim(), "base64");
    if (k.length !== 32) throw new Error("BW_KLUCZ: zły klucz (oczekiwane 32 bajty w base64).");
    return k;
  }
  if (process.env.BW_HASLO) return crypto.pbkdf2Sync(process.env.BW_HASLO, Buffer.from(SOL, "base64"), ITER, 32, "sha256");
  throw new Error("Podaj hasło (BW_HASLO) albo klucz (BW_KLUCZ) w zmiennej środowiskowej.");
}
function szyfruj(k, dane) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", k, iv);
  return Buffer.concat([iv, c.update(dane), c.final(), c.getAuthTag()]);
}
function odszyfruj(k, blob) {
  const iv = blob.subarray(0, 12), tag = blob.subarray(blob.length - 16), ct = blob.subarray(12, blob.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", k, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}
function strony(dir = ROOT, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!POMIN_KATALOGI.has(e.name) && !rel.includes("/")) out.push(...strony(path.join(dir, e.name), path.join(rel, e.name))); }
    else if (e.name.endsWith(".html")) out.push(path.join(rel, e.name));
  }
  return out;
}
const encDla = js => js.replace(/\.js$/, ".enc");
const ladunek = html => (html.match(/,PAYLOAD="([^"]+)"/) || [])[1];

function bramka(payloadB64, dane) {
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Biały Wywiad // Akademia OSINT — dostęp chroniony</title>
<style>
:root{--bg:#0f1210;--panel:#171b18;--ink:#e3e8e0;--muted:#8d978b;--line:#2a312b;--accent:#8fb573;--err:#e07a6a}
@media (prefers-color-scheme: light){:root{--bg:#eef0ec;--panel:#f8f9f6;--ink:#1d221d;--muted:#5d665c;--line:#cfd5cb;--accent:#3d5a3a;--err:#a33b2b}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px}
form{width:100%;max-width:380px;background:var(--panel);border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:4px;padding:28px}
.brand{font:500 12px/1 ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
h1{font-size:24px;line-height:1.2;margin:14px 0 6px}
p{margin:0 0 18px;color:var(--muted);font-size:14px}
label{display:block;font-size:13px;margin-bottom:6px}
input[type=password]{width:100%;font:inherit;padding:10px 12px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:3px}
.rem{display:flex;gap:8px;align-items:center;margin:14px 0 18px;font-size:14px;color:var(--muted)}
button{width:100%;font:600 15px/1 inherit;padding:12px;border:0;border-radius:3px;background:var(--accent);color:var(--bg);cursor:pointer}
button:disabled{opacity:.6;cursor:wait}
#err{display:none;color:var(--err);font-size:14px;margin:12px 0 0}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
</head>
<body class="${ZNACZNIK}">
<form id="f" autocomplete="on">
  <div class="brand">Biały Wywiad // Akademia OSINT</div>
  <h1>Dostęp chroniony</h1>
  <p>Wpisz hasło, aby otworzyć witrynę. Hasło wystarczy wpisać raz – odblokowuje wszystkie strony.</p>
  <label for="pw">Hasło</label>
  <input id="pw" type="password" autocomplete="current-password" required autofocus>
  <label class="rem"><input id="rem" type="checkbox"> Zapamiętaj na tym urządzeniu</label>
  <button id="go" type="submit">Odblokuj</button>
  <p id="err" role="alert">Nieprawidłowe hasło.</p>
</form>
<script>
(()=>{
const SOL="${SOL}",ITER=${ITER},KS="bw_klucz_witryny",PAYLOAD="${payloadB64}",DANE=${JSON.stringify(dane)};
const b2a=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0)),a2b=a=>{let s="";for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};
async function kluczZHasla(pw){const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveBits"]);return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:b2a(SOL),iterations:ITER,hash:"SHA-256"},base,256));}
async function deszyfr(raw,blob){const k=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]);return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:blob.slice(0,12)},k,blob.slice(12)));}
async function otworz(raw){
  let html=await deszyfr(raw,b2a(PAYLOAD));
  for(const plik of DANE){
    const r=await fetch(plik.replace(/\\.js$/,".enc"),{cache:"no-cache"});if(!r.ok)throw new Error("Brak pliku "+plik);
    const js=(await deszyfr(raw,new Uint8Array(await r.arrayBuffer()))).replace(/<\\/script/gi,"<\\\\/script");
    html=html.split('<script src="'+plik+'"><\\/script>').join("<script>"+js+"<\\/script>");
  }
  if(document.readyState==="loading")await new Promise(r=>document.addEventListener("DOMContentLoaded",r,{once:true}));
  if(/<script[^>]+src=["']?https?:/i.test(html))return wstaw(html); // zewnętrzne skrypty: wstawianie przez DOM
  document.open();document.write(html);document.close();
}
async function wstaw(html){ // podmiana dokumentu z kolejnym uruchamianiem skryptów (działa z bibliotekami z CDN)
  const d=new DOMParser().parseFromString(html,"text/html");
  for(const a of [...document.documentElement.attributes])document.documentElement.removeAttribute(a.name);
  for(const a of d.documentElement.attributes)document.documentElement.setAttribute(a.name,a.value);
  document.head.replaceWith(document.importNode(d.head,true));document.body.replaceWith(document.importNode(d.body,true));
  for(const st of [...document.querySelectorAll("script")]){
    const n=document.createElement("script");for(const a of st.attributes)n.setAttribute(a.name,a.value);
    if(st.src){await new Promise(r=>{n.onload=n.onerror=r;st.replaceWith(n);});}else{n.textContent=st.textContent;st.replaceWith(n);}
  }
  document.dispatchEvent(new Event("DOMContentLoaded",{bubbles:true}));window.dispatchEvent(new Event("load"));
}
function zapisany(){try{return localStorage.getItem(KS)||sessionStorage.getItem(KS);}catch(e){return null;}}
function zapomnij(){try{localStorage.removeItem(KS);sessionStorage.removeItem(KS);}catch(e){}}
(async()=>{const s=zapisany();if(s){try{await otworz(b2a(s));}catch(e){zapomnij();}}})();
document.getElementById("f").addEventListener("submit",async ev=>{
  ev.preventDefault();const btn=document.getElementById("go"),err=document.getElementById("err");
  btn.disabled=true;btn.textContent="Odszyfrowywanie…";err.style.display="none";
  try{
    const raw=await kluczZHasla(document.getElementById("pw").value);
    await deszyfr(raw,b2a(PAYLOAD));
    const k=a2b(raw);try{(document.getElementById("rem").checked?localStorage:sessionStorage).setItem(KS,k);}catch(e){}
    await otworz(raw);
  }catch(e){err.style.display="block";btn.disabled=false;btn.textContent="Odblokuj";const pw=document.getElementById("pw");pw.select();pw.focus();}
});
})();
</script>
</body>
</html>
`;
}

const cmd = process.argv[2];
if (cmd === "klucz") { console.log(klucz().toString("base64")); }
else if (cmd === "zaszyfruj") {
  const k = klucz(); let zmienione = 0, bez = 0;
  if (!fs.existsSync(SRC)) throw new Error("Brak katalogu zrodla/. Najpierw: node tools/strona.mjs odszyfruj");
  for (const rel of strony(SRC)) {
    const plain = fs.readFileSync(path.join(SRC, rel));
    const cel = path.join(ROOT, rel);
    if (fs.existsSync(cel)) {
      const stary = ladunek(fs.readFileSync(cel, "utf8"));
      let same = false; try { same = !!stary && odszyfruj(k, Buffer.from(stary, "base64")).equals(plain); } catch {}
      if (same) { // treść bez zmian: zachowaj szyfrogram, odśwież tylko bramkę, jeśli zmienił się jej szablon
        const h = plain.toString("utf8"), nowa = bramka(stary, DANE.filter(d => h.includes(`<script src="${d}"></script>`)));
        if (nowa !== fs.readFileSync(cel, "utf8")) { fs.writeFileSync(cel, nowa); console.log("odświeżono bramkę:", rel); zmienione++; } else bez++;
        continue;
      }
    }
    const html = plain.toString("utf8");
    const dane = DANE.filter(d => html.includes(`<script src="${d}"></script>`));
    fs.mkdirSync(path.dirname(cel), { recursive: true });
    fs.writeFileSync(cel, bramka(szyfruj(k, plain).toString("base64"), dane));
    console.log("zaszyfrowano:", rel); zmienione++;
  }
  for (const d of DANE) {
    const src = path.join(SRC, d), enc = path.join(ROOT, encDla(d));
    if (!fs.existsSync(src)) continue;
    const plain = fs.readFileSync(src);
    try { if (fs.existsSync(enc) && odszyfruj(k, fs.readFileSync(enc)).equals(plain)) { bez++; continue; } } catch {}
    fs.writeFileSync(enc, szyfruj(k, plain)); console.log("zaszyfrowano:", encDla(d)); zmienione++;
  }
  console.log(`Gotowe: ${zmienione} zmienionych, ${bez} bez zmian.`);
}
else if (cmd === "odszyfruj") {
  const k = klucz(); fs.mkdirSync(SRC, { recursive: true });
  for (const rel of strony()) {
    const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (!html.includes(ZNACZNIK)) { console.log("POMINIĘTO (niezaszyfrowana):", rel); continue; }
    const out = path.join(SRC, rel); fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, odszyfruj(k, Buffer.from(ladunek(html), "base64")));
  }
  for (const d of DANE) { const enc = path.join(ROOT, encDla(d)); if (fs.existsSync(enc)) fs.writeFileSync(path.join(SRC, d), odszyfruj(k, fs.readFileSync(enc))); }
  console.log("Źródła w katalogu zrodla/ (nie trafia do repozytorium).");
}
else if (cmd === "dane-odszyfruj") {
  const k = klucz();
  for (const d of DANE) { const enc = path.join(ROOT, encDla(d)); if (fs.existsSync(enc)) { fs.writeFileSync(path.join(ROOT, d), odszyfruj(k, fs.readFileSync(enc))); console.log("odszyfrowano:", d); } }
}
else if (cmd === "dane-zaszyfruj") {
  const k = klucz();
  for (const d of DANE) {
    const js = path.join(ROOT, d), enc = path.join(ROOT, encDla(d));
    if (!fs.existsSync(js)) continue;
    const plain = fs.readFileSync(js);
    let same = false; try { same = fs.existsSync(enc) && odszyfruj(k, fs.readFileSync(enc)).equals(plain); } catch {}
    if (!same) { fs.writeFileSync(enc, szyfruj(k, plain)); console.log("zaszyfrowano:", encDla(d)); }
    fs.unlinkSync(js);
  }
}
else if (cmd === "sprawdz") {
  const zle = strony().filter(rel => !fs.readFileSync(path.join(ROOT, rel), "utf8").includes(ZNACZNIK));
  const jawne = DANE.filter(d => fs.existsSync(path.join(ROOT, d)));
  if (zle.length || jawne.length) { console.error("NIEZASZYFROWANE:", [...zle, ...jawne].join(", ")); process.exit(1); }
  console.log("OK: wszystkie strony i dane są zaszyfrowane.");
}
else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 23).map(l => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(cmd ? 1 : 0); }
