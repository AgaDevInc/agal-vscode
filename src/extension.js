'use strict';
const vscode = require('vscode');
const agal = require('./agal');

module.exports = {
	async activate() {
		const { evalLine, AgalFunction, AgalClass } = await agal;
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
