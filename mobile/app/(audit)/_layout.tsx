import { Stack } from 'expo-router';
import { AuditGuard } from '../../components/AuditGuard';

export default function AuditLayout() {
  return (
    <AuditGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuditGuard>
  );
}
