import { Stack } from 'expo-router';
import { AuthGuard } from '../../components/AuthGuard';

export default function OfficerLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGuard>
  );
}
