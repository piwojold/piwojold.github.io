# Dobowy brief OSINT Polska: instrukcja przygotowania wydania

Strona `dobowy-brief.html` czyta wydania z pliku `dobowy-brief-data.js`. Nowe wydanie to jeden obiekt JSON dodany narzędziem `tools/brief.mjs`. Samej strony HTML nie trzeba zmieniać.

## Kroki

1. Ustal datę wydania (dzisiejsza, strefa Europe/Warsaw) i stop informacyjny (bieżąca godzina).
2. Okno: od stopu poprzedniego wydania do teraz. Jeśli poprzedni stop jest starszy niż 36 godzin, okno to ostatnie 24 godziny.
3. Przeczytaj dwa najnowsze wydania w `dobowy-brief-data.js`, żeby znać trwające wątki i ich `id`.
4. Zbierz materiał wyszukiwarką (lista tematów niżej). Sprawdzaj datę publikacji w treści artykułu.
5. Zapisz wydanie do pliku poza repozytorium, np. `/tmp/wydanie.json`.
6. `node tools/brief.mjs add /tmp/wydanie.json`. Popraw wszystkie zgłoszone błędy i powtórz.
7. `git add dobowy-brief-data.js`, commit „Brief dobowy RRRR-MM-DD”, `git push origin main`.

Jeśli nie udaje się zebrać co najmniej 8 wątków z wiarygodnymi źródłami albo walidacja nie przechodzi, nie publikuj niczego.

## Co przeszukać (zawsze pod kątem Polski, ostatnia doba)

- Polityka: prezydent, premier, rząd, Sejm i Senat, MSZ, relacje z UE, NATO, USA, Ukrainą, Niemcami, Litwą, Białorusią.
- Wojsko i bezpieczeństwo: Dowództwo Operacyjne (przestrzeń powietrzna, drony), MON, Agencja Uzbrojenia, ABW, SKW, Straż Graniczna (granica z Białorusią, obwód królewiecki), policja, prokuratura (szpiegostwo, dywersja, terroryzm).
- Gospodarka: NBP, GUS, Ministerstwo Finansów, energia i paliwa, Orlen, PSE, duże zwolnienia i inwestycje, złoty, wyroki TSUE dotyczące Polski.
- Społeczeństwo: protesty, zgromadzenia, poważne przestępstwa o znaczeniu publicznym, napięcia społeczne, zdrowie publiczne.
- Informacja i cyber: CERT Polska, NASK, Ministerstwo Cyfryzacji, CBZC, incydenty w systemach państwowych, dezinformacja.
- Infrastruktura: kolej (PKP PLK, PKBWK), drogi, porty, lotniska, sieci energetyczne i gazowe, IMGW i RCB.
- Regiony: przeglądy prasy regionalnej, tak aby wydanie nie było wyłącznie warszawskie.

Pierwszeństwo mają źródła krajowe: komunikaty urzędów i służb, PAP, serwisy ogólnopolskie, branżowe i regionalne. Źródła zagraniczne tylko dla wydarzeń poza Polską.

## Zasady redakcyjne

- Streszczenia własnymi słowami, 2–4 zdania. Bez cytatów dłuższych niż kilka słów.
- Każda liczba i każde twierdzenie muszą wynikać z podlinkowanego źródła. Nie dopowiadaj szczegółów.
- Nie przypisuj zdarzeń państwu ani grupie bez podstawy w źródle. Stanowisko prokuratury lub służb opisuj jako ich stanowisko. Zarzuty nie oznaczają winy.
- Nie podawaj nazwisk osób prywatnych, w tym ofiar i podejrzanych. Osoby publiczne opisuj funkcją.
- Rozbieżności między źródłami zaznacz w polu `why`.
- `rel` to znaczenie dla obrazu doby, a nie poziom zagrożenia.
- Wątek bez nowej informacji w oknie pomiń, chyba że jest kluczowy dla obrazu doby. Wtedy `follow: true` i jasna informacja w `why`, że nowych komunikatów nie znaleziono.
- Cel: 15–25 wątków, każdy wymiar PMESII reprezentowany, jeśli materiał na to pozwala.

## Schemat wydania

```json
{
  "date": "2026-11-13",
  "win": "12.11.2026 09:30 – 13.11.2026 06:45 CET",
  "stop": "13 listopada 2026, 06:45 CET",
  "obraz": ["akapit 1", "akapit 2", "akapit 3"],
  "events": [ ... ]
}
```

Opcjonalne pole `note` (krótka adnotacja pod tytułem, np. o niepełnym wydaniu). Zimą strefa to CET, latem CEST.

`obraz`: 3–4 akapity zbiorczego obrazu sytuacji, każdy 2–3 zdania.

## Schemat wątku

```json
{
  "id": "epuap",
  "dim": "I",
  "sec": ["X"],
  "title": "Krótki tytuł z faktem",
  "summary": "Co się stało, 2–4 zdania.",
  "why": "Znaczenie analityczne, niepewności, co obserwować.",
  "sources": [["Nazwa serwisu", "https://…", "PL"]],
  "date": "12–13.11",
  "region": "Opis miejsca czytelny dla człowieka",
  "label": "Informacja urzędowa",
  "rel": "Wysoka",
  "follow": false,
  "woj": ["mazowieckie"],
  "pts": [[52.23, 21.01, "Warszawa"]],
  "top": 1,
  "lead": "Jedno lub dwa zdania do sekcji pięciu raportów."
}
```

- `id`: małe litery, cyfry, myślniki. Dla trwającego wątku użyj tego samego `id` co w poprzednich wydaniach. Strona łączy po nim wydania w historii.
- `dim` i `sec`: P polityka, M wojsko i bezpieczeństwo, E gospodarka, S społeczeństwo, I informacja i cyber, X infrastruktura. `sec` może być pustą tablicą.
- `label`: dokładnie jedna z: Potwierdzona decyzja, Informacja urzędowa, Twierdzenie strony, Doniesienie medialne, Projekt, Zapowiedź.
- `rel`: Wysoka albo Średnia.
- `follow`: `true`, gdy zdarzenie źródłowe jest starsze niż okno.
- `woj`: nazwy województw małymi literami (np. `śląskie`, `warmińsko-mazurskie`). Dla wątków bez regionu pusta tablica i `scope`: `kraj` (ogólnokrajowe, sieciowe) albo `zagr` (poza Polską).
- `pts`: punkty na mapie `[szerokość, długość, "podpis"]`, tylko w granicach Polski, dokładność do miejscowości. Czwarty element `"l"` ustawia podpis po lewej stronie znacznika. Dla Warszawy zawsze `[52.23, 21.01, "Warszawa", "l"]`, żeby znaczniki z jednego miasta się grupowały. Pomiń `pts` dla wątków z `scope`.
- `sources`: 1–4 pozycji `[nazwa, url, kod kraju]`. Tylko adresy faktycznie otwarte lub zwrócone przez wyszukiwarkę.
- `top` i `lead`: dokładnie pięć wątków ma `top` od 1 do 5 oraz `lead`.
