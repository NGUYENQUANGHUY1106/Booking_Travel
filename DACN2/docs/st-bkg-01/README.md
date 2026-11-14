# ST-BKG-01 — Booking quote

## Contract

`POST /api/bookings/quote` requires a logged-in User or Hotel Owner session. Request:

```json
{
  "roomId": "seed-room-deluxe-sea-view",
  "checkIn": "2026-12-13",
  "checkOut": "2026-12-15",
  "roomCount": 1,
  "adults": 2,
  "children": 0
}
```

The response uses effective nightly rates from OWN-09 and inventory from HTL-09 for the entire `[checkIn, checkOut)` stay. An abbreviated response from the local seed is:

```json
{
  "quoteId": "<signed opaque quote>",
  "expiresAt": "2026-11-13T12:59:22.075Z",
  "nights": 2,
  "roomCount": 1,
  "currency": "VND",
  "nightlyRates": [
    { "date": "2026-12-13", "rate": "1450000", "quantity": 1, "amount": "1450000" },
    { "date": "2026-12-14", "rate": "1450000", "quantity": 1, "amount": "1450000" }
  ],
  "roomSubtotal": "2900000",
  "taxes": [],
  "fees": [],
  "discounts": [],
  "finalAmount": "2900000",
  "paymentMethod": "PAY_AT_HOTEL"
}
```

The quote includes `checkedAt`, hotel/room names, image URL if present, guest counts and cancellation policy if configured. The sample `expiresAt` is illustrative and changes for each request. No tax, service fee or promotion policy is implemented in this project yet. The backend adds none; a submitted `voucherCode` is rejected with `VOUCHER_INVALID`. The legacy demo voucher is not offered in the live booking flow. Payment remains manual at the hotel.

`POST /api/bookings` now requires the returned `quoteId` plus the same room, dates, counts and guest contact fields. The quote is signed, tied to the user and auth session, and expires after 600 seconds by default (`BOOKING_QUOTE_TTL_SECONDS`, allowed 60–3600). `BOOKING_QUOTE_SECRET` is recommended; if absent, the API uses its configured `JWT_ACCESS_SECRET` with a separate signing prefix. The quote does not reserve inventory. Booking creation obtains the hotel and room locks, rechecks visibility, capacity, availability and effective prices, then stores the nightly rate and cancellation policy snapshots. A repeated request using the same quote returns the existing booking.

Business errors include `INVALID_DATES`, `INVALID_GUESTS`, `ROOM_NOT_PUBLIC`, `ROOM_UNAVAILABLE` with `availableQty`, `RATE_UNAVAILABLE`, `VOUCHER_INVALID`, `PRICE_CHANGED`, `POLICY_CHANGED`, `QUOTE_EXPIRED` and `QUOTE_CONTEXT_MISMATCH`. If the price changes during review, the app requests a new quote and requires the User to acknowledge the new amount. A real booking is shown as pending manual payment only after the API creates it. There is no payment provider or card charge.

## Run and verify

From `DACN2`:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
npm.cmd run dev:mobile
```

Log in as a User, select an approved hotel's available room, then follow Room → Xem lại đặt phòng → Thông tin khách → Chi tiết thanh toán → Xác nhận đặt phòng. The quote screens show loading, availability errors, price changes, expiry and retry. For web testing on the same computer, use a terminal-specific `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api`; for Expo Go on a phone, point the URL at the computer's reachable LAN address.

Verification run on 2026-11-13:

- `npm.cmd run prisma:migrate`: migration applied.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`: passed.
- API Jest: 39 suites, 165 tests passed.
- PostgreSQL pricing e2e: 1 test passed; inventory e2e: 7 tests passed.
- Mobile traveler tests: 15 tests passed; Expo web export passed.
- Read-only smoke of real local data: 6 public rooms, 3 public owners, valid quotes from 2 owners.
- Browser screenshots: [Review 390×844](./booking-review-390.png), [Review 360×800](./booking-review-360.png), [Breakdown 390×844](./price-breakdown-390.png). The image slot is intentionally empty where the seeded hotel has no public cover photo. Price and CTA fit at both widths.

Four named reference DOCX files from the task attachment were not found in this checkout: `DAC_TA_CHUC_NANG_HE_THONG_BOOKING_TRAVEL`, `AI_BUILD_SPEC_BOOKING_TRAVEL_HOAN_CHINH`, `BOOKING_TRAVEL_FIGMA_UI_UX_SPEC_FULL`, and `BOOKING_TRAVEL_PROJECT_SPRINT_PLAN`. The implementation used the available Project Overview, SRS, Figma screens and current backend policy.
