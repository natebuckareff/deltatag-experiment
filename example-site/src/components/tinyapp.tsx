import { A, Route, Router } from '@solidjs/router';

export function TinyApp() {
  return (
    <div class="border border-red-500 p-4">
      <Router base="/bar">
        <Route path="/" component={TinyHome} />
        <Route path="/foo" component={TinyFoo} />
      </Router>
    </div>
  );
}

function TinyHome() {
  return (
    <div class="border border-blue-600">
      <div>TinyHome</div>
      <A href="/foo">foo</A>
    </div>
  );
}

function TinyFoo() {
  return (
    <div class="border border-green-600 p-4">
      <div>TinyFoo</div>
      <A href="/">home</A>
    </div>
  );
}
