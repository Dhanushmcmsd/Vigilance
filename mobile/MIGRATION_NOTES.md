# Mobile App Overhaul — Migration Notes

This document covers everything that landed in the **Mobile App Overhaul** branch:
what changed, in what order to install, and how to verify each layer before
shipping.

> **TL;DR** — pull this branch, then run:
>
> ```bash
> cd mobile
> rm -rf node_modules
> npm install
> npx expo install --check    # snap any drifting peers to SDK 53 pins
> npx expo prebuild --clean   # regenerates native projects with the new arch
> npx expo run:android        # or :ios
> ```

---

## 1. What changed

### 1.1 Dependencies — `package.json`

| Package | Before | After | Reason |
| --- | --- | --- | --- |
| `expo` | `~51.0.28` | `~53.0.0` | SDK 53 ships RN 0.79 + React 19, better perf, New Architecture by default |
| `expo-router` | `~3.5.23` | `~4.0.0` | Typed routes, file-based layouts, async route splits |
| `react` / `react-native` | `18.2.0` / `0.74.5` | `19.0.0` / `0.79.0` | Required by Expo 53 |
| `nativewind` | `^2.0.11` | `^4.1.0` | CSS interop, no class transformer, full Tailwind class support |
| `tailwindcss` | `^3.3.2` | `^3.4.13` | NativeWind v4 requirement |
| `@tanstack/react-query` | — | `^5.59.0` | Caching, background refetch, retry-on-reconnect |
| `react-native-mmkv` | — | `^3.1.0` | ~10× faster than AsyncStorage for the sync queue |
| `expo-haptics` | — | `~14.0.0` | Tactile confirmation on every checklist answer / form submit |
| `react-native-reanimated` | — | `~3.16.0` | Required peer of expo-router 4 |
| `react-native-gesture-handler` | — | `~2.20.0` | Required peer of expo-router 4 |
| `react-native-svg` | — | `15.8.0` | Required by NativeWind v4 sample components |

> The exact patch pins for SDK 53 are validated by `npx expo install --check`
> — run it after `npm install` to align anything that's drifted.

### 1.2 Build pipeline

- `babel.config.js` — switched to `babel-preset-expo` with `jsxImportSource:
  'nativewind'` and the `nativewind/babel` preset. Reanimated plugin moved to
  the bottom of `plugins` per Reanimated docs.
- `metro.config.js` (new) — wraps `expo/metro-config` with `withNativeWind`,
  pointing at `./global.css` for the Tailwind compile step.
- `tailwind.config.js` — adopts the official `nativewind/preset`, exposes the
  elderly-friendly font + touch tokens (`body`, `h1`, `h2`, `min-h-touch`,
  `min-h-row`).
- `global.css` (new) — the three Tailwind directives. Imported once from
  `app/_layout.tsx` so every screen inherits the styles.
- `nativewind-env.d.ts` (new) — triple-slash type reference so
  `className` props type-check on `View` / `Text` / `Image`.
- `app.config.js` — added `newArchEnabled: true`, `scheme: 'vigilancems'`
  (used by the password-reset deep link), and registered the new native
  plugins (`expo-haptics`, `expo-secure-store`, `react-native-mmkv`).

### 1.3 New libraries (`mobile/lib/`)

| File | Purpose |
| --- | --- |
| `a11y.ts` | Source-of-truth constants for typography (16/18/20/24/32sp), touch targets (56dp / 64dp rows), spacing, radius, colour. **Import these instead of hard-coding sizes.** |
| `haptics.ts` | Typed wrapper around `expo-haptics` with `tap`, `medium`, `success`, `warning`, `error`. Silently no-ops on web / when the native module isn't installed. |
| `syncQueue.ts` | MMKV-backed offline submission queue with AsyncStorage fallback. Exposes `queueInspection`, `peekQueue`, `flushQueue`, `clearQueue`. Idempotent — failures stay in the queue and retry on next reconnect. Honours `inspectionId` for lazy-created RED-trigger drafts so the queue UPDATEs the existing row instead of inserting a duplicate. |
| `useNetworkSync.ts` | Mounted once at the root layout. Listens to `NetInfo`, fires `flushQueue()` on every reconnect, exposes `{ isOnline, lastFlush, syncing }` for UI banners. |
| `queryClient.ts` | Shared TanStack `QueryClient`. Mobile-tuned defaults: `staleTime` 60s, `gcTime` 30m, `retry` 2, `refetchOnReconnect` on. |

### 1.4 New screens

| Route | What it does |
| --- | --- |
| `(officer)/drafts.tsx` | Lists every locally-saved draft + every queued (offline-submitted) inspection. Resume, delete, force-sync. Pull-to-refresh. |
| `(officer)/submissions.tsx` | History of completed inspections for the signed-in officer, with score + risk-level pills. Tap a row to open the detail screen. |
| `(officer)/submission-detail.tsx` | Read-only view of a submitted inspection: summary, supervisor comment, general remarks, photos (carousel), documents, full checklist grouped by section with risk-band colours. |
| `(officer)/profile.tsx` | Identity card (name, role, email), recent branch assignments, sync status, **two-step Sign Out** with a confirmation modal. |
| `(auth)/forgot-password.tsx` | Calls `supabase.auth.resetPasswordForEmail` with a `vigilancems://reset-password` redirect, shows the "check your inbox" confirmation state. |

### 1.5 Existing screens that were touched

- `app/_layout.tsx` — wraps the tree in `QueryClientProvider`, mounts
  `useNetworkSync`, imports `global.css`.
- `app/(officer)/index.tsx` — rewritten with the a11y constants. **Drafts
  button now actually navigates**. New "Pending sync" + "My Submissions" rows.
  Header swaps the icon-only logout for a labelled **Profile** button (the
  full sign-out flow lives behind the profile screen).
- `app/(auth)/login.tsx` — body font bumped to 16sp, headings to 24sp, all
  `rgba(255,255,255,0.5)` text replaced with the solid
  `COLOR.textOnPrimaryMuted` (#e2e8f0). Password-eye toggle now has a
  56×56dp tap area. **"Forgot password?" link** wired up.
- `components/ChecklistItem.tsx` — every Yes/No/N/A tap now fires
  `haptics.tap()`.

### 1.6 Elderly-friendly UI rules enforced

Every new screen pulls its typography, spacing, and touch targets from
`mobile/lib/a11y.ts`. The floors:

- Body text ≥ **16sp** (`FONT.body`)
- Headings ≥ **20sp** (`FONT.h2` / `FONT.h1` / `FONT.display`)
- Touch targets ≥ **56×56dp** (`TOUCH.minHeight` / `TOUCH.iconButton`)
- Solid high-contrast colours (no `rgba(...,0.5)` text on coloured backgrounds)
- Every button carries an accessible label (`accessibilityLabel`) and
  visible text — icon-only buttons are forbidden.

---

## 2. Install & verify

### 2.1 Clean install

```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
npx expo install --check   # snap pins; answer 'y' to any prompts
```

`expo install --check` will offer to bump anything that drifted between the
loose `~`/`^` ranges in `package.json` and the exact SDK 53 pins.

### 2.2 TypeScript

```bash
npx tsc --noEmit
```

Expected output: **no errors**. Two pre-existing issues that lived in the SDK
51 build (a missing `subtitle` prop on `BranchCardProps` and the NativeWind v2
`className` complaint on `AuthGuard` / `ProgressBar`) are now fixed by the
NativeWind v4 type reference in `nativewind-env.d.ts`.

### 2.3 Native prebuild

`react-native-mmkv` and `expo-haptics` both ship native modules — you cannot
test them in Expo Go. Use a **development build**:

```bash
npx expo prebuild --clean         # regenerates ios/ and android/
npx expo run:android              # device or emulator
# or
npx expo run:ios                  # device or simulator (macOS only)
```

The first run after `--clean` will be slow (~5–10 min); subsequent runs are
incremental.

### 2.4 Smoke test checklist

After the dev build is on a device, walk through:

- [ ] **Login** — correct creds sign in; wrong creds buzz + show error toast.
- [ ] **Forgot password** — typing an invalid email rejects; valid email
      shows the "check your inbox" state.
- [ ] **Home** — greeting renders; "My Drafts" badge updates after creating
      a draft; tapping any of the three "My work" rows navigates.
- [ ] **Drafts** — Resume opens the checklist at the right branch; Delete
      asks for confirmation; "Sync now" reports the right counts.
- [ ] **Submissions** — a recently submitted inspection appears here.
- [ ] **Submission detail** — score, risk pill, supervisor comment, photos,
      and the full grouped checklist render.
- [ ] **Profile** — name + email + role show; sign-out modal asks for
      confirmation, then drops to the login screen.
- [ ] **Checklist haptic** — every Yes/No/N/A tap produces a soft buzz.
- [ ] **Offline** — toggle airplane mode, submit an inspection: it lands in
      the queue with the "queued" banner. Turn data back on, watch the
      queue drain on its own (or hit "Sync now").

---

## 3. Known follow-ups (intentionally left in)

These were called out in the original brief but kept out of this PR to stay
reviewable:

- **`checklist.tsx` split** — the current 31KB file still works as-is. The
  refactor into smaller card units (≥64dp rows, larger Yes/No/N/A pills)
  is a follow-up. The new a11y constants in `lib/a11y.ts` are already used
  by every screen *around* it, so the migration will be mechanical.
- **Migrate remaining inline `StyleSheet` objects to NativeWind className
  strings.** The new screens use inline-style objects keyed off the a11y
  constants — they're loud (no NativeWind translation pass) but they
  guarantee the elderly-friendly floors. Conversion to `className` is
  cosmetic and can happen incrementally.
- **`storage.ts` ↔ `syncQueue.ts` merge.** `storage.ts` still drives drafts
  (resume, delete) while the new `syncQueue.ts` handles offline submissions.
  Both will fold into one MMKV-backed module once the dev build is verified.

---

## 4. Rollback

The whole overhaul is contained in one branch — `git revert <merge-sha>`
walks the codebase back to the SDK 51 build. No DB migrations were applied
as part of this change.
