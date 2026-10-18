# Melomaniac: setup guide

From zero to an installable Android `.apk`. Budget about 30 to 45 minutes, most of it waiting on the cloud build.

**You need:** Node.js 22 LTS, a free [Expo](https://expo.dev) account, a free [Supabase](https://supabase.com) account, and an Android phone.

---

## 1. Install the project

```bash
cd melomaniac
npm install
cp .env.example .env        # you'll fill this in at step 2
npm run typecheck           # should print nothing
```

## 2. Set up Supabase (database, auth, storage)

1. **Create a project** at supabase.com → *New project*. Save the database password somewhere.
2. **Create the tables.** Dashboard → *SQL Editor* → *New query* → paste all of `supabase/schema.sql` → *Run*.
   It creates `users`, `tracks`, `listen_history`, `playlists` (plus `playlist_tracks` and `liked_tracks`), turns on Row Level Security so each user only sees their own data, creates the `audio` and `covers` storage buckets, and installs the three stats functions the app calls. It is safe to run twice.
3. **Add some music.** Paste `supabase/seed.sql` → *Run* for six placeholder tracks, or add your own:
   - *Storage → audio* → upload an `.mp3`; *Storage → covers* → upload artwork.
   - *SQL Editor*:
     ```sql
     insert into public.tracks (title, artist, album, genre, duration_seconds, audio_path, cover_path)
     values ('My Song', 'My Band', 'Debut', 'Rock', 215, 'my-song.mp3', 'my-song.jpg');
     ```
   `audio_path` / `cover_path` are the file names inside the buckets (or a full `https://` URL).
4. **Turn off email confirmation while testing.** *Authentication → Sign In / Providers → Email* → switch off *Confirm email*. Otherwise sign-up waits for a confirmation link.
5. **Copy your keys** into `.env`: *Project Settings → API* → *Project URL* and the **publishable (anon) key**. Never use the `service_role` / secret key; it would ship inside the app and bypass all security.

## 3. (Optional) Quick look on your phone

```bash
npx expo start
```

Scan the QR code with Expo Go. This is fine for checking screens. **Test background playback, lock-screen controls and Bluetooth in a real build (step 4)**, not in Expo Go.

## 4. Build the APK

```bash
npm install -g eas-cli          # or prefix every command below with: npx eas-cli@latest
eas login
eas init                        # links this folder to your Expo account (writes projectId into app.json)
```

Cloud builds don't read your local `.env`, so give EAS the two public values:

```bash
eas env:set --name EXPO_PUBLIC_SUPABASE_URL      --value https://YOUR-REF.supabase.co --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-PUBLISHABLE-KEY        --environment preview --visibility plaintext
```

Then build:

```bash
eas build -p android --profile preview
```

- First time it asks to create an Android keystore: answer **yes** and let EAS manage it.
- When it finishes (usually 10 to 20 minutes) you get a link and QR code. Open it on your phone, download the `.apk`, and install. Android will ask you to allow *Install unknown apps* for your browser.
- Or from a computer: `adb install path/to/app.apk`.

Build profiles in `eas.json`:

| Profile | Output | Use it for |
|---|---|---|
| `preview` | `.apk` | Installing on your phone and sharing with testers |
| `development` | `.apk` with dev client | Live reload while testing native features (`npx expo start --dev-client`). Needs the same `eas env:set` with `--environment development` |
| `production-apk` | `.apk` | A release-signed APK to hand out directly |
| `production` | `.aab` | Uploading to Google Play (Play requires AAB) |

Before releasing, change `android.package` (and `ios.bundleIdentifier`) in `app.json` from `com.melomaniac.app` to an id you own.

## 5. Check that it works on the device

1. Sign up, then play a track. A media notification should appear.
2. Lock the screen and wait a few minutes. Audio should keep playing, and the lock screen should show title, artwork, play/pause, next and previous.
3. Pair Bluetooth headphones or a car stereo and try play/pause and skip.
4. Let a song play past 30 seconds, then in Supabase run:
   ```sql
   select * from public.listen_history order by listened_at desc limit 5;
   ```
5. Open the **Stats** tab for the Weekly Rewind and tap *Melomaniac Unwrapped* for the story. The year view uses the current calendar year.

On Android 13 and later the app asks for notification permission the first time you press play. Without it, playback still works but the media notification is hidden.

---

## How the pieces fit

```
melomaniac/
├── App.tsx                    Providers, auth gate, mounts navigator + floating player
├── index.ts                   Expo entry point
├── app.json                   Name, icons, Android package, expo-audio background plugin
├── eas.json                   Build profiles (APK / AAB)
├── .env.example               Supabase URL + publishable key
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

**Why `expo-audio` and not `react-native-track-player`?** `expo-av` was removed in Expo SDK 55. React Native Track Player v5 is a commercially licensed rewrite (v4 is frozen). `expo-audio` now covers background playback, lock-screen/notification controls, queues and Bluetooth, and works in the managed workflow with no custom native code. All playback goes through `src/services/audioEngine.ts`, so swapping libraries later touches one file.

**How a listen is counted.** `listenLogger.ts` adds up *actual playing time*: scrubbing forward or sitting paused adds nothing. At 30 seconds it inserts one row into `listen_history`, and when the track ends or changes it updates that row with the final seconds. If the network is down, the listen is stored on the phone and uploaded next time the app opens.

**Stats.** All aggregation happens in Postgres, in your time zone, so "Sunday" and "peak day" match your local clock. The Weekly Rewind is always available (last 7 days); on Sundays the Home card becomes "Your Weekly Rewind is ready" and the Stats tab shows a *NEW TODAY* badge.

## Customising

- **Electric Blue instead of green:** in `src/theme/tokens.ts` change `export const accent` to `colors.accentAlt`. Also change the two hex values in `StatsScreen.tsx` / `chartConfig` if you want the charts to follow.
- **Personality rules for Unwrapped:** `src/utils/personality.ts`.
- **Icons and splash:** replace the files in `assets/` (simple equalizer-bar placeholders are in there now).

## Things to know

- **Not yet run on a physical device.** The project passes strict type-checking, bundles for Android, generates the correct native manifest (media-playback service, notification permission, no microphone), and the SQL and listen logic were tested, but the final proof is step 5 on your phone. In particular, confirm that the lock-screen **next / previous** buttons skip tracks.
- **Android glass effect** is a translucent panel rather than a real blur (cheaper and consistent). iOS gets a native blur.
- **Music rights.** Streaming music you don't own or license isn't allowed. Use your own tracks or properly licensed ones. The seed rows point at public demo files only as placeholders.
- **Storage buckets are public** so audio URLs work directly. That's fine for your own music; for protected content, make the bucket private and use signed URLs.
- **Not included yet:** a Sunday push notification (needs `expo-notifications`), offline downloads, and iOS builds (needs an Apple developer account).

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Supabase isn't configured" banner | `.env` missing or app not restarted (`npx expo start -c`). In a cloud build, set the `eas env:set` values above and rebuild. |
| Sign-up says to check email | Step 2.4: turn off *Confirm email*, or click the link in the email. |
| Home is empty | No rows in `tracks`. Run `seed.sql` or add your own. |
| A track won't play | Open its `audio_path` URL in a browser; it must be a direct audio file. |
| Audio stops after ~3 min in the background | Lock-screen controls must be active (the app does this when you press play). Make sure you installed a build, not Expo Go. |
| `permission denied for function` | Re-run `schema.sql` while signed in as the project owner. |
