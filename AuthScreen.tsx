import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { accent, colors, radius } from '../theme/tokens';

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const canSubmit = email.includes('@') && password.length >= 6;

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    if (mode === 'signin') {
      const error = await signIn(email, password);
      if (error) setMessage({ text: error, error: true });
    } else {
      const result = await signUp(email, password);
      if (result.error) setMessage({ text: result.error, error: true });
      else if (result.needsConfirmation)
        setMessage({ text: 'Check your inbox and tap the confirmation link, then sign in.', error: false });
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>
          Melo<Text style={{ color: accent }}>maniac</Text>
        </Text>
        <Text style={styles.tagline}>Your music. Your stats. Your story.</Text>

        {!isSupabaseConfigured ? (
          <View style={styles.warn}>
            <Text style={styles.warnTitle}>Supabase isn't configured yet</Text>
            <Text style={styles.warnBody}>
              Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and
              EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the app.
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password (6+ characters)"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            textContentType={mode === 'signin' ? 'password' : 'newPassword'}
            onSubmitEditing={() => canSubmit && void submit()}
            style={styles.input}
          />
          {message ? (
            <Text style={[styles.message, { color: message.error ? colors.danger : accent }]}>{message.text}</Text>
          ) : null}
          <PrimaryButton
            label={mode === 'signin' ? 'Sign in' : 'Create account'}
            onPress={() => void submit()}
            disabled={!canSubmit || !isSupabaseConfigured}
            loading={busy}
          />
          <Pressable
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setMessage(null);
            }}
            hitSlop={10}
          >
            <Text style={styles.switch}>
              {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  content: { paddingHorizontal: 24, gap: 8 },
  logo: { color: colors.text, fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.textMuted, fontSize: 16, marginBottom: 28 },
  form: { gap: 14 },
  input: {
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  message: { fontSize: 14, lineHeight: 20 },
  switch: { color: colors.textMuted, textAlign: 'center', fontSize: 14, marginTop: 6 },
  warn: {
    backgroundColor: 'rgba(255,84,112,0.12)',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,84,112,0.4)',
  },
  warnTitle: { color: colors.danger, fontWeight: '700', marginBottom: 4 },
  warnBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
