import { IslandEntry } from '../lib/island';

export function generateClientEntry(
  islands: IslandEntry[],
  resolveImportPath: (file: string, index: number) => string,
): string {
  function* codegen() {
    yield `/* @refresh reload */`; // TODO: devmode only
    yield `import { hydrate } from 'solid-js/web';`;
    yield `import 'solid-devtools';`; // TODO: devmode only

    let importCount = 0;

    const hydrations: { alias: string; id: string }[] = [];

    for (const island of islands) {
      const importPath = resolveImportPath(island.file, importCount++);
      const importFrom = JSON.stringify(importPath);
      const alias = `Island${importCount}`;

      yield island.exportName === 'default'
        ? `import ${alias} from ${importFrom};`
        : `import { ${island.exportName} as ${alias} } from ${importFrom};`;

      const id = JSON.stringify(island.id);
      hydrations.push({ alias, id });
    }

    yield `\n\n`;

    for (const { alias, id } of hydrations) {
      yield `hydrate(() => <${alias} />, document.getElementById(${id}), { renderId: ${id} });`;
    }
  }

  return Array.from(codegen()).join('\n');
}
