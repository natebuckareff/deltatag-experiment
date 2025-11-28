import { TinyApp } from '../components/tinyapp';

export default function Bar() {
  return (
    <div class="p-4">
      <h1>Bar</h1>
      <TinyApp client:load />
    </div>
  );
}
