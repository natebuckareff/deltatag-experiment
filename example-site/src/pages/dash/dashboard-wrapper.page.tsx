import type { JSX } from 'solid-js';
import type { PageConfig } from '../../scripts/build';

export const page: PageConfig = {
  path: '/dashboard',
  layout: true,
};

export default function DashboardWrapper(props: { children: JSX.Element }) {
  return (
    <div>
      <div>dashboard wrapper</div>
      <div>{props.children}</div>
    </div>
  );
}
