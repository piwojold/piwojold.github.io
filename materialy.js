/* ============================================================
   LISTA MATERIAŁÓW — wspólna dla strony powitalnej (index.html)
   i katalogu (katalog.html).
   Żeby dodać nową pozycję: wgraj plik .html do repozytorium
   i dopisz tutaj jeden blok { ... }.
   rodzaj: "Narzędzie", "Kurs" albo "Trening".
   skrot: krótki opis do kafelka „Najczęściej otwierane” (opcjonalnie).
   krotko: krótsza nazwa na kafelek skrótu (opcjonalnie).
   polecany: true — pokaż w „Najczęściej otwierane” na stronie powitalnej.
   ============================================================ */
const MATERIALY = [
  {
    tytul: "OCOKA Planer",
    rodzaj: "Narzędzie",
    plik: "ocoka.html",
    krotko: "OCOKA Planer",
    skrot: "Teren, MGRS, raport DOCX/PDF",
    polecany: true,
    opis: "Analiza terenu metodą OCOKA na otwartych podkładach mapowych: siatka MGRS, automatyczna ocena, pogoda oraz raport do DOCX i PDF.",
    tagi: ["GEOINT", "MGRS", "teren", "raport"]
  },
  {
    tytul: "Obsidian dla OSINT — Kompletny Kurs",
    rodzaj: "Kurs",
    plik: "obsidian-kurs.html",
    krotko: "Obsidian dla OSINT",
    skrot: "Vault analityka od zera",
    polecany: true,
    opis: "Kurs krok po kroku od zera: vault analityka, graf relacji, Dataview, web clipping, automatyzacja i raportowanie.",
    tagi: ["Obsidian", "od podstaw", "Dataview"]
  },
  {
    tytul: "Obsidian OSINT Field Manual",
    rodzaj: "Kurs",
    plik: "obsidian-osint-field-manual.html",
    opis: "Podręcznik polowy w trzech poziomach: podstawy, średniozaawansowane i zaawansowane techniki pracy w Obsidianie.",
    tagi: ["Obsidian", "podręcznik", "3 poziomy"]
  },
  {
    tytul: "Dobowy brief OSINT Polska",
    rodzaj: "Narzędzie",
    plik: "dobowy-brief.html",
    krotko: "Dobowy brief",
    skrot: "PMESII, mapa, archiwum wydań",
    polecany: true,
    opis: "Dobowy przegląd otwartych źródeł dla Polski w układzie PMESII: mapa zdarzeń, filtr województw, etykiety epistemiczne i archiwum wydań.",
    tagi: ["PMESII", "monitoring", "mapa", "archiwum"]
  },
  {
    tytul: "Biały Wywiad — Platforma OSINT",
    rodzaj: "Narzędzie",
    plik: "platforma-osint.html",
    krotko: "Platforma OSINT",
    skrot: "SOCMINT Workbench + Akademia",
    polecany: true,
    haslo: true,
    opis: "SOCMINT Workbench + Akademia: wyszukiwanie w FB, X, Instagramie, VK, OK i Telegramie, mapa taktyczna z MGRS/OCOKA, pivoty po infrastrukturze oraz interaktywne lekcje.",
    tagi: ["SOCMINT", "Warsztat", "Akademia"]
  },
  {
    tytul: "TGMON — monitoring Telegrama",
    rodzaj: "Narzędzie",
    plik: "tgmon.html",
    krotko: "TGMON",
    skrot: "Telegram RU/BY, tłumaczenie, 5W",
    haslo: true,
    opis: "Program na Windows do monitorowania publicznych kanałów Telegram (RU/BY): tłumaczenie na polski obok oryginału, własne zapytania, karta 5W w układzie INTREP, raporty PDF/Word i tryb OPSEC. Paczka z instalatorem i instrukcją od zera.",
    tagi: ["Telegram", "Windows", "5W / INTREP", "OPSEC"]
  },
  {
    tytul: "Trening OSINT",
    rodzaj: "Kurs",
    plik: "trening-osint.html",
    haslo: true,
    opis: "Materiał do samodzielnej nauki do szkolenia Narzędziownik OSINT: 6 modułów z lekcjami, quizami i fiszkami, sprawa szkoleniowa, plan 14 dni, warsztat analityka i egzamin.",
    tagi: ["6 modułów", "quizy", "egzamin"]
  },
  {
    tytul: "Trening SLP 2222",
    rodzaj: "Trening",
    plik: "trening-slp-2222.html",
    haslo: true,
    opis: "Trenażer STANAG 6001: rosyjski z poziomu 1 na 2. Czytanie, słuchanie, słownictwo, gramatyka, odmiana, pisanie i mówienie oraz symulacje egzaminu.",
    tagi: ["STANAG 6001", "rosyjski", "1 → 2"]
  },
  {
    tytul: "Trening SLP 3333",
    rodzaj: "Trening",
    plik: "trening-slp-3333.html",
    haslo: true,
    opis: "Trenażer STANAG 6001: angielski na poziom 3. Teksty i nagrania egzaminacyjne, Use of English, pisanie pod czas, strategie i szybkie testy.",
    tagi: ["STANAG 6001", "angielski", "→ 3"]
  },
  {
    tytul: "Repetytorium Ósmoklasisty — angielski",
    rodzaj: "Kurs",
    plik: "repetytorium-osmoklasisty.html",
    opis: "Program nauki do egzaminu ósmoklasisty ułożony według podręcznika Repetytorium Ósmoklasisty (Macmillan): 14 unitów i powtórki ze stronami z książki, słowniczek, fiszki, quizy, gramatyka, zadania pisemne i harmonogram do maja 2027.",
    tagi: ["egzamin ósmoklasisty", "angielski", "14 unitów"]
  }
];

const RODZAJE = {
  "Narzędzie": { mnoga: "Narzędzia", slug: "narzedzia", kolor: "var(--tool)",
    opis: "Aplikacje do codziennej pracy analityka: analiza terenu, monitoring źródeł, SOCMINT." },
  "Kurs":      { mnoga: "Kursy", slug: "kursy", kolor: "var(--course)",
    opis: "Uporządkowana nauka od podstaw: lekcje, quizy, fiszki, sprawy szkoleniowe i egzaminy." },
  "Trening":   { mnoga: "Treningi", slug: "treningi", kolor: "var(--training)",
    opis: "Trenażery językowe STANAG 6001 z symulacjami egzaminu, pisaniem i mówieniem." }
};
