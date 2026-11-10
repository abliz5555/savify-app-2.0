# Savify — How to publish (step by step)

Do the parts **in order**. Each step is small. Tick the box ☐ when it's done.

**Costs:** Apple $99/year · Google $25 one time · everything else is **free**.

All store text is ready to paste in **`store/STORE-LISTING.md`**.
Screenshots and graphics are ready in the **`store`** folder.

---

## PART 0 — Finish the setup first (if you haven't)

☐ Do Steps 1–4 in **`SETUP-GUIDE.md`**: database, email codes, receipt scan, and test the app on your phone.

---

## PART 1 — Make a free support email (5 min)

1. ☐ Go to **gmail.com** → **Create account** → **For my personal use**.
2. ☐ Choose an address, for example `savify.help@gmail.com`. If it's taken, try `savifyapp.help@gmail.com` or similar.
3. ☐ **Send me the new address.** I'll update it in the app and on the website for you.
   (Or do it yourself: change `SUPPORT_EMAIL` in `lib/config.ts`, and search for `savify.help@gmail.com` in the 4 files in `store/website`.)

---

## PART 2 — Put the Privacy Policy online (free, 10 min)

Both stores need a public web link to your Privacy Policy.

1. ☐ Go to **github.com** and sign in as **Abliz5555**.
2. ☐ Click the **+** (top right) → **New repository**.
3. ☐ Repository name: `savify-legal` · choose **Public** · click **Create repository**.
4. ☐ Click the link **"uploading an existing file"**.
5. ☐ Open the folder `D:\ABLIZ\Savify App(1)\savify-mobile\store\website` on your computer.
   Select **all 5 files** and drag them into the GitHub page.
6. ☐ Click the green **Commit changes** button.
7. ☐ Click **Settings** (top of the repo) → **Pages** (left menu).
8. ☐ Under **Branch**, choose **main** and **/ (root)** → click **Save**.
9. ☐ Wait 2 minutes, then open **https://abliz5555.github.io/savify-legal/privacy.html**.
   ✅ You should see the Savify Privacy Policy.

---

## PART 3 — Keep Supabase ready for real users

1. ☐ **Email sender:** connect free **Brevo** SMTP (see `SETUP-GUIDE.md`, Step 2). Without it, new users won't get their sign-up code.
2. ☐ **Important:** free Supabase projects **pause after 7 days with no activity**. While you wait for store review, open the app every few days. If it ever pauses: Supabase dashboard → your project → **Restore**.

---

## PART 4 — Make a test account for the store reviewers (5 min)

Apple and Google need an account they can sign in with.

1. ☐ In the Savify app, sign out, then tap **Create Account**.
2. ☐ Use your new Gmail with **+review** added, for example `savify.help+review@gmail.com`. Gmail delivers it to your normal inbox.
3. ☐ Pick a password, for example `SavifyReview2026`, and type in the 6-digit code from the email.
4. ☐ On the Home screen, tap **"Or explore with sample data"** → **Load sample data**.
5. ☐ Write the email and password into the **App Review notes** in `store/STORE-LISTING.md`.

---

## PART 5A — Publish on the iPhone App Store

### 5A-1. Apple developer account (one time)
1. ☐ Go to **developer.apple.com/programs/enroll** → **Start Your Enrollment** → choose **Individual**. Pay $99.
2. ☐ Wait for the "Welcome" email (usually 1–2 days).

### 5A-2. Build and send to Apple (with Codemagic)
1. ☐ Do **Part 3C** in `GITHUB-AND-BUILD.md` once: app ID, App Store Connect app, API key, certificate.
2. ☐ Codemagic → **Start new build** → workflow **iPhone – TestFlight** → **Start new build**.
3. ☐ Wait 20–30 minutes. ✅ The build appears in **appstoreconnect.apple.com** → Savify → **TestFlight**.

### 5A-4. Fill in the App Store page
Go to **appstoreconnect.apple.com** → **Apps** → **Savify**. Copy each item from `store/STORE-LISTING.md`.

1. ☐ **App Information:** category **Finance**, then paste the **Privacy Policy URL**.
2. ☐ **App Privacy:** enter the answers from the table in STORE-LISTING.
3. ☐ **Pricing and Availability:** price **Free**, all countries.
4. ☐ **Version 1.0 page:**
   - **Screenshots:** drag the 6 files from `store/screenshots-final/app-store` into the **6.9" Display** box.
   - **Promotional text, Description, Keywords, Support URL:** paste them.
   - **Build:** click **+** and choose the build you uploaded.
   - **Age rating:** answer "None" to everything → **4+**.
   - **App Review Information:** paste the test email and password, plus the Notes.
5. ☐ Click **Add for Review** → **Submit to App Review**.
6. ☐ Wait 1–3 days. Apple emails you the result.

---

## PART 5B — Publish on Google Play

> ⚠️ **Google rule for new personal accounts:** before going public, you must run a **closed test with at least 12 people for 14 days in a row**. Plan for this: ask friends and family with Android phones.

### 5B-1. Google developer account (one time)
1. ☐ Go to **play.google.com/console/signup** → **Yourself** → pay $25 → verify your identity with your ID. This can take a few days.

### 5B-2. Build the Android app (with Codemagic)
1. ☐ Do **Part 3B** in `GITHUB-AND-BUILD.md` once, to add the Android key.
2. ☐ Codemagic → **Start new build** → workflow **Android – Google Play (.aab)** → **Start new build**.
3. ☐ When it's green ✅, download the **`.aab`** file from **Artifacts** at the bottom of the build page.

### 5B-3. Create the app in Play Console
1. ☐ **play.google.com/console** → **Create app** → name `Savify: Budget & Bill Tracker`, App, **Free** → Create.
2. ☐ Go through **Dashboard → "Set up your app"**. For each task, use STORE-LISTING:
   - Privacy policy URL
   - App access → "All or some functionality is restricted" → add the test email and password
   - Ads → **No**
   - Content rating → fill the questionnaire (all **No**) → **Everyone**
   - Target audience → **18 and over**
   - Data safety → answers from STORE-LISTING
   - Financial features → **Personal finance / budgeting**
   - Government apps → **No**
3. ☐ **Main store listing:** short and full description, the icon `store/graphics/play-icon-512.png`, the feature graphic `store/graphics/play-feature-graphic-1024x500.png`, and phone screenshots from `store/screenshots-final/google-play`.

### 5B-4. Closed test (the 14-day rule)
1. ☐ **Testing → Closed testing → Create track**.
2. ☐ **Testers:** create an email list with **12 or more** Gmail addresses of friends and family.
3. ☐ **Create release** → upload the `.aab` file → **Save → Review → Start rollout**.
4. ☐ Send testers the **join link**. They must install the app and keep it for **14 days**.
5. ☐ After 14 days: **Dashboard → Apply for production** → answer the questions → wait for approval.
6. ☐ **Production → Create release** → choose the same build → **Start rollout**. 🎉

---

## PART 6 — Turn on Savify Pro later (optional)

Do this **after** the app is live. Then make a new version.

1. ☐ **App Store Connect → Savify → Subscriptions:** create a group "Savify Pro" with 2 products, for example:
   `savify_pro_monthly` ($4.99/month) and `savify_pro_yearly` ($29.99/year).
2. ☐ **Google Play → Monetize → Subscriptions:** create the same 2 products.
3. ☐ **app.revenuecat.com:**
   - Add your iOS app and Android app.
   - Create an **Entitlement** called exactly `Savify Pro`.
   - Add the 4 products to it.
   - Create an **Offering** named "default" with a Monthly and an Annual package.
   - Copy the API keys (starts with `appl_` for iOS and `goog_` for Android).
4. ☐ Send me the keys and I'll do the rest: switch on `PRO_ENABLED: true` in `lib/config.ts` and add the keys to `codemagic.yaml`.
5. ☐ Build a new version with Codemagic (Part 5A-2 and 5B-2).

---

## When you update the app later

1. Change the app (or ask me to).
2. In `app.json`, raise `"version"` (for example `1.0.0` → `1.0.1`).
3. Upload the changed files to GitHub and start the same Codemagic build. Build numbers go up automatically.
