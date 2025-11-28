export function PageRouter() {
  if (typeof window !== 'undefined') {
    createPageRouter('/', url => {
      if (url === '/foo') {
        return () => {
          console.log('>>> foo');
        };
      }
    });
  }
  return null;
}

type RouterHandler = (uri: string) => (() => void) | undefined;

// adapted from https://github.com/lukeed/navaid
function createPageRouter(base: string, handler: RouterHandler) {
  const rgx =
    base == '/' ? /^\/+/ : new RegExp('^\\' + base + '(?=\\/|$)\\/?', 'i');

  let curr: string | undefined;

  function route(uri: string, replace?: boolean) {
    if (uri[0] == '/' && !rgx.test(uri)) uri = base + uri;
    (history as any)[(uri === curr || replace ? 'replace' : 'push') + 'State'](
      uri,
      null,
      uri,
    );
  }

  function click(e: PointerEvent) {
    if (!(e.target instanceof Element)) {
      return;
    }
    let x = e.target.closest('a');
    let y = x && x.getAttribute('href');
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.shiftKey ||
      e.button ||
      e.defaultPrevented
    )
      return;
    if (!y || x!.target || x!.host !== location.host || y[0] == '#') return;
    if (y[0] != '/' || rgx.test(y)) {
      const effective = fmt(y);
      const callback = effective && handler(effective);
      if (callback) {
        e.preventDefault();
        route(y);
      }
    }
  }

  function wrap(type: any, fn?: any) {
    let h = history as any;
    if (h[type]) return;
    h[type] = type;
    fn = h[(type += 'State')];
    h[type] = function (uri: string) {
      let ev: any = new Event(type.toLowerCase());
      ev.uri = uri;
      fn.apply(this, arguments);
      return dispatchEvent(ev);
    };
  }

  function fmt(uri: string) {
    if (!uri) return uri;
    uri = '/' + uri.replace(/^\/|\/$/g, '');
    return (rgx.test(uri) && uri.replace(rgx, '/')) || '';
  }

  function listen() {
    const run = () => {
      const effective = fmt(location.pathname);
      if (!effective) return;
      curr = effective;

      const callback = handler(effective);
      if (callback) {
        callback();
      }
    };

    wrap('push');
    wrap('replace');

    addEventListener('popstate', run);
    addEventListener('replacestate', run);
    addEventListener('pushstate', run);
    addEventListener('click', click);
  }

  listen();
}
