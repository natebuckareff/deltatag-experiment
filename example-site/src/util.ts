import { inspect } from 'node:util';

export function print(value: unknown) {
  console.log(inspect(value, false, null, true));
}
