import type { IslandEntry } from '../lib/island';

export interface ClientEntryParams {
  islands: IslandEntry[];
  additionalImports?: string[];
  devtools?: boolean;
  jsx?: boolean;
  resolveImportPath: (file: string) => string;
}

export function generateClientEntry(params: ClientEntryParams): string {
  function* codegen() {
    if (params.devtools) {
      yield `/* @refresh reload */`;
      yield `import 'solid-devtools';`;
    }

    yield `import { hydrate } from 'solid-js/web';`;

    if (!params.jsx) {
      yield `import { createComponent } from 'solid-js';`;
    }

    for (const file of params.additionalImports ?? []) {
      const importPath = params.resolveImportPath(file);
      const importFrom = JSON.stringify(importPath);
      yield `import ${importFrom};`;
    }

    let importCount = 0;

    const hydrations: { alias: string; id: string }[] = [];

    for (const island of params.islands) {
      const importPath = params.resolveImportPath(island.file);
      const importFrom = JSON.stringify(importPath);
      const alias = `Island${importCount}`;

      importCount += 1;

      yield island.exportName === 'default'
        ? `import ${alias} from ${importFrom};`
        : `import { ${island.exportName} as ${alias} } from ${importFrom};`;

      const id = JSON.stringify(island.id);
      hydrations.push({ alias, id });
    }

    yield `\n\n`;

    for (const { alias, id } of hydrations) {
      const component = params.jsx
        ? `<${alias} />`
        : `createComponent(${alias}, {})`;

      yield `hydrate(() => ${component}, document.getElementById(${id}), { renderId: ${id} });`;
    }
  }

  return Array.from(codegen()).join('\n');
}
