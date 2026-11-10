# Savify — GitHub + Codemagic (step by step)

Do the parts **in order**. Tick each box ☐ when it's done.

- Parts 1–3 are **one time only**.
- After that, building is one button: Part 4.

Codemagic's free plan includes build minutes every month, and the free Mac minutes are enough for iPhone builds.

---

## PART 1 — Unzip the project (2 min)

1. ☐ Right-click `D:\ABLIZ\Savify-project.zip` → **Extract All…** → choose `D:\ABLIZ\` → **Extract**.
   You now have the folder `D:\ABLIZ\Savify-project`. **Use this folder from now on.**
2. ☐ Copy your **`.env`** file from `D:\ABLIZ\Savify App(1)\savify-mobile` into `D:\ABLIZ\Savify-project`.
   It's only needed to run the app on your computer, and it is never uploaded.

---

## PART 2 — Upload to GitHub (10 min, in your web browser)

1. ☐ Go to **github.com** and sign in as **Abliz5555**.
2. ☐ Click **+** (top right) → **New repository**.
   - Name: `savify-app`
   - Choose **Private**
   - Do **not** add a README
   - Click **Create repository**
3. ☐ Click the link **"uploading an existing file"**.
4. ☐ Open `D:\ABLIZ\Savify-project` in File Explorer.
   Select **everything except the `store` folder** (Ctrl+A, then Ctrl+click `store`).
   Drag it into GitHub and wait until all the files appear.
5. ☐ Click **Commit changes**.
6. ☐ Click **Add file → Upload files**, drag in the **`store`** folder, then click **Commit changes**.
7. ☐ Check that you can see **`codemagic.yaml`** in the list of files on GitHub. ✅

---

## PART 3 — Connect Codemagic (one time)

### 3A. Add the app (5 min)
1. ☐ Go to **codemagic.io** → **Sign in with GitHub** → allow access to `savify-app`.
2. ☐ Click **Add application** → **GitHub** → choose **`savify-app`**.
3. ☐ For project type, choose **React Native App**.
4. ☐ If it asks how to configure, choose **"codemagic.yaml"** (not "Workflow Editor").

✅ You can already build the **Android – test APK** now. Go to Part 4.
Do 3B and 3C when you're ready for the stores.

### 3B. Android key for Google Play (3 min)
I made your Android upload key. It's in the folder **`D:\ABLIZ\Savify-KEYS`** (private, never upload it to GitHub):
- `savify-upload.jks`, the key file
- `SAVIFY-KEYSTORE-PASSWORDS.txt`, its passwords

1. ☐ In Codemagic, click **Teams** (left menu) → your team → **Code signing identities** → **Android keystores**.
2. ☐ Click **Choose a file** and select `D:\ABLIZ\Savify-KEYS\savify-upload.jks`.
3. ☐ Fill in from the passwords file:
   - Keystore password → the password
   - Key alias → `savify`
   - Key password → the same password
   - **Reference name → `savify_upload`** (exactly like this)
4. ☐ Click **Add keystore**.
5. ☐ **Make a backup** of the `Savify-KEYS` folder, for example on a USB stick or in Google Drive.

### 3C. iPhone (15 min, needs your Apple Developer account, $99/year)
**a) Create the app ID and the app**
1. ☐ **developer.apple.com** → Account → **Identifiers** → **+** → **App IDs** → **App**.
   Description: `Savify` · Bundle ID: **Explicit**, `com.savify.mobile` · **Continue → Register**.
2. ☐ **appstoreconnect.apple.com** → **Apps** → **+** → **New App**:
   - Platform: iOS
   - Name: `Savify: Budget & Bill Tracker`
   - Bundle ID: `com.savify.mobile`
   - SKU: `savify001`
   - Click **Create**

**b) Make an API key for Codemagic**
3. ☐ App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → **+**.
   Name: `Codemagic` · Access: **App Manager** · **Generate**.
4. ☐ **Download** the `.p8` file. You can only download it once, so save it in `D:\ABLIZ\Savify-KEYS`.
   Write down the **Issuer ID** (top of the page) and the **Key ID**.
5. ☐ In Codemagic: **Teams** → your team → **Integrations** → **Developer Portal / App Store Connect** → **Connect** → **Add key**:
   - **Name: `Savify ASC key`** (exactly like this)
   - Issuer ID and Key ID: from step 4
   - Upload the `.p8` file
   - Click **Save**

**c) Signing certificate and profile**
6. ☐ Codemagic → **Teams** → **Code signing identities** → **iOS certificates** → **Generate certificate**.
   Choose type **Apple Distribution** and the key `Savify ASC key` → **Create**.
7. ☐ **iOS provisioning profiles** → **Fetch profiles**. If none appear for `com.savify.mobile`:
   developer.apple.com → **Profiles** → **+** → **App Store Connect** → App ID `com.savify.mobile` → choose the certificate → name it `Savify App Store` → **Generate**.
   Then **Fetch profiles** again in Codemagic and add it.

---

## PART 4 — Build (one button, any time)

1. ☐ Codemagic → your app **savify-app** → **Start new build**.
2. ☐ Branch: **main**. Workflow: pick one:

   | Workflow | You get | Setup needed |
   |---|---|---|
   | **Android – test APK** | an `.apk` to install on any Android phone | none |
   | **Android – Google Play (.aab)** | the file for Google Play | Part 3B |
   | **iPhone – TestFlight** | the app on TestFlight, ready for the App Store | Part 3C |

3. ☐ Click **Start new build**. It takes about 15–25 minutes.
4. ☐ When it's green ✅:
   - **APK:** at the bottom of the build page under **Artifacts**, download the `.apk` and send it to your Android phone. Open it to install, and allow "install unknown apps" if asked.
   - **.aab:** download it, then upload it in Google Play Console → Testing → Closed testing → Create release.
   - **iPhone:** it goes to TestFlight by itself. Install the **TestFlight** app on your iPhone to try it. Apple checks it for about 10–30 minutes first.

---

## If a build fails ❌

1. Click the red step in the build log.
2. Take a screenshot, or copy the last red lines.
3. Send it to Claude. I'll fix it and give you the corrected files.

---

## When you change the app later

1. Get the updated files (from Claude or your own edits).
2. In `app.json`, raise `"version"` (for example `1.0.0` → `1.0.1`).
3. GitHub → **Add file → Upload files** → drag the changed files → **Commit changes**.
4. Codemagic → **Start new build**.

Build numbers go up automatically.
