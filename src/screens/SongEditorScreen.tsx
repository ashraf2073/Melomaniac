import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminHeader } from '../components/admin/AdminHeader';
import { PrimaryButton } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';
import {
  MAX_UPLOAD_BYTES,
  deleteTrack,
  detectDurationSeconds,
  updateTrack,
  uploadTrack,
  type PickedFile,
  type SongFields,
} from '../services/admin';
import { useUIStore } from '../store/useUIStore';
import { accent, colors, radius } from '../theme/tokens';
import { describeError } from '../utils/errors';
import { formatTime, parseLength } from '../utils/format';
import { notify } from '../utils/notify';

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** "03_Neon_Drift.mp3" -> "03 Neon Drift" */
const titleFromFileName = (name: string) =>
  name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_+/g, ' ').trim();

/** Add a new song (upload the files) or edit the details of an existing one. */
export function SongEditorScreen({ navigation, route }: RootScreenProps<'SongEditor'>) {
  const insets = useSafeAreaInsets();
  const existing = route.params?.track ?? null;
  const editing = existing !== null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [artist, setArtist] = useState(existing?.artist ?? '');
  const [album, setAlbum] = useState(existing?.album ?? '');
  const [genre, setGenre] = useState(existing?.genre ?? '');
  const [length, setLength] = useState(existing && existing.durationSec > 0 ? formatTime(existing.durationSec) : '');
  const [lyrics, setLyrics] = useState(existing?.lyrics ?? '');
  const [audio, setAudio] = useState<PickedFile | null>(null);
  const [cover, setCover] = useState<PickedFile | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The floating mini-player would sit on top of the form and ride above the keyboard.
  const setHidePlayer = useUIStore((s) => s.setHidePlayer);
  useEffect(() => {
    setHidePlayer(true);
    return () => setHidePlayer(false);
  }, [setHidePlayer]);

  const pick = async (type: string): Promise<PickedFile | null> => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: true, multiple: false });
      if (result.canceled || result.assets.length === 0) return null;
      const asset = result.assets[0];
      const file: PickedFile = {
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? null,
        mimeType: asset.mimeType ?? null,
      };
      if (file.size !== null && file.size > MAX_UPLOAD_BYTES) {
        setError(`${file.name} is ${megabytes(file.size)}. The limit is ${megabytes(MAX_UPLOAD_BYTES)}.`);
        return null;
      }
      return file;
    } catch (e) {
      setError(describeError(e, 'Could not open that file.'));
      return null;
    }
  };

  const chooseAudio = async () => {
    const file = await pick('audio/*');
    if (!file) return;
    setAudio(file);
    if (!title.trim()) setTitle(titleFromFileName(file.name));
    setDetecting(true);
    const seconds = await detectDurationSeconds(file.uri);
    setDetecting(false);
    if (seconds > 0) setLength(formatTime(seconds));
  };

  const chooseCover = async () => {
    const file = await pick('image/*');
    if (file) setCover(file);
  };

  const collect = (): SongFields | null => {
    if (!title.trim()) return fail('Add a title.');
    if (!artist.trim()) return fail('Add an artist.');
    if (!editing && !audio) return fail('Choose the audio file first.');
    const seconds = parseLength(length);
    if (length.trim() && seconds === null) return fail('Length should look like 3:25.');
    return { title, artist, album, genre, lyrics, durationSec: seconds ?? 0 };
  };
  const fail = (message: string): null => {
    setError(message);
    return null;
  };

  const save = async () => {
    const fields = collect();
    if (!fields) return;
    setBusy(true);
    setError(null);
    try {
      if (existing) {
        setStep('Saving...');
        await updateTrack(existing.id, fields);
      } else if (audio) {
        await uploadTrack(fields, audio, cover, setStep);
      }
      notify(editing ? 'Saved' : 'Song added');
      navigation.goBack();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
      setStep(null);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Delete this song?',
      `"${existing.title}" will be removed for everyone, including from playlists and liked songs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await deleteTrack(existing);
              notify('Song deleted');
              navigation.goBack();
            } catch (e) {
              setError(describeError(e));
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AdminHeader title={editing ? 'Edit song' : 'Add song'} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <Text style={styles.note}>
            The audio and cover cannot be replaced here. To change them, delete the song and add it again.
          </Text>
        ) : (
          <>
            <FilePicker
              icon="musical-note"
              label="Audio file"
              placeholder="MP3, M4A, WAV or FLAC, max 50 MB"
              file={audio}
              busy={detecting}
              onPress={() => void chooseAudio()}
              onClear={() => setAudio(null)}
            />
            <FilePicker
              icon="image"
              label="Cover image (optional)"
              placeholder="Choose a square JPG or PNG"
              file={cover}
              onPress={() => void chooseCover()}
              onClear={() => setCover(null)}
            />
          </>
        )}

        <Field label="Title" value={title} onChangeText={setTitle} editable={!busy} placeholder="Song title" />
        <Field label="Artist" value={artist} onChangeText={setArtist} editable={!busy} placeholder="Artist name" />
        <Field label="Album (optional)" value={album} onChangeText={setAlbum} editable={!busy} />
        <Field label="Genre (optional)" value={genre} onChangeText={setGenre} editable={!busy} placeholder="Pop, Afro-fusion, Chill..." />
        <Field
          label="Length (optional)"
          value={length}
          onChangeText={setLength}
          editable={!busy}
          placeholder="3:25"
          keyboardType="numbers-and-punctuation"
          hint={detecting ? 'Reading the length from the file...' : 'Filled in from the file when it can be read.'}
        />
        <Field
          label="Lyrics (optional)"
          value={lyrics}
          onChangeText={setLyrics}
          editable={!busy}
          multiline
          placeholder="Plain text, or timed lines like [01:23.45]words"
          hint="Only add lyrics you wrote or have permission to use."
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={editing ? 'Save changes' : 'Upload and add'}
          icon={editing ? 'checkmark' : 'cloud-upload'}
          onPress={() => void save()}
          loading={busy}
          disabled={detecting}
        />
        {step ? <Text style={styles.step}>{step}</Text> : null}

        {editing ? (
          <Pressable
            onPress={confirmDelete}
            disabled={busy}
            style={({ pressed }) => [styles.danger, (busy || pressed) && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={styles.dangerText}>Delete song</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, style, ...input }: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, input.multiline && styles.multiline, style]}
        {...input}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function FilePicker({
  icon,
  label,
  placeholder,
  file,
  busy,
  onPress,
  onClear,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  placeholder: string;
  file: PickedFile | null;
  busy?: boolean;
  onPress: () => void;
  onClear: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.picker} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={24} color={accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.pickerTitle}>{label}</Text>
        <Text style={styles.pickerSub} numberOfLines={1}>
          {file ? `${file.name}${file.size !== null ? ` · ${megabytes(file.size)}` : ''}` : placeholder}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={accent} />
      ) : file ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel={`Remove ${label}`}>
          <Ionicons name="close-circle" size={22} color={colors.textMuted} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
  },
  pickerTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pickerSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  field: { gap: 6 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  multiline: { minHeight: 150, textAlignVertical: 'top' },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 17 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  step: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    marginTop: 10,
  },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
