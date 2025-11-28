import { Counter } from '../components/counter';

export default function Foo() {
  return (
    <div class="p-4">
      <h1>Foo</h1>
      <Counter client:load />
    </div>
  );
}
