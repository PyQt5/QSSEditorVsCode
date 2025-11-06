const vscode = require('vscode');

function createWebviewPanel(title) {
    const panel = vscode.window.createWebviewPanel(
        "QtDesignerPreviewer",
        title || "QtDesigner Preview",
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
            ],
        }
    );

    return panel;
}

function show() {
    const panel = createWebviewPanel();
}

module.exports = {
    show,
}