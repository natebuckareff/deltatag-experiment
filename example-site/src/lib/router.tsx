export function PageRouter() {
  if (typeof window !== 'undefined') {
    createPageRouter('/', url => {
      console.log('>>> page router handler for', url);
      return;
    });
  }
  return null;
}

type RouterHandler = (uri: string) => (() => void) | undefined | void;

// adapted from https://github.com/lukeed/navaid
function createPageRouter(base: string, handler: RouterHandler) {
  const rgx =
    base == '/' ? /^\/+/ : new RegExp('^\\' + base + '(?=\\/|$)\\/?', 'i');

  let curr: string | undefined;

  function route(uri: string, replace?: boolean) {
    if (uri[0] == '/' && !rgx.test(uri)) uri = base + uri;

    const state = { _owner: 'page_router' };
    (history as any)[(uri === curr || replace ? 'replace' : 'push') + 'State'](
      state,
      null,
      uri,
    );
  }

  function click(e: PointerEvent) {
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.shiftKey ||
      e.button ||
      e.defaultPrevented
    ) {
      return;
    }

    const target = e.target instanceof Element && e.target.closest('a');
    if (
      !target ||
      !target.href ||
      target.target ||
      target.host !== location.host ||
      target.getAttribute('href')![0] === '#'
    )
      return;

    const y = target.getAttribute('href');
    if (y && (y[0] != '/' || rgx.test(y))) {
      const effective = fmt(y);
      const callback = effective && handler(effective);
      if (callback) {
        e.preventDefault();
        route(y);
        callback();
      }
    }
  }

  function fmt(uri: string) {
    if (!uri) return uri;
    uri = '/' + uri.replace(/^\/|\/$/g, '');
    return (rgx.test(uri) && uri.replace(rgx, '/')) || '';
  }

  function listen() {
    const run = (e: PopStateEvent) => {
      if (e.state && e.state._owner !== 'page_router' && e.state !== null) {
        return;
      }

      const effective = fmt(location.pathname);
      if (!effective) {
        return;
      }
      curr = effective;

      const callback = handler(effective);
      if (callback) {
        callback();
      }
    };

    addEventListener('popstate', run);
    addEventListener('click', click);
  }

  listen();
}
