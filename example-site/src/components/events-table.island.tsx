import { createSignal } from 'solid-js';

export function EventsTable() {
  const [count, setCount] = createSignal(0);
  return (
    <div>
      <div>events: {count()}</div>
      <button type="button" onClick={() => setCount(count() + 1)}>
        add event
      </button>
    </div>
  );
}
