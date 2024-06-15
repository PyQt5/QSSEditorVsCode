const vscode = require('vscode');
const RpcWebSocket = require('rpc-websockets').Client;
const keywords = require('./keywords.js');

var g_client;
var g_updateStatusBar;
var g_timerConnect; // 重连定时器
var g_timerApply; // 延迟应用样式
var g_autoApply = true; // 是否启用自动应用样式
var g_valid = true;
var g_host = "localhost";
var g_port = 61052;

/**
 * 初始化关键词
 * @param {vscode.ExtensionContext} context 
 */
function initKeywords(context) {
    keywords.register(context);
};

/**
 * 初始化服务端地址和端口
 */
function initAddress() {
    g_host = vscode.workspace.getConfiguration().get('qsseditor.serverHost', '127.0.0.1');
    g_port = Number(vscode.workspace.getConfiguration().get('qsseditor.serverPort', '61052'));
};

/**
 * 启动客户端
 */
function startClient() {
    console.log('NodeClient::start');
    if (g_timerConnect != undefined) {
        clearTimeout(g_timerConnect);
        g_timerConnect = undefined;
    }
    if (!g_valid) return;

    initAddress();
    g_client = new RpcWebSocket('ws://' + g_host + ':' + g_port, {
        reconnect: false
    });
    g_client.on('open', function () {
        console.log('NodeClient::handleConnected');
        if (g_updateStatusBar) g_updateStatusBar(true);
    });
    g_client.on('close', function () {
        console.log('NodeClient::handleDisconnected');
        if (g_valid && g_timerConnect == undefined) g_timerConnect = setTimeout(startClient, 3000);
        if (g_updateStatusBar) g_updateStatusBar(false);
    });
    g_client.on('error', function (event) {
        console.error('NodeClient::handleError: ' + event.error);
        if (g_valid && g_timerConnect == undefined) g_timerConnect = setTimeout(startClient, 3000);
        if (g_updateStatusBar) g_updateStatusBar(false);
    });
    g_client.on('addKeywords', function (words) {
        console.log('NodeClient::handleKeywordAdd: name=' + words);
        words.forEach(keywords.add);
    });
};

/**
 * 关闭客户端
 */
function stopClient() {
    console.log('NodeClient::stop');
    g_valid = false;
    if (g_client != undefined) g_client.close();
};

/**
 * 选中控件
 */
function selectWidget(word) {
    if (g_client == undefined) return;
    g_client.notify('selectWidget', [word]);
};

/**
 * 应用样式
 */
function applyStyle(doc) {
    if (g_client == undefined) return;
    // 获取当前激活的编辑器
    const editor = vscode.window.activeTextEditor;
    let document = editor.document;

    if (doc == undefined) {
        if (editor == undefined) return;
    } else {
        if (doc != document) return;
        document = doc;
    }

    // 获取选中的内容
    const selections = editor.selections;
    let styleSheets = [];
    for (let selection of selections) {
        if (!selection.isEmpty) {
            styleSheets.push(document.getText(selection));
        }
    }
    if (styleSheets.length == 0) {
        styleSheets.push(document.getText());
    }

    if (styleSheets.length == 0) return;
    g_client.notify('setStyleSheet', styleSheets);
};

/**
 * 设置端口
 */
function setPort() {
    vscode.window.showInputBox({
        ignoreFocusOut: false,
        placeHolder: vscode.l10n.t('Please input the port number'),
        title: vscode.l10n.t('Enter the connect port'),
        value: '' + vscode.workspace.getConfiguration().get('qsseditor.serverPort', '61052'),
        validateInput: function (value) {
            let port = Number(value);
            if (!isNaN(port) && port != 0)
                return null;
            return vscode.l10n.t('the value must be a number (0 < port < 65535)');
        }
    }).then(port => {
        if (port == undefined) return;
        g_port = Number(port);
        vscode.workspace.getConfiguration().update('qsseditor.serverPort', g_port, true);
        console.log('qsseditor.serverPort: ' + g_port);
        if (g_client != undefined) g_client.close(); // 断开重连
    });
};


/**
 * 执行延迟自动应用样式
 * @param {vscode.TextDocument} document 
 * @returns 
 */
function onAutoApply(document) {
    if (!g_autoApply) return;

    // 清除旧定时器
    if (g_timerApply != undefined) {
        clearTimeout(g_timerApply);
        g_timerApply = undefined;
    }

    // 创建新的定时器
    g_timerApply = setTimeout(function () {
        // console.log('NodeClient::onAutoApply');
        applyStyle(document);
        g_timerApply = undefined;
    }, 2000);

};

/**
 * 内容变化事件
 * @param {vscode.TextDocumentChangeEvent} event 
 */
function onDidChangeTextDocument(event) {
    onAutoApply(event.document);
};

/**
 * 保存事件
 * @param {vscode.TextDocument} document 
 */
function onDidSaveTextDocument(document) {
    onAutoApply(document);
};

/**
 * 设置状态栏回调
 * @param {function} callback 
 */
function setStatusBarCallback(callback) {
    g_updateStatusBar = callback;
}

module.exports = {
    initKeywords,
    startClient,
    stopClient,
    selectWidget,
    applyStyle,
    setPort,
    onDidChangeTextDocument,
    onDidSaveTextDocument,
    setStatusBarCallback,
}