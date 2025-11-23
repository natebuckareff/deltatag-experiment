import { createSignal } from 'solid-js';
import {
  Hydration,
  HydrationScript,
  NoHydration,
  renderToString,
} from 'solid-js/web';
import { createVar } from './tera';

function Counter() {
  const [count, setCount] = createSignal(0);
  return (
    <div>
      <div>{count()}</div>
      <button type="button" onClick={() => setCount(count() + 1)}>
        Increment
      </button>
    </div>
  );
}

const renderPage = () => {
  interface Context {
    title: string;
    user: {
      foo: {
        bar: string;
      };
    };
    products: { name: string }[];
  }

  const ctx = createVar<Context>();

  return (
    <NoHydration>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>
          <main>
            <h1>test</h1>
            <p>this is completely static</p>
            <p>{ctx.title}</p>
            <p>{ctx.user.foo.bar}</p>
            <div>
              {ctx.products.map(product => (
                <p>{product.name}</p>
              ))}
            </div>
          </main>
          <Hydration>
            <div id="root">
              <Counter />
            </div>
          </Hydration>
          <HydrationScript />
        </body>
      </html>
    </NoHydration>
  );
};

function main() {
  const html = renderToString(renderPage);
  console.log(html);
}

main();
