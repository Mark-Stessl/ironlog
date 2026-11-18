import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { choose } from '@/lib/dialog';

/**
 * Lets you take or pick a photo, crops it to 4:3, shrinks it to at most 800 px wide
 * and returns it as a JPEG data URI. Photos stay on the phone (in the app's database).
 * Returns null when cancelled or when permission was denied.
 */
export async function pickPhoto(): Promise<string | null> {
  let source: 'camera' | 'library' = 'library';
  // In the browser the file picker already offers "Take photo" on phones.
  if (Platform.OS !== 'web') {
    const answer = await choose({
      title: 'Add a photo',
      cancelLabel: 'Cancel',
      icon: 'camera-outline',
      choices: [
        { label: 'Take photo', value: 'camera', icon: 'camera-outline', primary: true },
        { label: 'Choose from library', value: 'library', icon: 'images-outline' },
      ],
    });
    if (answer !== 'camera' && answer !== 'library') return null;
    source = answer;
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.9,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if ((asset.width ?? 0) > 800) ctx.resize({ width: 800 });
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ compress: 0.72, format: SaveFormat.JPEG, base64: true });
    return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
  } catch {
    return null;
  }
}
