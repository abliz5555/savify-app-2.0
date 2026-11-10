# Savify — Track. Save. Grow.

A simple, private money app for iPhone and Android: expenses, income, bills, loans, budgets,
a smart coach, voice quick-add ("Lunch 35 cash") and 4 themes.

Built with **Expo (React Native)** + **Supabase** (free plan). Builds: **Codemagic** (`codemagic.yaml`).

## Guides
| File | What it's for |
|---|---|
| `SETUP-GUIDE.md` | First-time setup: database, email codes, receipt scan, run on your phone |
| `GITHUB-AND-BUILD.md` | Put the code on GitHub and build with **Codemagic** (Android APK, Google Play, TestFlight) |
| `PUBLISH-GUIDE.md` | Publish on the App Store and Google Play |
| `store/STORE-LISTING.md` | All store text, ready to paste |

## Run it
```
npm install
npx expo start -c
```

## Main settings
`lib/config.ts` — Pro on/off, support email, privacy links.
`constants/colors.ts` — the 4 themes.
