# Put Savify on GitHub and build it (step by step)

You only do Parts 1–3 **once**. After that, building is one button (Part 4).

---

## PART 1 — Unzip the project (2 min)

1. ☐ Download **`Savify-project.zip`** from the chat with Claude.
2. ☐ Right-click it → **Extract All…** → choose `D:\ABLIZ\` → **Extract**.
   You now have the folder `D:\ABLIZ\Savify-project`.
   This is the clean, final version of the app. Use this folder from now on.
3. ☐ Copy your **`.env`** file from the old folder `D:\ABLIZ\Savify App(1)\savify-mobile` into `D:\ABLIZ\Savify-project`.
   It holds your Supabase keys for running the app on your computer. It's never uploaded to GitHub, which keeps it private.

---

## PART 2 — Upload to GitHub (10 min, in your web browser)

1. ☐ Go to **github.com** and sign in as **Abliz5555**.
2. ☐ Click **+** (top right) → **New repository**.
   - Repository name: `savify-app`
   - Choose **Private** (only you can see the code)
   - Do **not** tick "Add a README"
   - Click **Create repository**
3. ☐ On the next page, click the link **"uploading an existing file"**.
4. ☐ Open `D:\ABLIZ\Savify-project` in File Explorer.
   Select **everything EXCEPT the `store` folder** (press Ctrl+A, then Ctrl+click `store` to unselect it).
   Drag it into the GitHub page. Wait until all files are listed.
5. ☐ Click the green **Commit changes** button. Wait until it finishes.
6. ☐ Click **Add file → Upload files**, drag the **`store`** folder in, then click **Commit changes**.
   (GitHub accepts 100 files at a time, which is why it's done in two parts.)
7. ☐ Click the **Actions** tab. You'll see **"Check code"** running.
   After about 2 minutes it shows a ✅ green tick, which means the code has no errors.

> If you don't see the `.github` folder after uploading, Windows hid it. In File Explorer, click **View → Show → Hidden items**, then upload the `.github` folder on its own.

---

## PART 3 — Connect GitHub to Expo (5 min, one time)

1. ☐ Go to **expo.dev** and sign in (the same account you used for `eas login`).
2. ☐ Click your profile picture → **Account settings** → **Access tokens** → **Create token**.
   Name it `github` → **Create** → **copy** the token.
3. ☐ Go back to GitHub → your `savify-app` repository → **Settings** → **Secrets and variables** → **Actions**.
4. ☐ Click **New repository secret**:
   - Name: `EXPO_TOKEN`
   - Secret: paste the token
   - Click **Add secret**

### iPhone only: one-time Apple sign-in
Apple needs you to sign in **once** on your computer, so Expo can create your app certificates.
1. ☐ In VS Code, open the folder `D:\ABLIZ\Savify-project` → **Terminal → New Terminal**.
2. ☐ Type these, pressing Enter after each one:
   ```
   npm install
   eas build --platform ios --profile production
   ```
3. ☐ Sign in with your Apple ID when it asks, and press **Enter** (Yes) for every question.
   After this, GitHub can build iPhone versions by itself.

---

## PART 4 — Build the app (one button, any time)

1. ☐ GitHub → `savify-app` → **Actions** tab → click **"Build Savify"** (left side).
2. ☐ Click **Run workflow** (right side) and choose:
   | Choose | You get |
   |---|---|
   | `android-apk` | An **.apk file** you can install on any Android phone to test (fastest) |
   | `android-store` | The **.aab file** for Google Play |
   | `ios-store` | The iPhone build for **TestFlight / App Store** |
   | `both-stores` | Both store builds at once |
   Tick **"Also send it to the store"** if you want it uploaded automatically. This works after your first manual upload; see PUBLISH-GUIDE.
3. ☐ Click the green **Run workflow** button.
4. ☐ Go to **expo.dev** → your project **savify-mobile** → **Builds**. Your build appears there.
   - Android: about 10–20 minutes
   - iPhone: about 15–30 minutes
5. ☐ When it says **Finished**, click it → **Download**, or scan the QR code with your phone to install.

> **Free limits:** Expo's free plan includes a limited number of builds each month. You can see how many you've used at expo.dev → Billing. GitHub Actions is free for this.

---

## When you change the app later
1. Edit the files (or ask Claude, then replace the files).
2. In `app.json`, raise `"version"` (for example `1.0.0` → `1.0.1`).
3. Upload the changed files to GitHub (**Add file → Upload files → Commit changes**).
4. Run **Build Savify** again.
