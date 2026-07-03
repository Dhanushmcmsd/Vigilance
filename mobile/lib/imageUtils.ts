import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

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
    return uri;
  }
}

// ============================================================
// RED-ITEM PHOTO CAPTURE
// ============================================================

const RED_MAX_PHOTOS_PER_ITEM = 3;
const RED_MAX_BYTES = 800 * 1024;
const RED_INITIAL_WIDTH = 1280;

export interface RedPhotoMetadata {
  gps: { lat: number | null; lng: number | null };
  timestamp: string;
  verifier_id: string;
  item_id: string;
  inspection_id: string;
  accuracy_m?: number | null;
}

export interface RedPhotoResult {
  uri: string;
  metadata: RedPhotoMetadata;
}

/**
 * Launches the in-app camera (NOT the gallery) for RED-risk items.
 * Compresses the captured photo iteratively until it fits under
 * RED_MAX_BYTES, embeds GPS + verifier metadata, and returns the
 * local URI + metadata object.
 *
 * Throws when:
 *  - camera permission is denied
 *  - currentCount >= RED_MAX_PHOTOS_PER_ITEM
 *  - the user cancels (returns null instead of throwing)
 */
export async function captureRedItemPhoto(
  inspectionId: string,
  itemId: string,
  officerId: string,
  currentCount = 0
): Promise<RedPhotoResult | null> {
  if (currentCount >= RED_MAX_PHOTOS_PER_ITEM) {
    throw new Error(
      `Maximum ${RED_MAX_PHOTOS_PER_ITEM} photos allowed per RED-risk item.`
    );
  }

  // Permissions — camera is mandatory; we still try to enrich metadata with GPS
  // but a missing location permission must NOT block the capture.
  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!camPerm.granted) {
    throw new Error('Camera permission denied. Enable it in Settings to capture RED evidence.');
  }

  let locCoords: { lat: number | null; lng: number | null; accuracy: number | null } = {
    lat: null,
    lng: null,
    accuracy: null,
  };
  try {
    const locPerm = await Location.getForegroundPermissionsAsync();
    if (locPerm.granted) {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      locCoords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      };
    }
  } catch {
    // GPS failure should never prevent a RED capture.
  }

  // launchCameraAsync — NOT launchImageLibraryAsync; gallery selection is
  // explicitly blocked for RED evidence to preserve chain of custody.
  const shot = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
    exif: true,
    cameraType: ImagePicker.CameraType.back,
  });
  if (shot.canceled || !shot.assets?.[0]) return null;

  const sourceUri = shot.assets[0].uri;
  const compressedUri = await compressUnderMaxBytes(sourceUri, RED_MAX_BYTES);

  const metadata: RedPhotoMetadata = {
    gps: { lat: locCoords.lat, lng: locCoords.lng },
    timestamp: new Date().toISOString(),
    verifier_id: officerId,
    item_id: itemId,
    inspection_id: inspectionId,
    accuracy_m: locCoords.accuracy,
  };

  return { uri: compressedUri, metadata };
}

/**
 * Resize + compress iteratively until the JPEG is under maxBytes.
 * Falls back to the most-compressed version if we can't go below the cap.
 */
async function compressUnderMaxBytes(uri: string, maxBytes: number): Promise<string> {
  let currentUri = uri;
  let width = RED_INITIAL_WIDTH;
  let quality = 0.85;

  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await ImageManipulator.manipulateAsync(
      currentUri,
      [{ resize: { width } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    currentUri = result.uri;
    const size = await getFileSize(currentUri);
    if (size == null || size <= maxBytes) return currentUri;

    // Halve quality first, then drop width — keeps photos readable for as long
    // as possible before sacrificing resolution.
    if (quality > 0.4) {
      quality = Math.max(0.4, quality - 0.15);
    } else {
      width = Math.max(640, Math.floor(width * 0.8));
    }
  }
  return currentUri;
}

async function getFileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && typeof (info as any).size === 'number') {
      return (info as any).size as number;
    }
    return null;
  } catch {
    return null;
  }
}
