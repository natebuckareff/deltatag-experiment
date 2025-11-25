import { IslandEntry } from '../lib/island';

export function generateClientEntry(
  islands: { file: string; entry: IslandEntry }[],
  resolveImportPath: (file: string, index: number) => string,
): string {
  function* codegen() {
    yield `/* @refresh reload */`; // TODO: devmode only
    yield `import { hydrate } from 'solid-js/web';`;
    yield `import 'solid-devtools';`; // TODO: devmode only

    let importCount = 0;

    const hydrations: { alias: string; id: string }[] = [];

    for (const { file, entry } of islands) {
      const importPath = resolveImportPath(file, importCount++);
      const importFrom = JSON.stringify(importPath);
      const alias = `Island${importCount}`;

      yield entry.exportName === 'default'
        ? `import ${alias} from ${importFrom};`
        : `import { ${entry.exportName} as ${alias} } from ${importFrom};`;

      const id = JSON.stringify(entry.id);
      hydrations.push({ alias, id });
    }

    yield `\n\n`;

    for (const { alias, id } of hydrations) {
      yield `hydrate(() => <${alias} />, document.getElementById(${id}));`;
    }
  }

  return Array.from(codegen()).join('\n');
}
