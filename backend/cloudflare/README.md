# Backend magazynu i zamówień

Ten wariant jest pod `Cloudflare Worker + D1`.

## Co daje

- zamówienia `pending`
- ręczne `confirmOrder`
- stan schodzi dopiero po potwierdzeniu
- licznik `confirmedSold` i `currentStock`

## Szybki setup

1. Załóż bazę `D1`.
2. Wgraj `schema.sql`.
3. Ustaw w Workerze:
   - `DB` jako binding D1
   - `ADMIN_PASSWORD` jako sekret
4. Opublikuj Workera.
5. W `shop-config.js` wpisz adres Workera w `orderApiUrl`.

## Frontend

- sklep publiczny wysyła `createOrder`
- panel admina używa:
  - `syncCatalog`
  - `getAdminData`
  - `confirmOrder`
  - `cancelOrder`

Hasło admina wpisujesz w panelu admina. Nie jest trzymane na stałe w kodzie.
