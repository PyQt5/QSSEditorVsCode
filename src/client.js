const vscode = require('vscode');
const RpcWebSocket = require('rpc-websockets').Client;
const keywords = require('./keywords.js');
const preview = require('./preview.js');

var g_client;
var g_updateStatusBar;
var g_timerApply; // 延迟应用样式
var g_valid = true;
var g_tmpDoc; // 临时文档
var g_host = 'localhost';
var g_port = 61052;
var g_count = 0;
var g_output;
var g_styles = []; // 样式内容

/**
 * 初始化关键词
 * @param {vscode.ExtensionContext} context 
 */
function initKeywords(context) {
    g_output.appendLine('NodeClient::initKeywords');
    keywords.register(context);
};

/**
 * 初始化服务端地址和端口
 */
function initAddress() {
    g_host = vscode.workspace.getConfiguration().get('qsseditor.serverHost', '127.0.0.1');
    g_port = Number(vscode.workspace.getConfiguration().get('qsseditor.serverPort', '61052'));
    g_output.appendLine(`NodeClient::initAddress, host=${g_host}, port=${g_port}`);
};

/**
 * 启动客户端
 */
function startClient() {
    if (g_client != undefined) return;
    g_output.appendLine('NodeClient::startClient');

    initAddress();
    g_client = new RpcWebSocket('ws://' + g_host + ':' + g_port, {
        autoconnect: true,
        reconnect: true,
        reconnect_interval: 3000,
        max_reconnects: 0, // 无限重连
    });
    g_client.on('open', function () {
        g_output.appendLine('NodeClient::handleConnected');
        g_count = 0;
        setValid(true);
        if (g_updateStatusBar) g_updateStatusBar(true);
    });
    g_client.on('close', function () {
        if (g_count < 10) {
            g_output.appendLine('NodeClient::handleDisconnected');
        }
        g_count++;
        setValid(false);
        if (g_updateStatusBar) g_updateStatusBar(false);
    });
    g_client.on('error', function (event) {
        if (g_count < 10) {
            g_output.appendLine('NodeClient::handleError: ' + event.error);
        }
        g_count++;
        setValid(false);
        if (g_updateStatusBar) g_updateStatusBar(false);
    });
    g_client.on('addKeywords', function (words) {
        g_output.appendLine('NodeClient::handleKeywordAdd: name=' + words);
        words.forEach(keywords.add);
    });
    g_client.on('showImage', function (params) {
        if (params.length < 2) return;
        // g_output.appendLine('NodeClient::handleShowImage: id=' + params[0]);
        showImages(params[0], params[1]);
    });
};


/**
 * 关闭客户端
 */
function stopClient() {
    g_output.appendLine('NodeClient::stopClient');
    setValid(false);
    if (g_client != undefined) {
        g_client.setAutoReconnect(false);
        g_client.close();
    }
};

/**
 * 设置插件是否激活可用标志
 * @param {boolean} valid 
 */
function setValid(valid) {
    // g_output.appendLine('NodeClient::setValid, valid=' + valid);
    g_valid = valid;
}

/**
 * 设置窗口输出
 * @param {vscode.OutputChannel} output 
 */
function setOutputChannel(output) {
    g_output = output;
}

/**
 * 更新样式内容
 * @param {vscode.TextDocument} document 
 */
function updateStyleText(document) {
    // g_output.appendLine('NodeClient::updateStyleText');
    g_styles = [];
    if (!g_valid || g_client == undefined) return;

    // g_output.appendLine(`NodeClient::updateStyleText, document=${document}`);

    if (document == undefined) {
        // 获取当前激活的编辑器
        const editor = vscode.window.activeTextEditor;
        if (editor == undefined) return;
        document = editor.document;
    }

    try {
        // 获取选中的内容
        const selections = document.editor.selections;

        for (let selection of selections) {
            if (!selection.isEmpty) {
                g_styles.push(document.getText(selection));
            }
        }
    } catch (e) {
        // g_output.appendLine(`NodeClient::updateStyleText, error=${e}`);
    }

    try {
        if (g_styles.length == 0) {
            g_styles.push(document.getText());
        }
    } catch (e) {
        // g_output.appendLine(`NodeClient::updateStyleText, error=${e}`);
    }

    // g_output.appendLine(`NodeClient::updateStyleText, styles=${g_styles}`);
}

/**
 * 更新自动应用定时器
 */
function updateTimer() {
    let isAuto = vscode.workspace.getConfiguration().get('qsseditor.autoApply', true);
    if (!isAuto) return;

    // 清除旧定时器
    if (g_timerApply != undefined) {
        clearTimeout(g_timerApply);
        g_timerApply = undefined;
    }

    // 创建新的定时器
    g_timerApply = setTimeout(function () {
        onAutoApply();
        g_timerApply = undefined;
    }, 2000);
}

/**
 * 选中控件
 * @param {string} word 
 */
function selectWidget(word) {
    if (!g_valid || g_client == undefined) return;
    g_client.notify('selectWidget', [word]);
};

/**
 * 应用样式
 */
function applyStyle() {
    // g_output.appendLine('NodeClient::applyStyle');
    if (!g_valid || g_client == undefined) return;
    updateStyleText(undefined);
    if (g_styles.length == 0) return;
    g_client.notify('setStyleSheet', g_styles);
    g_styles = [];
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
        g_output.appendLine(`qsseditor.serverPort: ${g_port}`);
        if (g_client != undefined) g_client.close(); // 断开重连
    });
};

/**
 * 获取截图
 */
function captureWidget(id) {
    if (!g_valid || g_client == undefined) return;
    g_client.notify('captureWidget', id == undefined ? 'all' : id);
}

/**
 * 显示截图
 */
function showImages(id, image) {
    preview.show(id, image);
}


/**
 * 执行延迟自动应用样式
 */
function onAutoApply() {
    // g_output.appendLine('NodeClient::onAutoApply');
    updateStyleText(g_tmpDoc);
    g_tmpDoc = undefined;
    if (g_styles.length == 0) return;
    g_client.notify('setStyleSheet', g_styles);
    g_styles = [];
};

/**
 * 内容变化事件
 * @param {vscode.TextDocumentChangeEvent} event 
 */
function onDidChangeTextDocument(event) {
    if (!g_valid || g_client == undefined) return;
    g_tmpDoc = event.document;
    updateTimer();
};

/**
 * 保存事件
 * @param {vscode.TextDocument} document 
 */
function onDidSaveTextDocument(document) {
    if (!g_valid || g_client == undefined) return;
    g_tmpDoc = document;
    updateTimer();
};

/**
 * 设置状态栏回调
 * @param {function} callback 
 */
function setStatusBarCallback(callback) {
    g_updateStatusBar = callback;
};

preview.setCaptureFunc(captureWidget);

module.exports = {
    initKeywords,
    startClient,
    stopClient,
    setValid,
    setOutputChannel,
    selectWidget,
    applyStyle,
    setPort,
    captureWidget,
    onDidChangeTextDocument,
    onDidSaveTextDocument,
    setStatusBarCallback,
}