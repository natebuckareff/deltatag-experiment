import 'solid-js';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicAttributes {
      'client:id'?: string;
      'client:load'?: boolean;
    }

    interface CustomAttributes<T> {
      'client:id'?: string;
      'client:load'?: boolean;
    }
  }
}
