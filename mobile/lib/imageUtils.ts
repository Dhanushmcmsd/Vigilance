import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compress an image to max 1200px wide, JPEG, quality 0.75.
 * Returns the local URI of the compressed file.
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    // If compression fails, return original
    return uri;
  }
}
