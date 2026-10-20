# Melomaniac: setup guide

## Start here: fresh start in VS Code

You'll install the real app on your phone first (a *development build*), then VS Code shows a QR code that connects the app to your code. This avoids Expo Go, whose Play Store version often lags behind new Expo SDKs.

**You need:** Node.js 22 or newer (`node -v`), a free [Expo](https://expo.dev) account, your Supabase project (already set up, see Part B if not), and an Android phone.

### 1. Get a clean folder

1. Delete any old Melomaniac folders so nothing gets mixed together.
2. Right-click `melomaniac.zip` → **Extract All** into a *new empty folder*. The zip contains one folder called `melomaniac`.
3. Open that `melomaniac` folder. **You must see `package.json`, `App.tsx`, `app.json` and the folders `src`, `assets`, `supabase` directly inside it.** If you see another `melomaniac` folder inside, open that one instead.

### 2. Open it in VS Code

**File → Open Folder…** → choose the folder from step 1.3 (the one that directly contains `package.json`). The Explorer's top level should look like this, and `src` holding the folders `components, hooks, lib, navigation, screens, services, store, theme, types, utils` plus one small file, `env.d.ts`. Nothing else (no `app.json`, no images) should be inside `src`:

```
assets/   src/   supabase/   .vscode/   App.tsx   app.json   eas.json   index.ts   package.json   SETUP.md …
```

If VS Code offers to install the recommended **Expo Tools** extension, accept.

### 3. Install and add your Supabase keys

Open the terminal: **Terminal → New Terminal**.

```bash
npm install
npm run typecheck
```

`typecheck` should print nothing. Then create your `.env` file (Windows: `copy .env.example .env`; Mac/Linux: `cp .env.example .env`) and fill in the two values from Supabase → *Project Settings → API*: the **Project URL** and the **publishable (anon) key**. Never use the `service_role` / secret key.

### 4. Install the app on your phone

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build -p android --profile development
```

- First time it asks to create an Android keystore: answer **yes**.
- The build runs in the cloud (usually 10 to 20 minutes). When it finishes, the terminal shows a link and a **QR code**.
- **Scan that QR code with your phone's camera**, download the `.apk`, and install it. Android will ask you to allow *Install unknown apps* for your browser or camera app.
- You don't need `eas env:set` for this build: the app's JavaScript comes from your computer and reads your local `.env`.

### 5. Run the app

Back in the VS Code terminal:

```bash
npx expo start --dev-client
```

A QR code appears. On the phone, open the **Melomaniac** app you just installed and scan it (or tap your computer in the server list it shows). The app loads, and every time you save a file it updates live.

- Phone and computer must be on the **same Wi-Fi**. If they can't connect (guest Wi-Fi, firewall), use `npx expo start --dev-client --tunnel` instead.
- On Windows, allow Node.js through the firewall on *Private networks* if prompted.

### 6. Check it works

1. Sign up, then play a track. A media notification should appear.
2. Lock the screen and wait a few minutes. Audio should keep playing, and the lock screen should show title, artwork, play/pause, next and previous. **Please confirm next and previous skip tracks.**
3. Try Bluetooth headphones or a car stereo.
4. Play a song past 30 seconds and look in Supabase *SQL Editor*:
   ```sql
   select * from public.listen_history order by listened_at desc limit 5;
   ```
5. Open the **Stats** tab for the Weekly Rewind, and tap *Melomaniac Unwrapped* for the story.

---

## Part B: Supabase setup (skip if already done)

1. **Create a project** at supabase.com → *New project*.
2. **Tables:** *SQL Editor → New query* → paste all of `supabase/schema.sql` → *Run*. It creates `users`, `tracks`, `listen_history`, `playlists` (plus `playlist_tracks`, `liked_tracks`), Row Level Security, the `audio` and `covers` storage buckets, and the stats functions. Safe to run twice.
3. **Music:** paste `supabase/seed.sql` → *Run* for six placeholder tracks, or add your own: upload an `.mp3` to *Storage → audio* (artwork to *covers*), then
   ```sql
   insert into public.tracks (title, artist, album, genre, duration_seconds, audio_path, cover_path)
   values ('My Song', 'My Band', 'Debut', 'Rock', 215, 'my-song.mp3', 'my-song.jpg');
   ```
4. **Email confirmation:** *Authentication → Sign In / Providers → Email* → turn off *Confirm email* while testing.

## Part C: A standalone APK (no computer needed to run it)

The development build above needs your computer's dev server to load the app. For an APK that runs on its own, give EAS your two public values and build the `preview` profile:

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL      --value https://YOUR-REF.supabase.co --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-PUBLISHABLE-KEY        --environment preview --visibility plaintext
npx eas-cli@latest build -p android --profile preview
```

| Profile | Output | Use it for |
|---|---|---|
| `development` | `.apk` with dev client | Day-to-day work (steps 4 and 5 above) |
| `preview` | `.apk`, standalone | Installing on your phone and sharing with testers |
| `production-apk` | `.apk`, release-signed | Handing out directly |
| `production` | `.aab` | Uploading to Google Play |

Before releasing, change `android.package` and `ios.bundleIdentifier` in `app.json` from `com.melomaniac.app` to an id you own.

### Building from GitHub instead (optional)

The repo has a workflow, `.github/workflows/apk.yml`. Run it from the repo's **Actions** tab → *Build Android APK* → *Run workflow*. It runs the same `preview` build as above. It needs two things first:

1. A repository secret named `EXPO_TOKEN` (create the token at expo.dev → *Account settings* → *Access tokens*; add it under the repo's *Settings → Secrets and variables → Actions*).
2. The project linked to EAS: run `npx eas-cli@latest init` once on your computer, then commit and push the change it makes to `app.json`.

EAS cloud builds read your Supabase values from EAS itself (per Expo's docs), so set them with the two `env:set` commands above. The `env:` lines in the workflow file are not what the build uses.

---

## How the pieces fit

```
melomaniac/
├── App.tsx                    Providers, auth gate, mounts navigator + floating player
├── index.ts                   Expo entry point
├── app.json                   Name, icons, Android package, expo-audio background plugin
├── eas.json                   Build profiles (APK / AAB)
├── .env.example               Supabase URL + publishable key
├── .vscode/                   Makes VS Code use the project's own TypeScript
├── supabase/
│   ├── schema.sql             Tables, RLS policies, storage buckets, stats functions
│   └── seed.sql               Six placeholder tracks
└── src/
    ├── navigation/            RootNavigator (stack) → TabNavigator (tabs) + GlassTabBar
    ├── screens/               Home, Search, Library, TrackList, Stats, Unwrapped, Auth
    ├── components/
    │   ├── player/            PlayerSheet (mini bar ⇄ full screen) and FullPlayer
    │   ├── stats/             Story slides and the count-up number
    │   └── …                  TrackRow, Scrubber, CoverArt, GlassView, TrackMenu, ui
    ├── store/                 usePlayerStore (queue + playback), library, auth, ui
    ├── services/
    │   ├── audioEngine.ts     Wraps expo-audio's native playlist + lock-screen metadata
    │   ├── listenLogger.ts    The 30-second listen tracker + offline queue
    │   ├── catalog.ts         Supabase queries for tracks, likes, playlists
    │   └── stats.ts           Calls the weekly_rewind / yearly_unwrapped functions
    ├── theme/tokens.ts        Colours and sizes (change the accent here)
    └── utils/                 Formatting, lyrics (plain or LRC) parsing, personality rules
```

**Why `expo-audio` and not `react-native-track-player`?** `expo-av` was removed in Expo SDK 55. React Native Track Player v5 is a commercially licensed rewrite (v4 is frozen). `expo-audio` covers background playback, lock-screen/notification controls, queues and Bluetooth, and works without custom native code. All playback goes through `src/services/audioEngine.ts`, so swapping libraries later touches one file.

**How a listen is counted.** `listenLogger.ts` adds up *actual playing time*: scrubbing forward or sitting paused adds nothing. At 30 seconds it inserts one row into `listen_history`, and when the track ends or changes it updates that row with the final seconds. If the network is down, the listen is stored on the phone and uploaded next time the app opens.

**Stats.** All aggregation happens in Postgres, in your time zone, so "Sunday" and "peak day" match your local clock. The Weekly Rewind is always available (last 7 days); on Sundays the Home card becomes "Your Weekly Rewind is ready" and the Stats tab shows a *NEW TODAY* badge.

## Customising

- **Electric Blue instead of green:** in `src/theme/tokens.ts` change `export const accent` to `colors.accentAlt`. The chart colours in `StatsScreen.tsx` are separate; change `chartConfig` there too.
- **Personality rules for Unwrapped:** `src/utils/personality.ts`.
- **Icons and splash:** replace the files in `assets/` (simple equalizer-bar placeholders are in there now).

## Things to know

- **Not yet run on a physical device.** The project passes strict type-checking, bundles for Android, generates the right native manifest (media-playback service, notification permission, no microphone), and the SQL and listen logic were tested. The device check in step 6 is the final proof.
- **Android glass effect** is a translucent panel rather than a real blur (cheaper and consistent). iOS gets a native blur.
- **Music rights.** Streaming music you don't own or license isn't allowed. Use your own or properly licensed tracks. The seed rows point at public demo files only as placeholders.
- **Storage buckets are public** so audio URLs work directly. For protected content, make the bucket private and use signed URLs.
- **Not included yet:** a Sunday push notification (needs `expo-notifications`), offline downloads, and iOS builds (needs an Apple developer account).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Red squiggles on every `src/...` import in VS Code | You opened the wrong folder, or `npm install` hasn't finished. The folder open in VS Code must directly contain `package.json`. Then press `Ctrl+Shift+P` → *TypeScript: Restart TS Server*. |
| PowerShell says "running scripts is disabled" | Use **Command Prompt** (Terminal dropdown → Command Prompt), or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once and reopen the terminal. |
| Phone can't find the dev server | Same Wi-Fi? Allow Node.js in the firewall? Otherwise `npx expo start --dev-client --tunnel`. |
| "Supabase isn't configured" banner | `.env` missing or values wrong. After editing it, restart with `npx expo start --dev-client -c`. For a `preview` build, use the `env:set` commands in Part C and rebuild. |
| Sign-up says to check email | Turn off *Confirm email* (Part B step 4) or click the link in the email. |
| Home is empty | No rows in `tracks`. Run `seed.sql` or add your own. |
| A track won't play | Open its `audio_path` URL in a browser; it must be a direct audio file. |
| Audio stops after ~3 min in the background | Lock-screen controls must be active (the app turns them on when you press play). Make sure you're using the installed build. |
| `permission denied for function` | Re-run `schema.sql` as the project owner. |
