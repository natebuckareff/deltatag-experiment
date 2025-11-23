import { createSignal } from 'solid-js';

export const page = {
  someMetaData: 'some value',
};

export function App() {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <div>Hello World</div>
      <div>{count()}</div>
      <button type="button" onClick={() => setCount(count() + 1)}>
        Increment
      </button>
    </div>
  );
}
