# Savify — Setup Guide (100% free)

Do these steps **one at a time, in order**. Each one takes about 2–5 minutes.

Everything here is free:
- **Supabase** (login, database and receipt scanning): free plan
- **Google Gemini** (reads receipt photos): free key
- **Smart Coach tips**: run on the phone, so they cost nothing

The only cost that can't be avoided is Apple's **$99/year** developer account, and only when you publish to the App Store.

---

## STEP 1 — Set up the database (5 min)

1. Go to **https://supabase.com/dashboard** and open your project (`cmlewbfricsklzncddnc`).
2. In the left menu, click **SQL Editor**.
3. Click **New query**.
4. On your computer, open this file in VS Code:
   `D:\ABLIZ\Savify App(1)\savify-mobile\supabase\setup.sql`
5. Press **Ctrl + A**, then **Ctrl + C** to copy everything.
6. Go back to Supabase, click in the big empty box, and press **Ctrl + V**.
7. Click the green **Run** button (bottom right).
8. ✅ You should see **"Success. No rows returned"**.

> ⚠️ This deletes your old test data. That's on purpose: it was linked to the old Clerk login, which no longer works.

---

## STEP 2 — Make the emails send a 6-digit code (5 min)

The app asks users to type a **code** from their email.

1. In Supabase, open **Authentication** → **Emails**. In older dashboards this is called **Email Templates**.
2. Click **Confirm signup**.
3. Replace the **Subject** with:
   `Your Savify code`
4. Replace the whole **Body** with:
   ```html
   <h2>Welcome to Savify</h2>
   <p>Your verification code is:</p>
   <h1 style="letter-spacing:6px">{{ .Token }}</h1>
   <p>This code expires in 1 hour. If you didn't sign up, ignore this email.</p>
   ```
5. Click **Save**.
6. Click **Reset Password**. Set the Subject to `Your Savify reset code` and replace the Body with:
   ```html
   <h2>Reset your Savify password</h2>
   <p>Your code is:</p>
   <h1 style="letter-spacing:6px">{{ .Token }}</h1>
   <p>If you didn't ask for this, ignore this email.</p>
   ```
7. Click **Save**.
8. Open **Authentication** → **Sign In / Providers** → **Email**. Make sure **"Confirm email"** is **ON**, then click **Save**.

### ⚠️ Important about emails

Supabase's free built-in email has two limits:
- It sends **only to your own team's email addresses**.
- It sends **only about 2 emails per hour**.

That's fine for testing with your own email. **Before real users sign up**, connect a free email sender:

- **Brevo** (free, 300 emails/day): create an account at brevo.com → **SMTP & API** → copy the SMTP login and key.
  Then in Supabase: **Authentication** → **Emails** → **SMTP Settings** → turn on **Custom SMTP** and paste:
  - Host: `smtp-relay.brevo.com`
  - Port: `587`
  - Username and password: from Brevo
  - Sender email: your verified Brevo sender

---

## STEP 3 — Turn on receipt scanning (5 min, optional)

1. Go to **https://aistudio.google.com/apikey** and sign in with Google.
2. Click **Create API key** and copy it.
3. In Supabase, click **Edge Functions** in the left menu.
4. Click **Deploy a new function** → **Via Editor**.
5. Name it exactly: `scan-receipt`
6. On your computer, open
   `D:\ABLIZ\Savify App(1)\savify-mobile\supabase\functions\scan-receipt\index.ts`.
   Copy everything and paste it into the Supabase editor, replacing what's there.
7. Click **Deploy function**.
8. In **Edge Functions**, click **Secrets** and add:
   - Name: `GEMINI_API_KEY`
   - Value: the key from step 2
9. Click **Save**.

Each user can scan **15 receipts a day**. This protects your free Google quota. To change it, add a secret called `DAILY_SCAN_LIMIT`.

> Privacy note: Google's free tier may use receipt photos to improve its products. The app's Privacy Policy already says this.

---

## STEP 4 — Run the app on your phone (5 min)

1. Open the folder `D:\ABLIZ\Savify App(1)\savify-mobile` in **VS Code**.
2. Open the terminal: menu **Terminal** → **New Terminal**.
3. Type this and press Enter. Wait until it finishes:
   ```
   npm install
   ```
4. Then type this and press Enter:
   ```
   npx expo start -c
   ```
5. Scan the QR code with your iPhone camera. It opens in **Expo Go**.
6. Tap **Create Account**, use **your own email**, and type the 6-digit code from the email.

✅ You're in. Try adding an expense, an income and a bill.

---

## STEP 4b — Try the voice feature (needs the real app, not Expo Go)

Expo Go can't use the microphone feature. In Expo Go you can still **type** into “Tell Savify”, or tap the 🎤 on your keyboard.
To test real voice on your iPhone:

1. In the VS Code terminal, type and press Enter:
   ```
   eas device:create
   ```
   Choose **Website**, open the link on your iPhone and install the profile. This registers your phone with Apple.
2. Then:
   ```
   eas build --platform ios --profile preview
   ```
3. When it's finished, scan the QR code with your iPhone camera to install Savify.
4. Open Savify, tap **Tell Savify** and say: *“Lunch 35 cash”*.

Android: run `eas build --platform android --profile preview`, then open the link on your phone to install it.

---

## STEP 5 — Build for TestFlight / App Store

In the VS Code terminal:
```
eas build --platform ios
```
When it finishes:
```
eas submit --platform ios
```

The Supabase keys are already in `eas.json`. **Clerk and Replit are completely removed.**

> Your `.env` file still works as it is. You can delete the lines that start with `EXPO_PUBLIC_CLERK_` and `EXPO_PUBLIC_API_URL`, because the app doesn't use them any more.

---

## Before you launch — checklist

- [ ] STEP 1 done (database)
- [ ] STEP 2 done (email codes), **plus Brevo SMTP connected**
- [ ] STEP 3 done (receipt scan), or hide the Scan feature
- [ ] RevenueCat: products set up (free until you earn $2,500/month)
- [ ] `support@savify.app` in Settings → Legal: change it to an email you own (file `components/settings/LegalSection.tsx`)
- [ ] Apple Developer account ($99/year)

---

## What changed (summary)

**Security**
- Each user can now only see and change their own data. Before, the database wasn't protected.
- Balance changes happen in one safe step, so balances can't get out of sync.
- Restoring a backup is all-or-nothing. If it fails, nothing is lost.
- Delete account now really deletes everything (Apple requires this).

**Free**
- Clerk login is replaced with Supabase login.
- The Replit server is removed. Coach tips run on the phone, and receipt scan uses free Gemini.

**Bug fixes**
- A bill due on the 31st now stays at the end of the month. Before, it jumped to the 3rd of the next month.
- "Today" and "this month" use Dubai time, not UTC, so they're correct after midnight.
- Paying a bill asks whether the money came from Cash or Bank, and updates that balance.
- Editing a transaction keeps its date and account. Before, it deleted it and made a new one.
- When someone pays back money you lent, it's added to your balance. Before, it was subtracted.
- Lent vs borrowed loans are saved properly (not hidden in the name).
- "vs last month" compares the same days, so it's fair in the middle of the month.

**New**
- New clean design: new colours, a new Home balance card, big quick-action buttons, and new login screens.
- Budget alerts on Home, plus a phone notification at 80% and 100% of a budget.
- Smart Coach: free users get the top tip, and Pro users get all of them.
- Restore from backup, and a better spreadsheet export that handles Arabic correctly.
- Scanned receipts keep the date printed on the receipt.
- Password strength meter and show/hide password.

To go back to the gold colour, open `constants/colors.ts` and follow the note at the top.
