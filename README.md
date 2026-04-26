# Katalog produktów

Prosta darmowa aplikacja PWA na Androida i iPhone'a. Wersja publiczna pokazuje jeden wspólny katalog dla wszystkich użytkowników.

## Jak edytować produkty

Wejdź w `admin.html`, dodaj lub edytuj produkty, ustaw kolejność przyciskami góra/dół, a potem kliknij `Pobierz products.json`.
Pobrany plik podmień w folderze aplikacji i opublikuj zmiany.

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

Po zmianie `products.json` albo zdjęć opublikuj folder aplikacji. Wszyscy znajomi zobaczą ten sam katalog pod tym samym linkiem.

## Uruchomienie lokalnie

```powershell
python -m http.server 8080
```

Adres lokalny:

```text
http://localhost:8080
```
