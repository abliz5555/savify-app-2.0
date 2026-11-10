/**
 * Codemagic helper: after "expo prebuild", make the Android RELEASE build use your
 * upload keystore from Codemagic (Team → Code signing identities → Android keystores).
 * Codemagic gives us the keystore through these variables:
 *   CM_KEYSTORE_PATH, CM_KEYSTORE_PASSWORD, CM_KEY_ALIAS, CM_KEY_PASSWORD
 * Without them (for example the APK test build) nothing is changed.
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "android", "app", "build.gradle");
if (!process.env.CM_KEYSTORE_PATH) {
  console.log("No keystore from Codemagic → keeping the default (test) signing.");
  process.exit(0);
}
let g = fs.readFileSync(file, "utf8");

if (!g.includes("signingConfigs.release")) {
  g = g.replace(
    /signingConfigs \{\s*\n(\s*)debug \{/,
    (m, indent) =>
      `signingConfigs {\n${indent}release {\n` +
      `${indent}    storeFile file(System.getenv("CM_KEYSTORE_PATH"))\n` +
      `${indent}    storePassword System.getenv("CM_KEYSTORE_PASSWORD")\n` +
      `${indent}    keyAlias System.getenv("CM_KEY_ALIAS")\n` +
      `${indent}    keyPassword System.getenv("CM_KEY_PASSWORD")\n` +
      `${indent}}\n${indent}debug {`,
  );
  // the release build type is the second "signingConfig signingConfigs.debug"
  let n = 0;
  g = g.replace(/signingConfig signingConfigs\.debug/g, (m) => (++n === 2 ? "signingConfig signingConfigs.release" : m));
  if (n < 2) throw new Error("Could not find the release build type in build.gradle");
}
fs.writeFileSync(file, g);
console.log("✅ Release build will be signed with your Codemagic keystore.");
