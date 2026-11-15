# OCOKA Planer – testy jakościowe

Testy smoke/regresji Playwright. Wymagają Node.js 20+ oraz przeglądarki Chromium.

## Uruchomienie

```bash
npm install
npx playwright install chromium
npm test
```

Testy domyślnie sprawdzają wersję opublikowaną na GitHub Pages.
Dla lokalnego serwera ustaw adres:

```bash
OCOKA_URL=http://127.0.0.1:8000/ocoka.html npm test
```

Windows PowerShell:

```powershell
$env:OCOKA_URL="http://127.0.0.1:8000/ocoka.html"
npm test
```

## Zakres

- uruchomienie mapy i podstawowych elementów interfejsu;
- wybór podkładu;
- eksport (jeśli przycisk jest dostępny pod oczekiwaną nazwą);
- brak nieobsłużonych wyjątków JS podczas startu.

To testy smoke, nie walidacja wojskowych/terenowych obliczeń ani dokładności DEM.
Testy wymagają dostępu do usług mapowych i sieci; wyniki mogą zależeć od zewnętrznych dostawców.
