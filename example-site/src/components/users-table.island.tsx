import { createSignal } from 'solid-js';

export default function UsersTable() {
  const [count, setCount] = createSignal(0);
  return (
    <div>
      <div>users: {count()}</div>
      <button type="button" onClick={() => setCount(count() + 1)}>
        add user
      </button>
    </div>
  );
}
