# PRAWIN Live

PRAWIN Live is a React live video app with Firebase authentication, Firestore room discovery/chat/signaling, and browser WebRTC audio/video.

## Run locally

Install dependencies:

```powershell
python -m pip install -r requirements.txt
npm install
```

Start the API in one terminal:

```powershell
python backend\manage.py runserver
```

Start React in another:

```powershell
npm run dev
```

Open `http://localhost:5173`.

## GitHub Pages deployment

This deploys the browser client only. In the new GitHub repository, add the six `VITE_FIREBASE_*` values as Actions secrets, then set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**. Push to `main` or `master`; `.github/workflows/deploy-pages.yml` builds and deploys the site. Add the published Pages hostname to Firebase Authentication's authorized domains. Django/MySQL is not deployed by Pages; browser live rooms use Firebase and WebRTC.

## Live video setup

1. Configure the six `VITE_FIREBASE_*` values in `.env.local`, enable Email/Password sign-in, and create a Firestore database in the same Firebase project.
2. Publish the rules in `firestore.rules` from Firebase Console > Firestore Database > Rules. Hosts and viewers must sign in; unauthenticated visitors can browse room titles but cannot receive video or chat.
3. Sign in on the host device, choose **Go live**, allow camera/microphone access, enter a title, and start the broadcast. Viewers sign in, select that live room, and tap **Enable sound**.

Video uses direct WebRTC connections signaled through Firestore, with a public STUN server for connection setup. This is a small-room implementation: each viewer adds another peer connection and uses host upload bandwidth. Some mobile carriers, corporate networks, and restrictive NATs require a TURN relay; production deployments should configure a private TURN service and use HTTPS. Firestore is the real-time signaling/chat service; MySQL is not in the media path.

The Django backend reads MySQL connection settings from `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT`. In PowerShell, set them before starting Django:

```powershell
$env:DB_NAME = "prawin47"
$env:DB_USER = "root"
$securePassword = Read-Host "MySQL password" -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
$env:DB_HOST = "localhost"
$env:DB_PORT = "3306"
python backend\manage.py runserver
```

## Android app

The React client can be installed from Chrome as a PWA or packaged as an Android app with Capacitor. Install Android Studio with the Android SDK and a supported JDK, then run:

```powershell
npm install
npx cap add android
npm run android:sync
npm run android:open
```

In Android Studio, build and run the `android` project on a device or emulator. Set the Firebase `VITE_FIREBASE_*` values before running `npm run android:sync`; they are embedded in the client bundle. The media connection uses Firestore and WebRTC, so the Django API and MySQL database are not required for PRAWIN-to-PRAWIN live rooms.

For a phone screen broadcast, open the screen-share button, choose YouTube landscape, YouTube vertical live, or Instagram Live Producer, then enter the RTMP server URL and stream key supplied by that platform. YouTube Live must be enabled for the account. Vertical YouTube live may be surfaced in the Shorts feed when the channel and stream are eligible; the encoder does not create a saved Shorts video. Instagram RTMP is available only when Live Producer is enabled for the account. Screen and device-audio capture require Android's consent prompt; internal device audio requires Android 10 or newer, while microphone audio can be selected separately. The key is not persisted by this app. Each broadcast targets one RTMP destination; streaming to YouTube and Instagram simultaneously requires a multistream relay.

## Firebase authentication

1. In Firebase Console, create a Web app under **Project settings > Your apps**.
2. Under **Authentication > Sign-in method**, enable Email/Password and Google. Add `http://localhost:5173` to **Authentication > Settings > Authorized domains**.
3. Copy `.env.example` to `.env.local` and fill in the six `VITE_FIREBASE_*` values from the Firebase Web app config. These values are intended for the browser and are not service-account secrets.
4. Create a Firebase service account under **Project settings > Service accounts > Generate new private key**. Store the downloaded JSON outside the repository and set `FIREBASE_SERVICE_ACCOUNT_FILE` to its path, or set `FIREBASE_SERVICE_ACCOUNT_JSON` to the JSON string. Never commit either value.
5. Deploy the Firestore rules above before using live rooms.

The React client persists sessions locally, supports email sign-in, account creation, Google sign-in, password reset, and sign-out. The Django admin command below remains available for other protected API operations; live streaming itself uses Firebase Auth and Firestore rules.

```powershell
python backend\manage.py set_firebase_admin <firebase-uid>
```

The command requires the same Admin SDK credentials and sets `{ "admin": true }`. Removing the claim requires running the command with `--revoke`; users must refresh their ID token after a claim change. The protected API accepts `Authorization: Bearer <firebase-id-token>` and `GET /api/auth/me/` returns the verified profile and admin status.
