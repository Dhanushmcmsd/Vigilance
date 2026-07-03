import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ItemAttachment {
  uri: string;
  name: string;
  type: 'image' | 'document';
  uploading?: boolean;
  fileUrl?: string;
}

interface Props {
  files: ItemAttachment[];
  onAddCamera: () => void;
  onAddGallery: () => void;
  onAddDocument: () => void;
  onRemove: (uri: string) => void;
  /** Inline under remark field — no extra top divider */
  compact?: boolean;
}

export function ItemAttachments({
  files,
  onAddCamera,
  onAddGallery,
  onAddDocument,
  onRemove,
  compact,
}: Props) {
  return (
    <View
      style={
        compact
          ? { marginTop: 10 }
          : { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }
      }
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 8 }}>
        Evidence (optional)
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: files.length ? 10 : 0 }}>
        <TouchableOpacity
          onPress={onAddCamera}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: '#eff6ff',
            borderRadius: 10,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="camera-outline" size={16} color="#2563eb" />
          <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 12 }}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onAddGallery}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: '#ecfeff',
            borderRadius: 10,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="images-outline" size={16} color="#0891b2" />
          <Text style={{ color: '#0891b2', fontWeight: '700', fontSize: 12 }}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onAddDocument}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: '#f8fafc',
            borderRadius: 10,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}
        >
          <Ionicons name="document-attach-outline" size={16} color="#475569" />
          <Text style={{ color: '#475569', fontWeight: '700', fontSize: 12 }}>Document</Text>
        </TouchableOpacity>
      </View>
      {files.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {files.map((file) => (
            <View key={file.uri} style={{ marginRight: 10, position: 'relative' }}>
              {file.type === 'image' ? (
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    backgroundColor: '#e2e8f0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    source={{ uri: file.uri }}
                    style={{ width: 72, height: 72, borderRadius: 8 }}
                  />
                  {file.uploading ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                      }}
                    >
                      <ActivityIndicator color="#fff" size="small" />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    backgroundColor: '#f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                  }}
                >
                  <Ionicons name="document-text-outline" size={24} color="#64748b" />
                  <Text numberOfLines={2} style={{ fontSize: 8, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
                    {file.name}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => onRemove(file.uri)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  backgroundColor: '#dc2626',
                  borderRadius: 10,
                  width: 20,
                  height: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
