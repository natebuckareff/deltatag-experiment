import { createSignal } from 'solid-js';
import styles from './counter.module.css';

export function Counter() {
  const [count, setCount] = createSignal(0);
  const handleClick = () => {
    setCount(count() + 1);
  };
  return (
    <div class={styles.counter}>
      <div>count: {count()}</div>
      <button type="button" onClick={handleClick}>
        add
      </button>
    </div>
  );
}
