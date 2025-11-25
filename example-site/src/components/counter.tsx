import { createSignal, onMount } from 'solid-js';
import styles from './counter.module.css';

export function Counter() {
  const [count, setCount] = createSignal(0);
  console.log('IS THIS RUNNING?');
  onMount(() => {
    console.log('IS THIS RUNNING ON MOUNT?');
  });
  const handleClick = () => {
    console.log('IS THIS RUNNING ON CLICK?');
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
