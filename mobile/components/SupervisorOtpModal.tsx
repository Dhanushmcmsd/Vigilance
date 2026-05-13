import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { ToastMessage } from './ToastMessage';

interface SupervisorOtpModalProps {
  visible: boolean;
  inspectionId: string;
  checklistItemId: string;
  onAcknowledged: () => void;
  onClose: () => void;
}

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 600;
const MAX_ATTEMPTS = 3;
const PRIMARY = '#1E40AF';
const DANGER = '#DC2626';

export const SupervisorOtpModal: React.FC<SupervisorOtpModalProps> = ({
  visible,
  inspectionId,
  checklistItemId,
  onAcknowledged,
  onClose,
}) => {
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
  }>({ visible: false, message: '', type: 'success' });

  const otpValue = useMemo(() => digits.join(''), [digits]);
  const locked = attemptsLeft <= 0;

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning') =>
      setToast({ visible: true, message, type }),
    []
  );

  // Reset state every time the modal is reopened.
  useEffect(() => {
    if (visible) {
      setDigits(Array(OTP_LENGTH).fill(''));
      setAttemptsLeft(MAX_ATTEMPTS);
      setSecondsLeft(OTP_TTL_SECONDS);
      setTimeout(() => inputsRef.current[0]?.focus(), 200);
    }
  }, [visible]);

  // Countdown
  useEffect(() => {
    if (!visible) return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [visible, secondsLeft]);

  const handleChangeDigit = useCallback((index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    // Allow paste of full OTP from any box.
    if (cleaned.length >= OTP_LENGTH) {
      const paste = cleaned.slice(0, OTP_LENGTH).split('');
      setDigits(paste);
      inputsRef.current[OTP_LENGTH - 1]?.focus();
      Keyboard.dismiss();
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned[0];
      return next;
    });
    if (index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    } else {
      Keyboard.dismiss();
    }
  }, []);

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (key === 'Backspace' && !digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handleResend = useCallback(async () => {
    if (resending) return;
    setResending(true);
    try {
      const { error } = await supabase.functions.invoke('supervisor-otp', {
        body: {
          action: 'send',
          inspection_id: inspectionId,
          checklist_item_id: checklistItemId,
        },
      });
      if (error) throw error;
      setSecondsLeft(OTP_TTL_SECONDS);
      setAttemptsLeft(MAX_ATTEMPTS);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
      showToast('OTP resent to supervisor', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Failed to resend OTP', 'error');
    } finally {
      setResending(false);
    }
  }, [resending, inspectionId, checklistItemId, showToast]);

  const handleVerify = useCallback(async () => {
    if (locked || verifying) return;
    if (otpValue.length !== OTP_LENGTH) {
      showToast('Enter all 6 digits', 'warning');
      return;
    }
    if (secondsLeft <= 0) {
      showToast('OTP expired — tap Resend OTP', 'error');
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('supervisor-otp', {
        body: {
          action: 'verify',
          inspection_id: inspectionId,
          checklist_item_id: checklistItemId,
          otp: otpValue,
        },
      });
      if (error) throw error;
      if (data?.success) {
        showToast('Supervisor acknowledged', 'success');
        setTimeout(() => onAcknowledged(), 400);
      } else {
        const next = attemptsLeft - 1;
        setAttemptsLeft(next);
        setDigits(Array(OTP_LENGTH).fill(''));
        inputsRef.current[0]?.focus();
        if (next <= 0) {
          showToast('Too many invalid attempts. OTP locked.', 'error');
        } else {
          showToast(`Invalid OTP. ${next} attempts remaining.`, 'error');
        }
      }
    } catch (e: any) {
      const next = attemptsLeft - 1;
      setAttemptsLeft(next);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
      showToast(
        next > 0
          ? `Invalid OTP. ${next} attempts remaining.`
          : 'Too many invalid attempts. OTP locked.',
        'error'
      );
    } finally {
      setVerifying(false);
    }
  }, [
    locked,
    verifying,
    otpValue,
    secondsLeft,
    inspectionId,
    checklistItemId,
    attemptsLeft,
    onAcknowledged,
    showToast,
  ]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}
      >
        <ToastMessage
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast((p) => ({ ...p, visible: false }))}
        />

        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 22,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: DANGER, marginBottom: 6 }}>
            🔴 Supervisor Notification Sent
          </Text>
          <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 18, lineHeight: 18 }}>
            Enter the OTP sent to your supervisor's phone to continue.
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  inputsRef.current[i] = r;
                }}
                value={d}
                onChangeText={(t) => handleChangeDigit(i, t)}
                onKeyPress={(e) => handleKeyPress(i, e.nativeEvent.key)}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                maxLength={OTP_LENGTH}
                editable={!locked}
                selectTextOnFocus
                style={{
                  width: 44,
                  height: 54,
                  borderWidth: 1.5,
                  borderColor: d ? PRIMARY : '#e5e7eb',
                  borderRadius: 10,
                  textAlign: 'center',
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#111827',
                  backgroundColor: locked ? '#f3f4f6' : '#fff',
                }}
              />
            ))}
          </View>

          <Text
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: secondsLeft < 60 ? DANGER : '#6b7280',
              fontWeight: '600',
              marginBottom: 16,
            }}
          >
            {secondsLeft > 0 ? `Expires in ${mm}:${ss}` : 'OTP has expired'}
            {attemptsLeft < MAX_ATTEMPTS &&
              !locked &&
              ` • ${attemptsLeft} attempts left`}
          </Text>

          <TouchableOpacity
            onPress={handleVerify}
            disabled={locked || verifying || otpValue.length !== OTP_LENGTH}
            style={{
              backgroundColor:
                locked || otpValue.length !== OTP_LENGTH ? '#93c5fd' : PRIMARY,
              borderRadius: 12,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.4 }}>
                VERIFY OTP
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={handleResend} disabled={resending} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: '600' }}>
                {resending ? 'Resending…' : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
