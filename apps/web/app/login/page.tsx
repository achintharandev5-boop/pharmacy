import LoginForm from './LoginForm';
import { uiTestEnabled } from '@/lib/uiTestMode';
import { frontendOnlyMode } from '@/lib/server/apiConfiguration';
export default function LoginPage() {
  const frontendOnly = frontendOnlyMode();
  return <LoginForm demo={!frontendOnly && uiTestEnabled() ? {
    email: process.env.UI_TEST_EMAIL || 'tester@pharmacy.local',
    password: process.env.UI_TEST_PASSWORD || 'Test@12345',
  } : null} frontendOnly={frontendOnly} />;
}
