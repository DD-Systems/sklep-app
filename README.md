# Katalog produktów

Prosta aplikacja PWA na Androida i iPhone'a. Wersja publiczna pokazuje jeden wspólny katalog dla wszystkich użytkowników.

## Magazyn i potwierdzanie zamówień

Sam `GitHub Pages` nie zapisuje zamówień. Dlatego magazyn działa poprawnie dopiero po podpięciu API.

Nowy model:

- klient składa zamówienie jako `oczekujące`
- w panelu admina widzisz listę zamówień
- stan magazynowy schodzi dopiero po kliknięciu `Potwierdź`
- panel pokazuje `sprzedano` i `zostało`

Gotowy wariant backendu jest w:

`backend/cloudflare/`

Po wdrożeniu backendu wpisz adres API w:

`shop-config.js`

## Jak edytować produkty

Wejdź w https://dd-systems.github.io/sklep-app/mat2rix3/.

1. Rozwiń `Połącz GitHub` i kliknij `Utwórz klucz na GitHubie`.
2. Wybierz właściciela `DD-Systems`, `Only select repositories` i wyłącznie `sklep-app`.
3. Klucz potrzebuje tylko `Contents: Read and write`. Wygeneruj go i wpisz w panelu, następnie kliknij `Połącz`.
4. Dodaj lub edytuj produkty, ustaw kolejność i kliknij `Opublikuj zmiany`.

Panel zapisuje katalog wraz ze zdjęciami bezpośrednio w GitHubie. Nie trzeba pobierać JSON-a ani uruchamiać `publikuj.cmd`.
GitHub Pages aktualizuje sklep po zakończeniu publikacji. Komunikat potwierdza zapis do repozytorium, nie zakończenie budowania strony.

Klucz jest przechowywany tylko w sesji tej karty i usuwany po kliknięciu `Odłącz GitHub`. Po jej zamknięciu należy połączyć konto ponownie.
Nie umieszczaj klucza w plikach aplikacji ani nie wysyłaj go w wiadomościach.

Nieopublikowane zmiany zapisują się automatycznie w przeglądarce jako wersja robocza.
Przed nadpisaniem nowszego katalogu z innego urządzenia panel zatrzymuje publikację.
Przycisk `Pobierz kopię JSON` pozostaje dostępną kopią zapasową.
Lokalną kopię opublikowanych produktów można zaktualizować poleceniem `git pull --ff-only` w folderze sklepu.

Produkty są w pliku `products.json`. Możesz dodać maksymalnie 30 pozycji.

Przykład:

```json
{
  "id": "kawa-ziarnista",
  "name": "Kawa ziarnista",
  "price": "39,99",
  "description": "Aromatyczna kawa 1 kg do ekspresu.",
  "image": "images/kawa.jpg"
}
```

Zdjęcia możesz dodać w panelu admina albo trzymać w folderze `images` i wpisać ich ścieżkę w polu `image`, np. `images/kawa.jpg`.

Po kliknięciu `Opublikuj zmiany` wszyscy znajomi zobaczą ten sam katalog pod tym samym linkiem, gdy GitHub Pages zakończy aktualizację.

## Uruchomienie lokalnie

```powershell
python -m http.server 8080
```

Adres lokalny:

```text
http://localhost:8080
```
