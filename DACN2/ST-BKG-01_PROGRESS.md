# ST-BKG-01 progress

- Branch: `feat/ST-BKG-01-tao-bao-gia-booking`, based on `develop` at `6b06d98`.
- Existing dependencies: HTL-09 inventory and OWN-09 nightly pricing are in `develop`.
- Existing booking review and confirmation use demo pricing and a local mock booking; backend quote lacks expiry and booking linkage.
- Design checked: Figma BKG-UI-01/02/04/05. Four named specification DOCX files are absent; PROJECT OVERVIEW and SRS are present.
- Implemented: signed per-session quote (600-second default), exact Decimal nightly totals, shared inventory/pricing, public visibility checks, create-time revalidation and immutable snapshots, API error codes, rate limit, live User review/breakdown/guest/booking flow, additive migration.
- Verified: Prisma migration; typecheck/lint/build; 165 API unit tests; 8 PostgreSQL e2e tests; 15 mobile traveler tests; Expo web export; two-owner read-only DB smoke; browser screenshots at 390×844 and 360×800 in `docs/st-bkg-01`.
- Next: final review of branch diff, commit/push and PR into develop without merging. Preserve pre-existing untracked `chrome-profile-adm04/` and avoid adding generated `.codex-bkg-web-export/`.
