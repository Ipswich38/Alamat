import type { CapacitorConfig } from '@capacitor/cli';

/*
 * ⚠ appId is PERMANENT once the first build is uploaded to Google Play. It can
 * never be changed afterwards; a different id is a different app, with its own
 * listing, reviews and install base.
 *
 * `com.kreativloops.alamat` is chosen to sit beside `com.kreativloops.oddsends`
 * and the `kreativloops` developer name on the Play account. The older npm
 * script here said `com.plaidelab.alamat`, which matches the Netlify team
 * rather than the publisher. Change this now if the other namespace is wanted;
 * after the first upload it is settled forever.
 *
 * No `server.url` on purpose. Pointing at the hosted site would make this a
 * webview wrapper: it would need a connection to start, and Play increasingly
 * rejects apps that are only a browser pointed at a website. The whole game
 * ships inside the package and runs from local files.
 */
const config: CapacitorConfig = {
  appId: 'com.kreativloops.alamat',
  appName: 'Alamat',
  webDir: 'out',
  android: {
    // The web build already draws its own dark ground; letting the webview
    // paint white first shows a flash on every cold start.
    backgroundColor: '#020617',
  },
};

export default config;
