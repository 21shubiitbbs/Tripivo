import * as ImagePicker from 'expo-image-picker';

/** Lets the user pick a square photo from their library. Resolves with its URI, or null. */
export async function pickSquarePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
