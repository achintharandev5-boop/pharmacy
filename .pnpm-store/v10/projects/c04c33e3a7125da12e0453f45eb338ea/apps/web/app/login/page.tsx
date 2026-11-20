import LoginForm from './LoginForm';
import { uiTestEnabled } from '@/lib/uiTestMode';
export default function LoginPage() {
  return <LoginForm demo={uiTestEnabled() ? {
    email: process.env.UI_TEST_EMAIL || 'tester@pharmacy.local',
    password: process.env.UI_TEST_PASSWORD || 'Test@12345',
  } : null} />;
}
