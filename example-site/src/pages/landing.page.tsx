import type { PageConfig } from '../scripts/build';
import { createVar } from '../tera';

export const page: PageConfig = {
  path: '/',
};

export default function LandingPage() {
  const ctx = createVar<{ username: string }>();
  return <div>landing page {ctx.username}</div>;
}
