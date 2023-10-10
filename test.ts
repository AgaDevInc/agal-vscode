import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const https = require('node:https');
class CompletionItem{
  constructor(public label: string, public _kind: number) { }
}
const vscode = {
  CompletionItem,
  CompletionItemKind: {
    Property: 0,
    Method: 1,
    Function: 2,
    Constructor: 3,
    Field: 4,
    Variable: 5,
    Class: 6,
  }
}

// agal code 'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/index.cjs';
// my unDeno code 'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/unDeno.js';
function get(url: string) {
  return new Promise<string>((resolve, reject) => {
    https
      .get(url, (res: { on(str: string, cb: Function): void }) => {
        let data = '';
        res.on('data', (chunk: unknown) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      })
      .on('error', reject);
  });
}
async function include(url: string, _code?: string) {
  const code = _code || await get(url);
  const module = { exports: {} };
  const func = Function('module', 'require', code);
  await func(module, require);
  return await module.exports;
}

type Agal =
  typeof import('https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/index.cjs');
async function loadAgal() {
  const Deno_ = await include(
    'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/unDeno.js',`const { inspect } = require('node:util');
    const fs = require('node:fs/promises');
    // Use in nodejs to replace Deno
    const fn = () => {};
    const req = new Request('https://example.com');
    const Deno = {
      cwd: () => process.cwd(),
      readTextFile: path => fs.readFile(path, 'utf8'),
      exit: code => process.exit(code),
      readFile: _path => Promise.resolve(new Uint8Array()),
      writeFile: fn,
      remove: fn,
      readDir: _path => ['File_1.txt', 'File_2.txt'].map(file => ({ name: file })),
      mkdir: fn,
      inspect: obj => inspect(obj),
      version: { deno: '' },
      serveHttp: () => ({
        [Symbol.asyncIterator]: async function* () {
          yield {
            respondWith() {},
            request: req,
          };
        },
      }),
      listen: () => ({
        [Symbol.asyncIterator]: async function* () {},
      }),
    };
    module.exports = Deno;
    `
  );

  const agalCode = await get('https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/index.cjs');
  const agalModule = { exports: {} };
  const agalFunc = Function('module', 'Deno', agalCode);
  await agalFunc(agalModule, Deno_);
  return (await agalModule.exports) as any;
}
const path = Deno.cwd() + '/../agalanguage/iniciar.agal';
const code = Deno.readTextFileSync(path);
const position = { line: 1 };

type Sync<T> = T extends Promise<infer U> ? U : T;

const data = (async function () {
  const { runtime, frontend } = await loadAgal() as Agal;
  const {Parser} = frontend;
  const { evalLine, getModuleScope, interpreter:{default:evaluate}, values, stack:{defaultStack} } = runtime;
  const {complex, primitive: {AgalNull}} = values
  const { AgalFunction, AgalClass } = complex;

  const listEvaluate: (node: any, env: any, stack: any) => Promise<InstanceType<typeof AgalNull>> = async (program, scope, stack) => {
    let result: Sync<ReturnType<typeof evaluate>> | undefined;
    if(!Array.isArray(program)) return evaluate(program, scope, stack);
    for(const node of program){
      result = await evaluate(node, scope, stack);
    }
    return result || AgalNull.from(true);
  }

  const lines = code.split('\n');
  const line = lines[position.line].replace('\r', '').trim();
  lines[position.line] = '';
  const restFile = lines.join('\n');
  const [_, scope] = await evalLine(restFile, 0, getModuleScope(path));
  if (line.endsWith('.')) {
    const noDot = line.slice(0, line.length - 1);
    const parser = new Parser();
    const program = parser.produceAST(noDot, false, path);
    const data= await listEvaluate(program.body, scope, defaultStack);
    const keys = data.keys();
    return keys.map(key => {
      const val = (data.get as any)(defaultStack,key);
      if (val instanceof AgalFunction)
        return new vscode.CompletionItem(key, vscode.CompletionItemKind.Method);
      if (val instanceof AgalClass)
        return new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
      return new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
    });
  }
  return Object.keys(scope.toObject()).map(name => {
    const val = scope.get(name);
    if (val instanceof AgalFunction)
      return new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
    if (val instanceof AgalClass)
      return new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
    return new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
  });
})();
data.then(console.log);
