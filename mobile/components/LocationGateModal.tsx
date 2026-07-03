import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LocationGateStatus } from '../lib/useLocationGate';

interface LocationGateModalProps {
  visible: boolean;
  status: LocationGateStatus;
  distanceMetres: number | null;
  branchName: string;
  branchLocation: string;
  radiusMetres: number;
  onConfirm: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

export function LocationGateModal({
  visible,
  status,
  distanceMetres,
  branchName,
  branchLocation,
  radiusMetres,
  onConfirm,
  onRetry,
  onCancel,
}: LocationGateModalProps) {
  const isLoading =
    status === 'fetching' || status === 'requesting_permission';

  const formatDistance = (metres: number | null): string => {
    if (metres === null) return '';
    if (metres >= 1000) return `${(metres / 1000).toFixed(1)}km`;
    return `${metres}m`;
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>
            {status === 'requesting_permission'
              ? 'Requesting location permission…'
              : 'Getting your GPS position…'}
          </Text>
        </View>
      );
    }

    if (status === 'within_range') {
      return (
        <View style={styles.stateContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
          </View>
          <Text style={[styles.statusTitle, { color: '#15803d' }]}>Within Range</Text>
          <Text style={styles.statusSubtitle}>
            You're {formatDistance(distanceMetres)} away — within the {radiusMetres}m limit
          </Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#16a34a' }]} onPress={onConfirm}>
            <Text style={styles.primaryButtonText}>Start Inspection</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'out_of_range') {
      return (
        <View style={styles.stateContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="close-circle" size={48} color="#dc2626" />
          </View>
          <Text style={[styles.statusTitle, { color: '#dc2626' }]}>Out of Range</Text>
          <Text style={styles.statusSubtitle}>
            You're {formatDistance(distanceMetres)} away — must be within {radiusMetres}m
          </Text>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={15} color="#6b7280" />
            <Text style={styles.addressText} numberOfLines={2}>
              {branchName} · {branchLocation}
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: '#dc2626' }]}
              onPress={onCancel}
            >
              <Text style={[styles.outlineButtonText, { color: '#dc2626' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: '#2563eb', flex: 1 }]}
              onPress={onRetry}
            >
              <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (status === 'no_branch_coords') {
      return (
        <View style={styles.stateContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#fef9c3' }]}>
            <Ionicons name="warning" size={48} color="#ca8a04" />
          </View>
          <Text style={[styles.statusTitle, { color: '#92400e' }]}>No Location Set</Text>
          <Text style={styles.statusSubtitle}>
            GPS coordinates haven't been configured for this branch. You may continue without location verification.
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: '#9ca3af' }]}
              onPress={onCancel}
            >
              <Text style={[styles.outlineButtonText, { color: '#6b7280' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: '#ca8a04', flex: 1 }]}
              onPress={onConfirm}
            >
              <Text style={styles.primaryButtonText}>Continue Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (status === 'permission_denied') {
      return (
        <View style={styles.stateContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="ban" size={48} color="#dc2626" />
          </View>
          <Text style={[styles.statusTitle, { color: '#dc2626' }]}>Permission Denied</Text>
          <Text style={styles.statusSubtitle}>
            Location access was denied. To inspect this branch, please enable Location
            permission for Vigilance in your device Settings.
          </Text>
          <View style={styles.instructionBox}>
            <Ionicons name="phone-portrait-outline" size={16} color="#6b7280" />
            <Text style={styles.instructionText}>
              {Platform.OS === 'ios'
                ? 'Settings → Vigilance → Location → While Using'
                : 'Settings → Apps → Vigilance → Permissions → Location'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: '#9ca3af', alignSelf: 'stretch' }]}
            onPress={onCancel}
          >
            <Text style={[styles.outlineButtonText, { color: '#6b7280' }]}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'error') {
      return (
        <View style={styles.stateContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="alert-circle" size={48} color="#dc2626" />
          </View>
          <Text style={[styles.statusTitle, { color: '#dc2626' }]}>Location Error</Text>
          <Text style={styles.statusSubtitle}>
            Unable to retrieve your GPS position. Make sure GPS is enabled and try again.
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: '#9ca3af' }]}
              onPress={onCancel}
            >
              <Text style={[styles.outlineButtonText, { color: '#6b7280' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: '#2563eb', flex: 1 }]}
              onPress={onRetry}
            >
              <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={isLoading ? undefined : onCancel} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <View style={styles.branchHeader}>
            <Ionicons name="business-outline" size={16} color="#6b7280" />
            <Text style={styles.branchHeaderText} numberOfLines={1}>
              {branchName}
            </Text>
          </View>
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 20,
    gap: 6,
  },
  branchHeaderText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  stateContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  addressText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  instructionText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
    lineHeight: 18,
  },
});
