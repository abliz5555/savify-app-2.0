// Lets Codemagic set the build number automatically (BUILD_NUMBER).
// Everything else comes from app.json.
module.exports = ({ config }) => {
  const build = Number(process.env.BUILD_NUMBER);
  if (Number.isFinite(build) && build > 0) {
    config.ios = { ...config.ios, buildNumber: String(build) };
    config.android = { ...config.android, versionCode: build };
  }
  return config;
};
