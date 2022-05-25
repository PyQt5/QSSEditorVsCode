const vscode = require('vscode');

var g_items = [];

function register(context) {
    // 注册关键词
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('css', {
        provideCompletionItems(document, position) {
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            if (!linePrefix.endsWith('#')) {
                return undefined;
            }

            return g_items;
        }
    }, '#'));
};

function add(name) {
    if (name == undefined || name.trim() == "") return;
    g_items.push(new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword));
};

module.exports = {
    register,
    add,
}