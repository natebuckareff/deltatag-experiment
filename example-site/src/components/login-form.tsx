import { createSignal } from 'solid-js';

export function LoginForm() {
  const [count, setCount] = createSignal(0);
  return (
    <div>
      <h1>Login</h1>
      <form>
        <pre>{count()}</pre>
        <input
          type="email"
          placeholder="Email"
          onInput={event => setCount(event.target.value.length)}
        />
        <input type="password" placeholder="Password" />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
