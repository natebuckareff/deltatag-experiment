import fs from 'node:fs/promises';
import path from 'node:path';

export interface FileTreeDir {
  kind: 'dir';
  filename: string;
  src: string;
  children: FileTree[];
}

export interface FileTreeFile {
  kind: 'file';
  filename: string;
  src: string;
}

export type FileTree = FileTreeDir | FileTreeFile;

export async function readFileTree(dirPath: string): Promise<FileTreeDir> {
  const rootPath = path.resolve(dirPath);

  if (!(await fs.stat(rootPath)).isDirectory()) {
    throw Error('not a directory');
  }

  async function walkDir(srcPath: string): Promise<FileTreeDir> {
    const filename = path.basename(srcPath);
    const src = path.relative(rootPath, srcPath);
    const files = await fs.readdir(srcPath);
    const children: FileTree[] = [];
    for (const child of files) {
      const entry = await walk(path.join(srcPath, child));
      children.push(entry);
    }
    return { kind: 'dir', filename, src, children };
  }

  async function walkFile(srcPath: string): Promise<FileTreeFile> {
    const filename = path.basename(srcPath);
    const src = path.relative(rootPath, srcPath);
    return { kind: 'file', filename, src };
  }

  async function walk(srcPath: string): Promise<FileTree> {
    const stat = await fs.stat(srcPath);
    if (stat.isDirectory()) {
      return walkDir(srcPath);
    } else {
      return walkFile(srcPath);
    }
  }

  return walkDir(rootPath);
}
