# Katalog produktow

Prosta darmowa aplikacja PWA na Androida i iPhone'a. Wersja publiczna pokazuje jeden wspolny katalog dla wszystkich uzytkownikow.

## Jak edytowac produkty

Wejdz w `admin.html`, dodaj lub edytuj produkty, ustaw kolejnosc przyciskami gora/dol, a potem kliknij `Pobierz products.json`.
Pobrany plik podmien w folderze aplikacji i wrzuc folder ponownie na Netlify.

Produkty sa w pliku `products.json`. Mozesz dodac maksymalnie 30 pozycji.

Przyklad:

```json
{
  "id": "kawa-ziarnista",
  "name": "Kawa ziarnista",
  "price": "39,99",
  "description": "Aromatyczna kawa 1 kg do ekspresu.",
  "image": "images/kawa.jpg"
}
```

Zdjecia wrzucaj do folderu `images` i wpisuj ich sciezke w polu `image`, np. `images/kawa.jpg`.

Po zmianie `products.json` albo zdjec wrzuc ponownie folder aplikacji na Netlify. Wszyscy znajomi zobacza ten sam katalog pod tym samym linkiem.

## Uruchomienie lokalnie

```powershell
python -m http.server 8080
```

Adres lokalny:

```text
http://localhost:8080
```
