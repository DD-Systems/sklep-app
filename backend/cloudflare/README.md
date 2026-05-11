# Backend magazynu

Ten wariant jest pod `Cloudflare Worker + D1`.

## Co daje

- licznik `confirmedSold` i `currentStock`

## Szybki setup

1. Załóż bazę `D1`.
2. Wgraj `schema.sql`.
3. Ustaw w Workerze:
   - `DB` jako binding D1
   - `ADMIN_PASSWORD` jako sekret
   - opcjonalnie `ORDER_NOTIFY_WEBHOOK_URL`, jeśli chcesz powiadomienie admina o nowym zamówieniu
   - opcjonalnie `ORDER_NOTIFY_TOKEN`, jeśli webhook wymaga Bearer token
4. Opublikuj Workera.
5. W `shop-config.js` wpisz adres Workera w `orderApiUrl`.

## Frontend

- panel admina używa:
  - `syncCatalog`
  - `getAdminData`

Hasło admina wpisujesz w panelu admina. Nie jest trzymane na stałe w kodzie.
