# piwojold.github.io

Witryna **Biały Wywiad // Akademia OSINT**. Cała witryna jest zaszyfrowana jednym hasłem:
każda strona `.html` w repozytorium to bramka z zaszyfrowaną treścią (AES-256-GCM, klucz
z hasła przez PBKDF2-SHA256, 600 000 iteracji). Hasło wpisane raz odblokowuje wszystkie
strony w danej przeglądarce. Część materiałów ma dodatkowo własne, osobne hasła.

**Niezaszyfrowana treść nigdy nie trafia do repozytorium.**

## Edycja stron

```bash
export BW_HASLO="hasło witryny"          # albo BW_KLUCZ="klucz base64"
node tools/strona.mjs odszyfruj          # repo → zrodla/ (katalog w .gitignore)
# … edytujesz pliki w zrodla/ …
node tools/strona.mjs zaszyfruj          # zrodla/ → repo (tylko zmienione pliki)
node tools/strona.mjs sprawdz            # kontrola przed commitem
```

Nowa strona: dodaj plik `.html` w `zrodla/`, wpis w `zrodla/materialy.js`, potem `zaszyfruj`.

## Automaty (GitHub Actions)

Workflowy potrzebują sekretu repozytorium **`BW_KLUCZ`** (Settings → Secrets and variables
→ Actions). Wartość: `node tools/strona.mjs klucz` przy ustawionym `BW_HASLO`.

- `brief.yml` – codzienny brief: odszyfrowuje dane, dodaje wydanie, szyfruje i publikuje.
- `ocoka-quality.yml` – testy OCOKA Planer na opublikowanej, zaszyfrowanej stronie.
- `kontrola-szyfrowania.yml` – przy każdym pushu sprawdza, czy nic nie trafiło do repo jawnie.

Brief redagowany ręcznie: `tools/BRIEF-INSTRUKCJA.md`.
