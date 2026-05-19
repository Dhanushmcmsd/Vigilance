# Vigilance — client production release

## Install (officers)

Use the **production** Android APK from Expo (not preview builds):

https://expo.dev/accounts/dhanushraghav/projects/vigilance-management-system/builds?channel=production

After install, open the app once on Wi‑Fi. When an OTA is available you will see **Update available** → tap **Update now** → after restart, **Update successful** confirms the bundle.

## Channels

| Channel      | Who uses it                         |
|-------------|--------------------------------------|
| `production`| Client officers (field app)          |
| `preview`   | Internal testing only — do not ship  |

## Build profiles (`eas.json`)

| Profile             | Output        | Use case                          |
|--------------------|---------------|-----------------------------------|
| `production`       | APK, internal | **Client handoff** (direct install) |
| `production-store` | AAB, store    | Google Play internal/production   |
| `preview`          | APK, internal | Dev / QA only                     |

## Commands

```bash
cd mobile

# Client APK (production channel + OTA)
eas build --platform android --profile production --non-interactive

# Google Play bundle
eas build --platform android --profile production-store --non-interactive

# Push JS-only fixes to installed production apps (same app version 1.1.0)
eas update --channel production --message "describe change"
```

## Environment

Set on EAS (Project → Environment variables) for **production**:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

These are baked into the native build; OTA updates cannot change them.
