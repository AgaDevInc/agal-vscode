'use strict';
const vscode = require('vscode');
const https = require('node:https');

// agal code 'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/index.cjs';
// my unDeno code 'https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/unDeno.js';
function get(url) {
	return new Promise((resolve, reject) => {
		https.get(url, (res) => {
			let data = '';
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => {
				resolve(data);
			});
		}).on('error', reject);
	});
}
async function loadAgal(){
	const codeDeno = await get('https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/unDeno.js');
	const moduleDeno = { exports: {} };
	const func = Function('module', 'require', codeDeno);
	func(moduleDeno, require);

	const agalCode = await get('https://raw.githubusercontent.com/AgaDevInc/AgaLanguage/main/index.cjs');
	const agalModule = { exports: {} };
	const agalFunc = Function('module', 'Deno', agalCode);
	agalFunc(agalModule, moduleDeno.exports)
  return await agalModule.exports;
}

module.exports = {
	async activate() {
		const { runtime } = await loadAgal();
		const {evalLine} = runtime;
		const {AgalFunction, AgalClass} = runtime.values.complex

		vscode.languages.registerCompletionItemProvider('agalanguage', {
			async provideCompletionItems(document, position) {
				const code = document.getText();
				const lines = code.split('\n');
				const line = lines[position.line].replace('\r', '').replace('\n', '').trim();
				lines[position.line] = '';
				const restFile = lines.join('\n');
				const [_, scope] = await evalLine(restFile);
				if (line.endsWith('.')) {
					const noDot = line.slice(0, line.length - 1);
					const [data] = await evalLine(noDot, undefined, scope);
					/** @type {string[]} */
					const keys = await data.keys();
					const items = keys.map(async key => {
						const val = await data.get(key);
						if (val instanceof AgalFunction)
							return new vscode.CompletionItem(key, vscode.CompletionItemKind.Method);
						if (val instanceof AgalClass)
							return new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
						return new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
					});
					return await Promise.all(items);
				}
				const items = Object.keys(scope.toObject()).map(name => {
					const val = scope.lookupVar(name);
					if (val instanceof AgalFunction)
						return new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
					if (val instanceof AgalClass)
						return new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
					return new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
				});
				return items;
			},
		});
	},
};
