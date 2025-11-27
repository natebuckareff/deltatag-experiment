import { Counter } from '../components/counter';
import { LoginForm } from '../components/login-form';

export default function LoginPage() {
  return (
    <div>
      <p>login page</p>
      <a href="/dashboard">dashboard</a>
      <LoginForm client:load />
      <Counter client:load />
    </div>
  );
}
