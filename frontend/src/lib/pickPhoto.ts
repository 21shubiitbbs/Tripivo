import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from './api';

/**
 * Lets the user pick a square photo from their library and uploads it.
 * Resolves with the uploaded image's URL, or null if they cancelled.
 */
export async function pickAndUploadSquarePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.base64) throw new Error('Could not read that photo. Try another one.');
  return uploadImage(asset.base64, asset.mimeType ?? 'image/jpeg');
}
