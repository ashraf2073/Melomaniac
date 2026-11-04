#!/usr/bin/env bash
# Checks the two Supabase values the app is built with, the way the phone will use them.
# Prints OK / WARN / FAIL lines and never prints the key.
# Exits 1 only for problems that would stop the APK from signing anyone in.
#
# Reads SUPABASE_URL and SUPABASE_KEY from the environment.

set -u

RAW_URL="${SUPABASE_URL:-}"
RAW_KEY="${SUPABASE_KEY:-}"
failed=0
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

say() {
  echo "$1"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "- $1" >> "$GITHUB_STEP_SUMMARY"; fi
}
ok() { say "OK    $1"; }
warn() { say "WARN  $1"; echo "::warning::$1"; }
bad() { say "FAIL  $1"; echo "::error::$1"; failed=1; }
finish() {
  if [ "$failed" -eq 0 ]; then
    say "Result: the address and key look right."
  else
    say "Result: fix the FAIL lines above, then run this again."
  fi
  exit "$failed"
}

# Values pasted from a phone often carry a space, a quote or a line break.
clean() { printf '%s' "$1" | tr -d '\r\n' | sed -e "s/^[[:space:]\"']*//" -e "s/[[:space:]\"']*\$//"; }
URL="$(clean "$RAW_URL")"
KEY="$(clean "$RAW_KEY")"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  bad "Both secrets are needed: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
  finish
fi
if [ "$URL" != "$RAW_URL" ]; then
  bad "The URL secret has a space, quote or line break around it. Paste it again with nothing around it."
fi
if [ "$KEY" != "$RAW_KEY" ]; then
  bad "The key secret has a space, quote or line break around it. Paste it again with nothing around it."
fi

# ---- the address -------------------------------------------------------------------------
case "$URL" in
  https://*) ;;
  *)
    bad "The URL must start with https://"
    finish
    ;;
esac
HOST="${URL#https://}"
HOST="${HOST%%/*}"
EXTRA="${URL#https://"$HOST"}"
if [ -n "$EXTRA" ] && [ "$EXTRA" != "/" ]; then
  bad "The URL has extra text after the address ($EXTRA). Use only https://<project>.supabase.co with nothing after it."
fi

REF="${HOST%%.*}"
case "$HOST" in
  *.supabase.co)
    if printf '%s' "$REF" | grep -Eq '^[a-z]{20}$'; then
      ok "The project reference has the usual shape (20 lowercase letters)."
    else
      warn "A project reference is normally 20 lowercase letters; this one has ${#REF} characters. Compare it with the dashboard letter by letter."
    fi
    ;;
  *)
    warn "The address does not end in .supabase.co. That is fine for a custom domain, otherwise check it."
    ;;
esac

if getent hosts "$HOST" > /dev/null 2>&1; then
  ok "The address $HOST exists on the internet."
else
  bad "The address $HOST does not exist (the lookup failed), which is the error the phone showed. In the Supabase dashboard: if the project says Paused, restore it; otherwise the URL secret has a typo."
  finish
fi

code="$(curl -sS --max-time 25 -o "$work/health" -w '%{http_code}' -H "apikey: $KEY" "$URL/auth/v1/health" 2> "$work/err")" || code="000"
case "$code" in
  200) ok "The project's sign-in service answers (HTTP 200)." ;;
  401 | 403) bad "The project answered but refused the key (HTTP $code). The key is from another project or was copied wrongly." ;;
  000) bad "No answer from $HOST: $(head -c 200 "$work/err")" ;;
  *) bad "The project did not answer properly (HTTP $code): $(head -c 200 "$work/health"). A paused project looks like this; restore it in the dashboard." ;;
esac

# ---- the key -----------------------------------------------------------------------------
case "$KEY" in
  sb_publishable_*)
    ok "The key is a publishable key, which is the right kind."
    ;;
  sb_secret_*)
    bad "This is a SECRET key. It must never be inside an app. Use the publishable key, and rotate the secret key in the dashboard."
    ;;
  eyJ*)
    claims="$(python3 - "$KEY" 2> /dev/null << 'PY'
import base64, json, sys
part = sys.argv[1].split(".")[1]
part += "=" * (-len(part) % 4)
data = json.loads(base64.urlsafe_b64decode(part))
print(data.get("role", "?"), data.get("ref", "?"))
PY
)" || claims=""
    if [ -z "$claims" ]; then
      warn "The key looks like an older-style key but could not be read."
    else
      role="${claims%% *}"
      kref="${claims##* }"
      if [ "$role" = "service_role" ]; then
        bad "This is the service_role (secret) key. It must never be inside an app. Use the anon or publishable key, and rotate the service_role key in the dashboard."
      elif [ "$role" = "anon" ]; then
        ok "The key is an anon key, which is the right kind."
      else
        warn "The key has the role '$role'; the app expects the anon or publishable key."
      fi
      if [ "$kref" != "?" ] && [ "$kref" != "$REF" ]; then
        bad "The key belongs to project $kref but the URL is project $REF. They must come from the same project."
      fi
    fi
    ;;
  *)
    warn "The key has an unusual shape. Copy the publishable key from the dashboard (Project Settings, API Keys)."
    ;;
esac

# ---- the database and storage -------------------------------------------------------------
tcode="$(curl -sS --max-time 25 -o "$work/tracks" -w '%{http_code}' -H "apikey: $KEY" "$URL/rest/v1/tracks?select=id&limit=1" 2> /dev/null)" || tcode="000"
case "$tcode" in
  200 | 401 | 403) ok "The tracks table exists." ;;
  404) warn "The tracks table is missing. Run supabase/schema.sql in the Supabase SQL Editor." ;;
  *) warn "Could not check the tables (HTTP $tcode)." ;;
esac

for bucket in audio covers; do
  bcode="$(curl -s --max-time 25 -o "$work/bucket" -w '%{http_code}' "$URL/storage/v1/object/public/$bucket/.probe" 2> /dev/null)" || bcode="000"
  if [ "$bcode" = "000" ]; then
    warn "Could not check the storage bucket '$bucket'."
  elif grep -qi "bucket not found" "$work/bucket" 2> /dev/null; then
    warn "The storage bucket '$bucket' is missing. Run supabase/schema.sql in the Supabase SQL Editor."
  else
    ok "The storage bucket '$bucket' exists."
  fi
done

finish
