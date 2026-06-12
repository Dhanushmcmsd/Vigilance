import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_DURATION = 120;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoCapture({
  onVideoCaptured,
  onClose,
}: {
  onVideoCaptured: (uri: string, durationSeconds: number) => void;
  onClose: () => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRecording) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    void (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (!micPermission?.granted) await requestMicPermission();
    })();
  }, [cameraPermission?.granted, micPermission?.granted, requestCameraPermission, requestMicPermission]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current || !cameraRef.current) return;
    setBusy(true);
    clearTimer();
    recordingRef.current = false;
    try {
      cameraRef.current.stopRecording();
    } catch {
      setIsRecording(false);
      setBusy(false);
    }
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording || busy) return;
    if (!cameraPermission?.granted || !micPermission?.granted) {
      await requestCameraPermission();
      await requestMicPermission();
      return;
    }

    setElapsed(0);
    elapsedRef.current = 0;
    setIsRecording(true);
    recordingRef.current = true;
    setBusy(true);

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= MAX_DURATION) {
        void stopRecording();
      }
    }, 1000);

    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: MAX_DURATION });
      clearTimer();
      setIsRecording(false);
      recordingRef.current = false;
      if (result?.uri) {
        onVideoCaptured(result.uri, Math.max(1, elapsedRef.current || 1));
      }
    } catch {
      clearTimer();
      setIsRecording(false);
      recordingRef.current = false;
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    cameraPermission?.granted,
    clearTimer,
    isRecording,
    micPermission?.granted,
    onVideoCaptured,
    requestCameraPermission,
    requestMicPermission,
    stopRecording,
  ]);

  const permissionsReady = cameraPermission?.granted && micPermission?.granted;
  const permissionsDenied =
    (cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain) ||
    (micPermission && !micPermission.granted && !micPermission.canAskAgain);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permissionsReady ? (
          <View style={styles.permissionBox}>
            {permissionsDenied ? (
              <Text style={styles.permissionText}>
                Camera and microphone access are required to record inspection video.
              </Text>
            ) : (
              <>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.permissionText}>Requesting camera and microphone access…</Text>
              </>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={styles.camera} mode="video" facing="back" />
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              {isRecording && (
                <View style={styles.recBadge}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>REC {formatElapsed(elapsed)}</Text>
                </View>
              )}
            </View>

            {isRecording && (
              <View style={styles.recordingOverlay}>
                <Text style={styles.recordingLabel}>Recording…</Text>
                <TouchableOpacity onPress={() => void stopRecording()} style={styles.stopBtn}>
                  <View style={styles.stopInner} />
                </TouchableOpacity>
              </View>
            )}

            {!isRecording && (
              <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
                <TouchableOpacity
                  onPress={() => void startRecording()}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Animated.View style={[styles.recordOuter, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.recordInner} />
                  </Animated.View>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  permissionBox: {
    flex: 1,
    backgroundColor: '#1e3a5f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: { color: '#fff', fontSize: 15, textAlign: 'center', marginTop: 16 },
  closeBtn: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  closeBtnText: { color: '#fff', fontWeight: '700' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#dc2626' },
  recText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  recordingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 120,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  recordingLabel: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 20 },
  stopBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopInner: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#dc2626' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  recordOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#dc2626' },
});
