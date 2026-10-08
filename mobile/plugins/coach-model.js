const { withDangerousMod, withAppBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Bundles assets/models/coach.gguf into the Android APK, stored uncompressed so llama.rn can map it. */
module.exports = (config) => {
  config = withDangerousMod(config, ['android', (c) => {
    const src = path.join(c.modRequest.projectRoot, 'assets/models/coach.gguf');
    if (!fs.existsSync(src)) { console.warn('coach.gguf missing: run `npm run fetch-model`. The coach will use plain text.'); return c; }
    const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/assets');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, path.join(dir, 'coach.gguf'));
    return c;
  }]);
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes("noCompress 'gguf'")) {
      c.modResults.contents = c.modResults.contents.replace('androidResources {', "androidResources {\n        noCompress 'gguf'");
    }
    return c;
  });
};
