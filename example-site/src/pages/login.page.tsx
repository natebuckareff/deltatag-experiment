import { LoginForm } from '../components/login-form';
import { Island } from '../lib/island';
import type { PageConfig } from '../scripts/build';

export const page: PageConfig = {
  path: '/login',
};

export default function LoginPage() {
  return (
    <div>
      <p>login page</p>
      <a href="/dashboard">dashboard</a>
      <Island id="login-form">
        <LoginForm />
      </Island>
    </div>
  );
}
