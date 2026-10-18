-- =====================================================================
-- Melomaniac — optional starter data so the app has something to play.
-- Run AFTER schema.sql. These rows point at SoundHelix's free demo MP3s
-- (https://www.soundhelix.com) purely as placeholder test audio.
-- Replace with your own uploads: Storage → audio bucket → upload, then set
-- audio_path to the file name, e.g. 'my-song.mp3' (and cover_path likewise
-- for images in the covers bucket). Only upload music you own or are licensed to use.
-- duration_seconds below is approximate; the player uses the real duration once a file loads.
-- If a placeholder URL ever stops working, swap in any direct .mp3 link or your own upload.
-- =====================================================================

insert into public.tracks (title, artist, album, genre, duration_seconds, audio_path, lyrics)
values
  ('Neon Drift', 'SoundHelix', 'Demo Reel', 'Electronic', 372,
   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
   E'[00:00.00]♪ Instrumental intro\n[00:12.00]Lights stretch long across the glass\n[00:20.00]Every mile a little faster\n[00:28.00]Hold the line and let it pass\n[00:36.00]Nothing here can slow us after'),
  ('Paper Planets', 'SoundHelix', 'Demo Reel', 'Ambient', 425,
   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
   E'Slow tides in a quiet room\nNothing left to prove\nLet the evening carry you'),
  ('Afterglow Avenue', 'SoundHelix', 'Demo Reel', 'Pop', 344,
   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
   null),
  ('Static Bloom', 'SoundHelix', 'Demo Reel 2', 'Electronic', 303,
   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', null),
  ('Midnight Parade', 'SoundHelix', 'Demo Reel 2', 'Rock', 330,
   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', null),
  ('Golden Hour Loop', 'SoundHelix', 'Demo Reel 2', 'Chill', 372,
   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', null);
