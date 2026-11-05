# PTT

iOS and Android shell for Chat. The app name is **PTT**. The bundle id is `vn.pttads.ptt`.

The WebView opens `https://rs.pttads.vn/crm/csd/chat?shell=native`. Sign-in is the chat username and chat password. This is not PTT Portal (`vn.pttads.portal`).

## Generate the native projects

```bash
cd services/ptt-app
npm install
npx cap add ios
npx cap add android
npm run cap:sync
```

After `cap add`:

- iOS deployment target 16.0. Portrait only.
- Android `minSdkVersion` 26. `android:screenOrientation="portrait"`.
- iOS usage strings: microphone, camera, photo library (Vietnamese, already set when the native projects are generated from this repo).
- Android permissions: `RECORD_AUDIO`, `CAMERA`, `POST_NOTIFICATIONS`.

Do not commit `node_modules` or signing keys.

Push stays off until the server has `PTT_FCM_SERVER_KEY` and `PTT_APNS_KEY_ID`, `PTT_APNS_TEAM_ID`, `PTT_APNS_AUTH_KEY`. Empty keys skip the send. The message is still saved.

Store submission needs an Apple Developer account, a Play Console app, a public privacy policy URL, and a demo chat account. This repository does not submit the listing.
