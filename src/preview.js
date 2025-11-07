const vscode = require('vscode');

var g_panel = {};
var g_fnCapture;

function getWebviewContent(id) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview[${id}]</title>
</head>
<body>
    <img id="image" src="" />
    <script>
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'update':
                    document.getElementById('image').src = message.image;
                    break;
            }
        });
    </script>
</body>
</html>`;
}

function createWebviewPanel(id) {
    var panel = g_panel[id];
    if (panel) {
        if (!panel.visible) {
            panel.reveal(undefined, true);
        }
        return;
    }

    panel = vscode.window.createWebviewPanel(
        "QtDesignerPreviewer",
        `Preview[${id}]`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
            ],
        }
    );
    g_panel[id] = panel;

    // 定时请求截图
    const interval = setInterval(() => {
        if (panel.visible && g_fnCapture != undefined) {
            g_fnCapture(id);
        }
    }, 2000);

    // 关闭时触发
    panel.onDidDispose(() => {
        clearInterval(interval);
        if (g_panel[id]) {
            delete g_panel[id];
        }
    });

    panel.webview.html = getWebviewContent(id);
}

function show(id, image) {
    createWebviewPanel(id);
    var panel = g_panel[id];
    if (panel) {
        panel.webview.postMessage({
            command: 'update',
            image: image,
        });
    }
}

function count() {
    return Object.keys(g_panel).length;
}

function setCaptureFunc(request) {
    g_fnCapture = request;
}

module.exports = {
    show,
    count,
    setCaptureFunc,
}