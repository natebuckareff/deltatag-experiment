import { JSX } from 'solid-js';

function hasRouter(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return !!document.querySelector('[data-solid-router-root]');
}

export type LinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  base?: string;
};

export function Link(props: LinkProps) {
  return <a {...props} />;
}
