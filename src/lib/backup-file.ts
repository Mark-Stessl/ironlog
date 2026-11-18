// Native app: the backup is written to a temporary file and handed to the share
// sheet (Save to Files, AirDrop, mail...). Restoring opens the document picker.
import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/** Resolves true when the file was handed over, false if the person cancelled. */
export async function saveBackupFile(name: string, json: string): Promise<boolean> {
  const uri = `${cacheDirectory}${name}`;
  await writeAsStringAsync(uri, json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your Ironlog backup',
    UTI: 'public.json',
  });
  return true;
}

/** The chosen file's text, or null if the person cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  return readAsStringAsync(res.assets[0].uri);
}
