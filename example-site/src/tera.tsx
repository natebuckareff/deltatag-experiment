const nothing = () => {};

export function createVar<T>(path?: string[], base: any = {}): T {
  const proxy = new Proxy(base, {
    get(_target, prop) {
      // NOTE: depends on solid JSX implementation detail
      if (prop === 't') {
        const raw = path ? path.join('.') : '';
        return `{{${raw}}}`;
      }

      if (prop === 'toString') {
        const raw = path ? path.join('.') : '';
        return () => raw;
      }

      if (prop === 'map') {
        return createVar<T>([...(path ?? []), prop], nothing);
      }

      if (typeof prop === 'symbol') {
        return undefined;
      }

      return createVar<T>([...(path ?? []), prop]);
    },

    apply(_target, thisArg, argumentsList) {
      if (path && path[path.length - 1] === 'map') {
        const callback = argumentsList[0];
        const item = createVar<unknown>(['item']);
        return (
          <>
            {`{% for item in ${thisArg.toString()} %}`}
            {callback(item)}
            {`{% endfor %}`}
          </>
        );
      }
      throw Error('not a function');
    },
  });
  return proxy as T;
}
