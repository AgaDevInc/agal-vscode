'use strict';
const vscode = require('vscode');
const https = require('node:https');

// agal code 'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/index.cjs';
// my unDeno code 'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/unDeno.js';
function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      })
      .on('error', reject);
  });
}

async function loadAgal() {
  const codeDeno = await get(
    'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/unDeno.js'
  );
  const moduleDeno = { exports: {} };
  const func = Function('module', 'require', codeDeno);
  func(moduleDeno, require);

  const agalCode = await get(
    'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/index.cjs'
  );
  const agalModule = { exports: 0 };
  const agalFunc = Function('module', 'Deno', agalCode);
  agalFunc(agalModule, moduleDeno.exports);
  return await agalModule.exports;
}

module.exports = {
  async activate() {
		/** @type {import('https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/index.cjs')} */
    const { runtime, frontend } = await loadAgal();
    const {Parser} = frontend;
    const { evalLine, getModuleScope, interpreter:{default:evaluate}, values, stack:{defaultStack} } = runtime;
    const {complex, primitive: {AgalNull}} = values
    const { AgalFunction, AgalClass } = complex;
  
    const listEvaluate = async (program, scope, stack) => {
      let result;
      if(!Array.isArray(program)) return evaluate(program, scope, stack);
      for(const node of program){
        result = await evaluate(node, scope, stack);
      }
      return result || AgalNull.from(true);
    }

    vscode.languages.registerCompletionItemProvider('agalanguage', {
      async provideCompletionItems(document, position) {
        const code = document.getText();
        const path = document.fileName;
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
            const val = data.get(defaultStack,key);
            if (val instanceof AgalFunction)
              return new vscode.CompletionItem(key, vscode.CompletionItemKind.Method);
            if (val instanceof AgalClass)
              return new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
            return new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
          });
        }
        return Object.keys(scope.toObject()).map(name => {
          const val = scope.get(name);
          if(scope.keywords.has(name))
            return new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
          if (val instanceof AgalFunction)
            return new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
          if (val instanceof AgalClass)
            return new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
          return new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
        });
      },
    });
  },
};
