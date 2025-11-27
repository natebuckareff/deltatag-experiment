import { Counter } from '../components/counter';
import { createVar } from '../tera';
import '../pages/landing.css';

export default function LandingPage() {
  const ctx = createVar<{ username: string }>();
  return (
    <div>
      <div>landing page {ctx.username}</div>
      <h1 class="text-3xl font-bold underline text-red-500">Hello world!</h1>
      <Counter client:load />
    </div>
  );
}
