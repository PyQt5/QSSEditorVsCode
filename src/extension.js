const vscode = require('vscode');
const client = require('./client.js');

var g_statusBar = null;

/**
 * 定义跳转
 * @param {vscode.TextDocument} document 
 * @param {vscode.Position} position 
 * @param {vscode.CancellationToken} token 
 */
function provideDefinition(document, position, token) {
	const word = document.getText(document.getWordRangeAtPosition(position));
	if (word.startsWith('Q') || word.startsWith('#')) {
		client.selectWidget(word);
	}
}

/**
 * 插件被激活时触发
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('extension "qsseditor" is now active!');
	console.log(process.env);

	// 注册命令应用样式命令
	context.subscriptions.push(vscode.commands.registerCommand('qsseditor.applyStyle', function () {
		client.applyStyle();
	}));

	// 注册设置端口命令
	context.subscriptions.push(vscode.commands.registerCommand('qsseditor.setPort', function () {
		client.setPort();
	}));

	// 注册跳转定义
	context.subscriptions.push(vscode.languages.registerDefinitionProvider([{
		scheme: 'file',
		language: 'css',
		pattern: '**/*.{css,qss,style}'
	}, {
		scheme: 'untitled',
		language: 'css',
		pattern: '**/*.{css,qss,style}'
	}], {
		provideDefinition
	}));

	// 注册事件
	vscode.workspace.onDidChangeTextDocument(client.onDidChangeTextDocument);
	vscode.workspace.onDidSaveTextDocument(client.onDidSaveTextDocument);

	// 注册状态栏
	if (!g_statusBar) {
		g_statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
	}
	updateStatusBar(false);
	client.setStatusBarCallback(updateStatusBar);

	// 注册关键词
	require('./provider.js')(context);

	client.initKeywords(context);

	// 连接服务器
	client.startClient();
}

function updateStatusBar(enabled) {
	if (g_statusBar) {
		g_statusBar.text = enabled ? `$(qss-status-on)` : `$(qss-status-off)`;
		g_statusBar.tooltip = enabled ? vscode.l10n.t("Connected") : vscode.l10n.t("Disconnected");
		g_statusBar.show();
	}
}

/**
 * 插件被释放时触发
 */
function deactivate() {
	console.log('extension "qsseditor" is now deactivated!');
	client.stopClient();
}

module.exports = {
	activate,
	deactivate
}