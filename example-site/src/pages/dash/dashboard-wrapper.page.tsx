import type { JSX } from 'solid-js';

export default function DashboardWrapper(props: { children: JSX.Element }) {
  return (
    <div>
      <div>dashboard wrapper</div>
      <div>{props.children}</div>
    </div>
  );
}
