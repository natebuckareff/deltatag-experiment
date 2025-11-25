import { Counter } from '../components/counter';
import { Island } from '../lib/island';
import { createVar } from '../tera';
import '../pages/landing.css';

export default function LandingPage() {
  const ctx = createVar<{ username: string }>();
  return (
    <div>
      <div>landing page {ctx.username}</div>
      <Island>
        <Counter />
      </Island>
    </div>
  );
}
