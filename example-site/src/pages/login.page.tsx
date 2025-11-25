import { LoginForm } from '../components/login-form';
import { Island } from '../lib/island';

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
