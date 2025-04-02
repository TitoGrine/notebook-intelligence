// Copyright (c) Mehmet Bektas <mbektasgh@outlook.com>
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Dialog, ICommandPalette } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { IEditorLanguageRegistry } from '@jupyterlab/codemirror';
import { CodeCell } from '@jupyterlab/cells';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { NotebookPanel } from '@jupyterlab/notebook';
import { FileEditorWidget } from '@jupyterlab/fileeditor';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { ContentsManager, KernelSpecManager } from '@jupyterlab/services';
import { LabIcon } from '@jupyterlab/ui-components';
import { Menu, Panel, Widget } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import { IStatusBar } from '@jupyterlab/statusbar';
import { ChatSidebar, ConfigurationDialogBody, GitHubCopilotLoginDialogBody, GitHubCopilotStatusBarItem, InlinePromptWidget, RunChatCompletionType } from './chat-sidebar';
import { NBIAPI, GitHubCopilotLoginStatus } from './api';
import { BackendMessageType, GITHUB_COPILOT_PROVIDER_ID, INotebookIntelligence, RequestDataType, TelemetryEventType } from './tokens';
import sparklesSvgstr from '../style/icons/sparkles.svg';
import copilotSvgstr from '../style/icons/copilot.svg';
import { applyCodeToSelectionInEditor, cellOutputAsText, compareSelections, extractLLMGeneratedCode, getSelectionInEditor, getTokenCount, getWholeNotebookContent, isSelectionEmpty, markdownToComment, waitForDuration } from './utils';
import { UUID } from '@lumino/coreutils';
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.chatuserInput = 'notebook-intelligence:chat-user-input';
    CommandIDs.insertAtCursor = 'notebook-intelligence:insert-at-cursor';
    CommandIDs.addCodeAsNewCell = 'notebook-intelligence:add-code-as-new-cell';
    CommandIDs.createNewFile = 'notebook-intelligence:create-new-file';
    CommandIDs.createNewNotebookFromPython = 'notebook-intelligence:create-new-notebook-from-py';
    CommandIDs.addCodeCellToNotebook = 'notebook-intelligence:add-code-cell-to-notebook';
    CommandIDs.addMarkdownCellToNotebook = 'notebook-intelligence:add-markdown-cell-to-notebook';
    CommandIDs.editorGenerateCode = 'notebook-intelligence:editor-generate-code';
    CommandIDs.editorExplainThisCode = 'notebook-intelligence:editor-explain-this-code';
    CommandIDs.editorFixThisCode = 'notebook-intelligence:editor-fix-this-code';
    CommandIDs.editorExplainThisOutput = 'notebook-intelligence:editor-explain-this-output';
    CommandIDs.editorTroubleshootThisOutput = 'notebook-intelligence:editor-troubleshoot-this-output';
    CommandIDs.openGitHubCopilotLoginDialog = 'notebook-intelligence:open-github-copilot-login-dialog';
    CommandIDs.openConfigurationDialog = 'notebook-intelligence:open-configuration-dialog';
})(CommandIDs || (CommandIDs = {}));
const DOCUMENT_WATCH_INTERVAL = 1000;
const MAX_TOKENS = 4096;
const githubCopilotIcon = new LabIcon({
    name: 'notebook-intelligence:github-copilot-icon',
    svgstr: copilotSvgstr
});
const sparkleIcon = new LabIcon({
    name: 'notebook-intelligence:sparkles-icon',
    svgstr: sparklesSvgstr
});
const emptyNotebookContent = {
    cells: [],
    metadata: {},
    nbformat: 4,
    nbformat_minor: 5
};
const BACKEND_TELEMETRY_LISTENER_NAME = 'backend-telemetry-listener';
class ActiveDocumentWatcher {
    static initialize(app, languageRegistry) {
        var _a;
        ActiveDocumentWatcher._languageRegistry = languageRegistry;
        (_a = app.shell.currentChanged) === null || _a === void 0 ? void 0 : _a.connect((_sender, args) => {
            ActiveDocumentWatcher.watchDocument(args.newValue);
        });
        ActiveDocumentWatcher.activeDocumentInfo.activeWidget =
            app.shell.currentWidget;
        ActiveDocumentWatcher.handleWatchDocument();
    }
    static watchDocument(widget) {
        if (ActiveDocumentWatcher.activeDocumentInfo.activeWidget === widget) {
            return;
        }
        clearInterval(ActiveDocumentWatcher._watchTimer);
        ActiveDocumentWatcher.activeDocumentInfo.activeWidget = widget;
        ActiveDocumentWatcher._watchTimer = setInterval(() => {
            ActiveDocumentWatcher.handleWatchDocument();
        }, DOCUMENT_WATCH_INTERVAL);
        ActiveDocumentWatcher.handleWatchDocument();
    }
    static handleWatchDocument() {
        var _a, _b, _c, _d, _e, _f, _g;
        const activeDocumentInfo = ActiveDocumentWatcher.activeDocumentInfo;
        const previousDocumentInfo = {
            ...activeDocumentInfo,
            ...{ activeWidget: null }
        };
        const activeWidget = activeDocumentInfo.activeWidget;
        if (activeWidget instanceof NotebookPanel) {
            const np = activeWidget;
            activeDocumentInfo.filename = np.sessionContext.name;
            activeDocumentInfo.filePath = np.sessionContext.path;
            activeDocumentInfo.language =
                ((_d = (_c = (_b = (_a = np.model) === null || _a === void 0 ? void 0 : _a.sharedModel) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.kernelspec) === null || _d === void 0 ? void 0 : _d.language) ||
                    'python';
            const { activeCellIndex, activeCell } = np.content;
            activeDocumentInfo.activeCellIndex = activeCellIndex;
            activeDocumentInfo.selection = (_e = activeCell === null || activeCell === void 0 ? void 0 : activeCell.editor) === null || _e === void 0 ? void 0 : _e.getSelection();
        }
        else if (activeWidget) {
            const dw = activeWidget;
            const contentsModel = (_f = dw.context) === null || _f === void 0 ? void 0 : _f.contentsModel;
            if ((contentsModel === null || contentsModel === void 0 ? void 0 : contentsModel.format) === 'text') {
                const fileName = contentsModel.name;
                const filePath = contentsModel.path;
                const language = ActiveDocumentWatcher._languageRegistry.findByMIME(contentsModel.mimetype) || ActiveDocumentWatcher._languageRegistry.findByFileName(fileName);
                activeDocumentInfo.language = (language === null || language === void 0 ? void 0 : language.name) || 'unknown';
                activeDocumentInfo.filename = fileName;
                activeDocumentInfo.filePath = filePath;
                if (activeWidget instanceof FileEditorWidget) {
                    const fe = activeWidget;
                    activeDocumentInfo.selection = (_g = fe.content.editor) === null || _g === void 0 ? void 0 : _g.getSelection();
                }
                else {
                    activeDocumentInfo.selection = undefined;
                }
            }
            else {
                activeDocumentInfo.filename = '';
                activeDocumentInfo.filePath = '';
                activeDocumentInfo.language = '';
            }
        }
        if (ActiveDocumentWatcher.documentInfoChanged(previousDocumentInfo, activeDocumentInfo)) {
            ActiveDocumentWatcher.fireActiveDocumentChangedEvent();
        }
    }
    static documentInfoChanged(lhs, rhs) {
        if (!lhs || !rhs) {
            return true;
        }
        return (lhs.filename !== rhs.filename ||
            lhs.filePath !== rhs.filePath ||
            lhs.language !== rhs.language ||
            lhs.activeCellIndex !== rhs.activeCellIndex ||
            !compareSelections(lhs.selection, rhs.selection));
    }
    static getActiveSelectionContent() {
        var _a, _b;
        const activeDocumentInfo = ActiveDocumentWatcher.activeDocumentInfo;
        const activeWidget = activeDocumentInfo.activeWidget;
        if (activeWidget instanceof NotebookPanel) {
            const np = activeWidget;
            const editor = np.content.activeCell.editor;
            if (isSelectionEmpty(editor.getSelection())) {
                return getWholeNotebookContent(np);
            }
            else {
                return getSelectionInEditor(editor);
            }
        }
        else if (activeWidget instanceof FileEditorWidget) {
            const fe = activeWidget;
            const editor = fe.content.editor;
            if (isSelectionEmpty(editor.getSelection())) {
                return editor.model.sharedModel.getSource();
            }
            else {
                return getSelectionInEditor(editor);
            }
        }
        else {
            const dw = activeWidget;
            const content = (_b = (_a = dw === null || dw === void 0 ? void 0 : dw.context) === null || _a === void 0 ? void 0 : _a.model) === null || _b === void 0 ? void 0 : _b.toString();
            const maxContext = 0.5 * MAX_TOKENS;
            return content.substring(0, maxContext);
        }
    }
    static getCurrentCellContents() {
        const activeDocumentInfo = ActiveDocumentWatcher.activeDocumentInfo;
        const activeWidget = activeDocumentInfo.activeWidget;
        if (activeWidget instanceof NotebookPanel) {
            const np = activeWidget;
            const activeCell = np.content.activeCell;
            const input = activeCell.model.sharedModel.source.trim();
            let output = '';
            if (activeCell instanceof CodeCell) {
                output = cellOutputAsText(np.content.activeCell);
            }
            return { input, output };
        }
        return null;
    }
    static fireActiveDocumentChangedEvent() {
        document.dispatchEvent(new CustomEvent('copilotSidebar:activeDocumentChanged', {
            detail: {
                activeDocumentInfo: ActiveDocumentWatcher.activeDocumentInfo
            }
        }));
    }
}
ActiveDocumentWatcher.activeDocumentInfo = {
    language: 'python',
    filename: 'nb-doesnt-exist.ipynb',
    filePath: 'nb-doesnt-exist.ipynb',
    activeWidget: null,
    activeCellIndex: -1,
    selection: null
};
class NBIInlineCompletionProvider {
    constructor(telemetryEmitter) {
        this._lastRequestInfo = null;
        this._telemetryEmitter = telemetryEmitter;
    }
    get schema() {
        return {
            default: {
                debouncerDelay: 200,
                timeout: 15000
            }
        };
    }
    fetch(request, context) {
        let preContent = '';
        let postContent = '';
        const preCursor = request.text.substring(0, request.offset);
        const postCursor = request.text.substring(request.offset);
        let language = ActiveDocumentWatcher.activeDocumentInfo.language;
        let editorType = 'file-editor';
        if (context.widget instanceof NotebookPanel) {
            editorType = 'notebook';
            const activeCell = context.widget.content.activeCell;
            if (activeCell.model.sharedModel.cell_type === 'markdown') {
                language = 'markdown';
            }
            let activeCellReached = false;
            for (const cell of context.widget.content.widgets) {
                const cellModel = cell.model.sharedModel;
                if (cell === activeCell) {
                    activeCellReached = true;
                }
                else if (!activeCellReached) {
                    if (cellModel.cell_type === 'code') {
                        preContent += cellModel.source + '\n';
                    }
                    else if (cellModel.cell_type === 'markdown') {
                        preContent += markdownToComment(cellModel.source) + '\n';
                    }
                }
                else {
                    if (cellModel.cell_type === 'code') {
                        postContent += cellModel.source + '\n';
                    }
                    else if (cellModel.cell_type === 'markdown') {
                        postContent += markdownToComment(cellModel.source) + '\n';
                    }
                }
            }
        }
        const nbiConfig = NBIAPI.config;
        const inlineCompletionsEnabled = nbiConfig.inlineCompletionModel.provider === GITHUB_COPILOT_PROVIDER_ID
            ? NBIAPI.getLoginStatus() === GitHubCopilotLoginStatus.LoggedIn
            : nbiConfig.inlineCompletionModel.provider !== 'none';
        this._telemetryEmitter.emitTelemetryEvent({
            type: TelemetryEventType.InlineCompletionRequest,
            data: {
                inlineCompletionModel: {
                    provider: NBIAPI.config.inlineCompletionModel.provider,
                    model: NBIAPI.config.inlineCompletionModel.model
                },
                editorType
            }
        });
        return new Promise((resolve, reject) => {
            const items = [];
            if (!inlineCompletionsEnabled) {
                resolve({ items });
                return;
            }
            if (this._lastRequestInfo) {
                NBIAPI.sendWebSocketMessage(this._lastRequestInfo.messageId, RequestDataType.CancelInlineCompletionRequest, { chatId: this._lastRequestInfo.chatId });
            }
            const messageId = UUID.uuid4();
            const chatId = UUID.uuid4();
            this._lastRequestInfo = { chatId, messageId, requestTime: new Date() };
            NBIAPI.inlineCompletionsRequest(chatId, messageId, preContent + preCursor, postCursor + postContent, language, ActiveDocumentWatcher.activeDocumentInfo.filename, {
                emit: (response) => {
                    if (response.type === BackendMessageType.StreamMessage &&
                        response.id === this._lastRequestInfo.messageId) {
                        items.push({
                            insertText: response.data.completions
                        });
                        const timeElapsed = (new Date().getTime() -
                            this._lastRequestInfo.requestTime.getTime()) /
                            1000;
                        this._telemetryEmitter.emitTelemetryEvent({
                            type: TelemetryEventType.InlineCompletionResponse,
                            data: {
                                inlineCompletionModel: {
                                    provider: NBIAPI.config.inlineCompletionModel.provider,
                                    model: NBIAPI.config.inlineCompletionModel.model
                                },
                                timeElapsed
                            }
                        });
                        resolve({ items });
                    }
                    else {
                        reject();
                    }
                }
            });
        });
    }
    get name() {
        return 'Notebook Intelligence';
    }
    get identifier() {
        return '@notebook-intelligence/notebook-intelligence';
    }
    get icon() {
        return NBIAPI.config.usingGitHubCopilotModel
            ? githubCopilotIcon
            : sparkleIcon;
    }
}
class TelemetryEmitter {
    constructor() {
        this._listeners = new Set();
    }
    registerTelemetryListener(listener) {
        const listenerName = listener.name;
        if (listenerName !== BACKEND_TELEMETRY_LISTENER_NAME) {
            console.warn(`Notebook Intelligence telemetry listener '${listenerName}' registered. Make sure it is from a trusted source.`);
        }
        let listenerAlreadyExists = false;
        this._listeners.forEach(existingListener => {
            if (existingListener.name === listenerName) {
                listenerAlreadyExists = true;
            }
        });
        if (listenerAlreadyExists) {
            console.error(`Notebook Intelligence telemetry listener '${listenerName}' already exists!`);
            return;
        }
        this._listeners.add(listener);
    }
    unregisterTelemetryListener(listener) {
        this._listeners.delete(listener);
    }
    emitTelemetryEvent(event) {
        this._listeners.forEach(listener => {
            listener.onTelemetryEvent(event);
        });
    }
}
/**
 * Initialization data for the @notebook-intelligence/notebook-intelligence extension.
 */
const plugin = {
    id: '@notebook-intelligence/notebook-intelligence:plugin',
    description: 'Notebook Intelligence',
    autoStart: true,
    requires: [
        ICompletionProviderManager,
        IDocumentManager,
        IDefaultFileBrowser,
        IEditorLanguageRegistry,
        ICommandPalette,
        IMainMenu
    ],
    optional: [ISettingRegistry, IStatusBar],
    provides: INotebookIntelligence,
    activate: async (app, completionManager, docManager, defaultBrowser, languageRegistry, palette, mainMenu, settingRegistry, statusBar) => {
        console.log('JupyterLab extension @notebook-intelligence/notebook-intelligence is activated!');
        const telemetryEmitter = new TelemetryEmitter();
        telemetryEmitter.registerTelemetryListener({
            name: BACKEND_TELEMETRY_LISTENER_NAME,
            onTelemetryEvent: event => {
                NBIAPI.emitTelemetryEvent(event);
            }
        });
        const extensionService = {
            registerTelemetryListener: (listener) => {
                telemetryEmitter.registerTelemetryListener(listener);
            },
            unregisterTelemetryListener: (listener) => {
                telemetryEmitter.unregisterTelemetryListener(listener);
            }
        };
        await NBIAPI.initialize();
        let openPopover = null;
        completionManager.registerInlineProvider(new NBIInlineCompletionProvider(telemetryEmitter));
        if (settingRegistry) {
            settingRegistry
                .load(plugin.id)
                .then(settings => {
                //
            })
                .catch(reason => {
                console.error('Failed to load settings for @notebook-intelligence/notebook-intelligence.', reason);
            });
        }
        const waitForFileToBeActive = async (filePath) => {
            const isNotebook = filePath.endsWith('.ipynb');
            return new Promise((resolve, reject) => {
                const checkIfActive = () => {
                    const activeFilePath = ActiveDocumentWatcher.activeDocumentInfo.filePath;
                    const filePathToCheck = filePath;
                    const currentWidget = app.shell.currentWidget;
                    if (activeFilePath === filePathToCheck &&
                        ((isNotebook &&
                            currentWidget instanceof NotebookPanel &&
                            currentWidget.content.activeCell &&
                            currentWidget.content.activeCell.node.contains(document.activeElement)) ||
                            (!isNotebook &&
                                currentWidget instanceof FileEditorWidget &&
                                currentWidget.content.editor.hasFocus()))) {
                        resolve(true);
                    }
                    else {
                        setTimeout(checkIfActive, 200);
                    }
                };
                checkIfActive();
                waitForDuration(10000).then(() => {
                    resolve(false);
                });
            });
        };
        const panel = new Panel();
        panel.id = 'notebook-intelligence-tab';
        panel.title.caption = 'Notebook Intelligence';
        const sidebarIcon = new LabIcon({
            name: 'ui-components:palette',
            svgstr: sparklesSvgstr
        });
        panel.title.icon = sidebarIcon;
        const sidebar = new ChatSidebar({
            getActiveDocumentInfo: () => {
                return ActiveDocumentWatcher.activeDocumentInfo;
            },
            getActiveSelectionContent: () => {
                return ActiveDocumentWatcher.getActiveSelectionContent();
            },
            getCurrentCellContents: () => {
                return ActiveDocumentWatcher.getCurrentCellContents();
            },
            openFile: (path) => {
                docManager.openOrReveal(path);
            },
            getApp() {
                return app;
            },
            getTelemetryEmitter() {
                return telemetryEmitter;
            }
        });
        panel.addWidget(sidebar);
        app.shell.add(panel, 'left', { rank: 1000 });
        app.shell.activateById(panel.id);
        app.commands.addCommand(CommandIDs.chatuserInput, {
            execute: args => {
                NBIAPI.sendChatUserInput(args.id, args.data);
            }
        });
        app.commands.addCommand(CommandIDs.insertAtCursor, {
            execute: args => {
                const currentWidget = app.shell.currentWidget;
                if (currentWidget instanceof NotebookPanel) {
                    const activeCell = currentWidget.content.activeCell;
                    if (activeCell) {
                        applyCodeToSelectionInEditor(activeCell.editor, args.code);
                        return;
                    }
                }
                else if (currentWidget instanceof FileEditorWidget) {
                    applyCodeToSelectionInEditor(currentWidget.content.editor, args.code);
                    return;
                }
                app.commands.execute('apputils:notify', {
                    message: 'Failed to insert at cursor. Open a notebook or file to insert the code.',
                    type: 'error',
                    options: { autoClose: true }
                });
            }
        });
        app.commands.addCommand(CommandIDs.addCodeAsNewCell, {
            execute: args => {
                var _a;
                const currentWidget = app.shell.currentWidget;
                if (currentWidget instanceof NotebookPanel) {
                    let activeCellIndex = currentWidget.content.activeCellIndex;
                    activeCellIndex =
                        activeCellIndex === -1
                            ? currentWidget.content.widgets.length
                            : activeCellIndex + 1;
                    (_a = currentWidget.model) === null || _a === void 0 ? void 0 : _a.sharedModel.insertCell(activeCellIndex, {
                        cell_type: 'code',
                        metadata: { trusted: true },
                        source: args.code
                    });
                    currentWidget.content.activeCellIndex = activeCellIndex;
                }
                else {
                    app.commands.execute('apputils:notify', {
                        message: 'Open a notebook to insert the code as new cell',
                        type: 'error',
                        options: { autoClose: true }
                    });
                }
            }
        });
        app.commands.addCommand(CommandIDs.createNewFile, {
            execute: async (args) => {
                const contents = new ContentsManager();
                const newPyFile = await contents.newUntitled({
                    ext: '.py',
                    path: defaultBrowser === null || defaultBrowser === void 0 ? void 0 : defaultBrowser.model.path
                });
                contents.save(newPyFile.path, {
                    content: extractLLMGeneratedCode(args.code),
                    format: 'text',
                    type: 'file'
                });
                docManager.openOrReveal(newPyFile.path);
                await waitForFileToBeActive(newPyFile.path);
                return newPyFile;
            }
        });
        app.commands.addCommand(CommandIDs.createNewNotebookFromPython, {
            execute: async (args) => {
                var _a;
                let pythonKernelSpec = null;
                const contents = new ContentsManager();
                const kernels = new KernelSpecManager();
                await kernels.ready;
                const kernelspecs = (_a = kernels.specs) === null || _a === void 0 ? void 0 : _a.kernelspecs;
                if (kernelspecs) {
                    for (const key in kernelspecs) {
                        const kernelspec = kernelspecs[key];
                        if ((kernelspec === null || kernelspec === void 0 ? void 0 : kernelspec.language) === 'python') {
                            pythonKernelSpec = kernelspec;
                            break;
                        }
                    }
                }
                const newNBFile = await contents.newUntitled({
                    ext: '.ipynb',
                    path: defaultBrowser === null || defaultBrowser === void 0 ? void 0 : defaultBrowser.model.path
                });
                const nbFileContent = structuredClone(emptyNotebookContent);
                if (pythonKernelSpec) {
                    nbFileContent.metadata = {
                        kernelspec: {
                            language: 'python',
                            name: pythonKernelSpec.name,
                            display_name: pythonKernelSpec.display_name
                        }
                    };
                }
                if (args.code) {
                    nbFileContent.cells.push({
                        cell_type: 'code',
                        metadata: { trusted: true },
                        source: [args.code],
                        outputs: []
                    });
                }
                contents.save(newNBFile.path, {
                    content: nbFileContent,
                    format: 'json',
                    type: 'notebook'
                });
                docManager.openOrReveal(newNBFile.path);
                await waitForFileToBeActive(newNBFile.path);
                return newNBFile;
            }
        });
        const isNewEmptyNotebook = (model) => {
            return (model.cells.length === 1 &&
                model.cells[0].cell_type === 'code' &&
                model.cells[0].source === '');
        };
        const githubLoginRequired = () => {
            return (NBIAPI.config.usingGitHubCopilotModel &&
                NBIAPI.getLoginStatus() === GitHubCopilotLoginStatus.NotLoggedIn);
        };
        const isChatEnabled = () => {
            return NBIAPI.config.chatModel.provider === GITHUB_COPILOT_PROVIDER_ID
                ? !githubLoginRequired()
                : NBIAPI.config.chatModel.provider !== 'none';
        };
        const isActiveCellCodeCell = () => {
            if (!(app.shell.currentWidget instanceof NotebookPanel)) {
                return false;
            }
            const np = app.shell.currentWidget;
            const activeCell = np.content.activeCell;
            return activeCell instanceof CodeCell;
        };
        const isCurrentWidgetFileEditor = () => {
            return app.shell.currentWidget instanceof FileEditorWidget;
        };
        const addCellToNotebook = (filePath, cellType, source) => {
            const currentWidget = app.shell.currentWidget;
            const notebookOpen = currentWidget instanceof NotebookPanel &&
                currentWidget.sessionContext.path === filePath &&
                currentWidget.model;
            if (!notebookOpen) {
                app.commands.execute('apputils:notify', {
                    message: `Failed to access the notebook: ${filePath}`,
                    type: 'error',
                    options: { autoClose: true }
                });
                return false;
            }
            const model = currentWidget.model.sharedModel;
            const newCellIndex = isNewEmptyNotebook(model)
                ? 0
                : model.cells.length - 1;
            model.insertCell(newCellIndex, {
                cell_type: cellType,
                metadata: { trusted: true },
                source
            });
            return true;
        };
        app.commands.addCommand(CommandIDs.addCodeCellToNotebook, {
            execute: args => {
                return addCellToNotebook(args.path, 'code', args.code);
            }
        });
        app.commands.addCommand(CommandIDs.addMarkdownCellToNotebook, {
            execute: args => {
                return addCellToNotebook(args.path, 'markdown', args.markdown);
            }
        });
        app.commands.addCommand(CommandIDs.openGitHubCopilotLoginDialog, {
            execute: args => {
                let dialog = null;
                const dialogBody = new GitHubCopilotLoginDialogBody({
                    onLoggedIn: () => dialog === null || dialog === void 0 ? void 0 : dialog.dispose()
                });
                dialog = new Dialog({
                    title: 'GitHub Copilot Status',
                    hasClose: true,
                    body: dialogBody,
                    buttons: []
                });
                dialog.launch();
            }
        });
        app.commands.addCommand(CommandIDs.openConfigurationDialog, {
            label: 'Notebook Intelligence Settings',
            execute: args => {
                let dialog = null;
                const dialogBody = new ConfigurationDialogBody({
                    onSave: () => {
                        dialog === null || dialog === void 0 ? void 0 : dialog.dispose();
                        NBIAPI.fetchCapabilities();
                    }
                });
                dialog = new Dialog({
                    title: 'Notebook Intelligence Settings',
                    hasClose: true,
                    body: dialogBody,
                    buttons: []
                });
                dialog.node.classList.add('config-dialog-container');
                dialog.launch();
            }
        });
        palette.addItem({
            command: CommandIDs.openConfigurationDialog,
            category: 'Notebook Intelligence'
        });
        mainMenu.settingsMenu.addGroup([
            {
                command: CommandIDs.openConfigurationDialog
            }
        ]);
        const getPrefixAndSuffixForActiveCell = () => {
            let prefix = '';
            let suffix = '';
            const currentWidget = app.shell.currentWidget;
            if (!(currentWidget instanceof NotebookPanel &&
                currentWidget.content.activeCell)) {
                return { prefix, suffix };
            }
            const activeCellIndex = currentWidget.content.activeCellIndex;
            const numCells = currentWidget.content.widgets.length;
            const maxContext = 0.7 * MAX_TOKENS;
            for (let d = 1; d < numCells; ++d) {
                const above = activeCellIndex - d;
                const below = activeCellIndex + d;
                if ((above < 0 && below >= numCells) ||
                    getTokenCount(`${prefix} ${suffix}`) >= maxContext) {
                    break;
                }
                if (above >= 0) {
                    const aboveCell = currentWidget.content.widgets[above];
                    const cellModel = aboveCell.model.sharedModel;
                    if (cellModel.cell_type === 'code') {
                        prefix = cellModel.source + '\n' + prefix;
                    }
                    else if (cellModel.cell_type === 'markdown') {
                        prefix = markdownToComment(cellModel.source) + '\n' + prefix;
                    }
                }
                if (below < numCells) {
                    const belowCell = currentWidget.content.widgets[below];
                    const cellModel = belowCell.model.sharedModel;
                    if (cellModel.cell_type === 'code') {
                        suffix += cellModel.source + '\n';
                    }
                    else if (cellModel.cell_type === 'markdown') {
                        suffix += markdownToComment(cellModel.source) + '\n';
                    }
                }
            }
            return { prefix, suffix };
        };
        const getPrefixAndSuffixForFileEditor = () => {
            let prefix = '';
            let suffix = '';
            const currentWidget = app.shell.currentWidget;
            if (!(currentWidget instanceof FileEditorWidget)) {
                return { prefix, suffix };
            }
            const fe = currentWidget;
            const cursor = fe.content.editor.getCursorPosition();
            const offset = fe.content.editor.getOffsetAt(cursor);
            const source = fe.content.editor.model.sharedModel.getSource();
            prefix = source.substring(0, offset);
            suffix = source.substring(offset);
            return { prefix, suffix };
        };
        const generateCodeForCellOrFileEditor = () => {
            const isCodeCell = isActiveCellCodeCell();
            const currentWidget = app.shell.currentWidget;
            let editor;
            let codeInput = null;
            let scrollEl = null;
            if (isCodeCell) {
                const np = currentWidget;
                const activeCell = np.content.activeCell;
                codeInput = activeCell.node.querySelector('.jp-InputArea-editor');
                if (!codeInput) {
                    return;
                }
                scrollEl = np.node.querySelector('.jp-WindowedPanel-outer');
                editor = activeCell.editor;
            }
            else {
                const fe = currentWidget;
                codeInput = fe.node;
                scrollEl = fe.node.querySelector('.cm-scroller');
                editor = fe.content.editor;
            }
            const getRectAtCursor = () => {
                const selection = editor.getSelection();
                const line = Math.min(selection.end.line + 1, editor.lineCount - 1);
                const coords = editor.getCoordinateForPosition({
                    line,
                    column: selection.end.column
                });
                const editorRect = codeInput.getBoundingClientRect();
                if (!coords) {
                    return editorRect;
                }
                const yOffset = 30;
                const rect = new DOMRect(editorRect.left, coords.top - yOffset, editorRect.right - editorRect.left, coords.bottom - coords.top);
                return rect;
            };
            const rect = getRectAtCursor();
            const updatePopoverPosition = () => {
                if (openPopover !== null) {
                    const rect = getRectAtCursor();
                    openPopover.updatePosition(rect);
                }
            };
            const inputResizeObserver = new ResizeObserver(updatePopoverPosition);
            const addPositionListeners = () => {
                inputResizeObserver.observe(codeInput);
                if (scrollEl) {
                    scrollEl.addEventListener('scroll', updatePopoverPosition);
                }
            };
            const removePositionListeners = () => {
                inputResizeObserver.unobserve(codeInput);
                if (scrollEl) {
                    scrollEl.removeEventListener('scroll', updatePopoverPosition);
                }
            };
            const removePopover = () => {
                if (openPopover !== null) {
                    removePositionListeners();
                    openPopover = null;
                    Widget.detach(inlinePrompt);
                }
                if (isCodeCell) {
                    codeInput === null || codeInput === void 0 ? void 0 : codeInput.classList.remove('generating');
                }
            };
            let userPrompt = '';
            let existingCode = '';
            let generatedContent = '';
            let prefix = '', suffix = '';
            if (isCodeCell) {
                const ps = getPrefixAndSuffixForActiveCell();
                prefix = ps.prefix;
                suffix = ps.suffix;
            }
            else {
                const ps = getPrefixAndSuffixForFileEditor();
                prefix = ps.prefix;
                suffix = ps.suffix;
            }
            const selection = editor.getSelection();
            const startOffset = editor.getOffsetAt(selection.start);
            const endOffset = editor.getOffsetAt(selection.end);
            const source = editor.model.sharedModel.getSource();
            if (isCodeCell) {
                prefix += '\n' + source.substring(0, startOffset);
                existingCode = source.substring(startOffset, endOffset);
                suffix = source.substring(endOffset) + '\n' + suffix;
            }
            else {
                existingCode = source.substring(startOffset, endOffset);
            }
            const applyGeneratedCode = () => {
                generatedContent = extractLLMGeneratedCode(generatedContent);
                applyCodeToSelectionInEditor(editor, generatedContent);
                generatedContent = '';
                removePopover();
            };
            removePopover();
            const inlinePrompt = new InlinePromptWidget(rect, {
                prompt: userPrompt,
                existingCode,
                prefix: prefix,
                suffix: suffix,
                onRequestSubmitted: (prompt) => {
                    userPrompt = prompt;
                    generatedContent = '';
                    if (existingCode !== '') {
                        return;
                    }
                    removePopover();
                    if (isCodeCell) {
                        codeInput === null || codeInput === void 0 ? void 0 : codeInput.classList.add('generating');
                    }
                },
                onRequestCancelled: () => {
                    removePopover();
                    editor.focus();
                },
                onContentStream: (content) => {
                    if (existingCode !== '') {
                        return;
                    }
                    generatedContent += content;
                },
                onContentStreamEnd: () => {
                    if (existingCode !== '') {
                        return;
                    }
                    applyGeneratedCode();
                    editor.focus();
                },
                onUpdatedCodeChange: (content) => {
                    generatedContent = content;
                },
                onUpdatedCodeAccepted: () => {
                    applyGeneratedCode();
                    editor.focus();
                },
                telemetryEmitter: telemetryEmitter
            });
            openPopover = inlinePrompt;
            addPositionListeners();
            Widget.attach(inlinePrompt, document.body);
            telemetryEmitter.emitTelemetryEvent({
                type: TelemetryEventType.GenerateCodeRequest,
                data: {
                    chatModel: {
                        provider: NBIAPI.config.chatModel.provider,
                        model: NBIAPI.config.chatModel.model
                    },
                    editorType: isCodeCell ? 'notebook' : 'file-editor'
                }
            });
        };
        const generateCellCodeCommand = {
            execute: args => {
                generateCodeForCellOrFileEditor();
            },
            label: 'Generate code',
            isEnabled: () => isChatEnabled() &&
                (isActiveCellCodeCell() || isCurrentWidgetFileEditor())
        };
        app.commands.addCommand(CommandIDs.editorGenerateCode, generateCellCodeCommand);
        const copilotMenuCommands = new CommandRegistry();
        copilotMenuCommands.addCommand(CommandIDs.editorGenerateCode, generateCellCodeCommand);
        copilotMenuCommands.addCommand(CommandIDs.editorExplainThisCode, {
            execute: () => {
                const np = app.shell.currentWidget;
                const activeCell = np.content.activeCell;
                const content = (activeCell === null || activeCell === void 0 ? void 0 : activeCell.model.sharedModel.source) || '';
                document.dispatchEvent(new CustomEvent('copilotSidebar:runPrompt', {
                    detail: {
                        type: RunChatCompletionType.ExplainThis,
                        content,
                        language: ActiveDocumentWatcher.activeDocumentInfo.language,
                        filename: ActiveDocumentWatcher.activeDocumentInfo.filename
                    }
                }));
                app.commands.execute('tabsmenu:activate-by-id', { id: panel.id });
                telemetryEmitter.emitTelemetryEvent({
                    type: TelemetryEventType.ExplainThisRequest,
                    data: {
                        chatModel: {
                            provider: NBIAPI.config.chatModel.provider,
                            model: NBIAPI.config.chatModel.model
                        }
                    }
                });
            },
            label: 'Explain code',
            isEnabled: () => isChatEnabled() && isActiveCellCodeCell()
        });
        copilotMenuCommands.addCommand(CommandIDs.editorFixThisCode, {
            execute: () => {
                const np = app.shell.currentWidget;
                const activeCell = np.content.activeCell;
                const content = (activeCell === null || activeCell === void 0 ? void 0 : activeCell.model.sharedModel.source) || '';
                document.dispatchEvent(new CustomEvent('copilotSidebar:runPrompt', {
                    detail: {
                        type: RunChatCompletionType.FixThis,
                        content,
                        language: ActiveDocumentWatcher.activeDocumentInfo.language,
                        filename: ActiveDocumentWatcher.activeDocumentInfo.filename
                    }
                }));
                app.commands.execute('tabsmenu:activate-by-id', { id: panel.id });
                telemetryEmitter.emitTelemetryEvent({
                    type: TelemetryEventType.FixThisCodeRequest,
                    data: {
                        chatModel: {
                            provider: NBIAPI.config.chatModel.provider,
                            model: NBIAPI.config.chatModel.model
                        }
                    }
                });
            },
            label: 'Fix code',
            isEnabled: () => isChatEnabled() && isActiveCellCodeCell()
        });
        copilotMenuCommands.addCommand(CommandIDs.editorExplainThisOutput, {
            execute: () => {
                const np = app.shell.currentWidget;
                const activeCell = np.content.activeCell;
                if (!(activeCell instanceof CodeCell)) {
                    return;
                }
                const content = cellOutputAsText(activeCell);
                document.dispatchEvent(new CustomEvent('copilotSidebar:runPrompt', {
                    detail: {
                        type: RunChatCompletionType.ExplainThisOutput,
                        content,
                        language: ActiveDocumentWatcher.activeDocumentInfo.language,
                        filename: ActiveDocumentWatcher.activeDocumentInfo.filename
                    }
                }));
                app.commands.execute('tabsmenu:activate-by-id', { id: panel.id });
                telemetryEmitter.emitTelemetryEvent({
                    type: TelemetryEventType.ExplainThisOutputRequest,
                    data: {
                        chatModel: {
                            provider: NBIAPI.config.chatModel.provider,
                            model: NBIAPI.config.chatModel.model
                        }
                    }
                });
            },
            label: 'Explain output',
            isEnabled: () => {
                if (!(isChatEnabled() && app.shell.currentWidget instanceof NotebookPanel)) {
                    return false;
                }
                const np = app.shell.currentWidget;
                const activeCell = np.content.activeCell;
                if (!(activeCell instanceof CodeCell)) {
                    return false;
                }
                const outputs = activeCell.outputArea.model.toJSON();
                return Array.isArray(outputs) && outputs.length > 0;
            }
        });
        copilotMenuCommands.addCommand(CommandIDs.editorTroubleshootThisOutput, {
            execute: () => {
                const np = app.shell.currentWidget;
                const activeCell = np.content.activeCell;
                if (!(activeCell instanceof CodeCell)) {
                    return;
                }
                const content = cellOutputAsText(activeCell);
                document.dispatchEvent(new CustomEvent('copilotSidebar:runPrompt', {
                    detail: {
                        type: RunChatCompletionType.TroubleshootThisOutput,
                        content,
                        language: ActiveDocumentWatcher.activeDocumentInfo.language,
                        filename: ActiveDocumentWatcher.activeDocumentInfo.filename
                    }
                }));
                app.commands.execute('tabsmenu:activate-by-id', { id: panel.id });
                telemetryEmitter.emitTelemetryEvent({
                    type: TelemetryEventType.TroubleshootThisOutputRequest,
                    data: {
                        chatModel: {
                            provider: NBIAPI.config.chatModel.provider,
                            model: NBIAPI.config.chatModel.model
                        }
                    }
                });
            },
            label: 'Troubleshoot errors in output',
            isEnabled: () => {
                if (!(isChatEnabled() && app.shell.currentWidget instanceof NotebookPanel)) {
                    return false;
                }
                const np = app.shell.currentWidget;
                const activeCell = np.content.activeCell;
                if (!(activeCell instanceof CodeCell)) {
                    return false;
                }
                const outputs = activeCell.outputArea.model.toJSON();
                return (Array.isArray(outputs) &&
                    outputs.length > 0 &&
                    outputs.some(output => output.output_type === 'error'));
            }
        });
        const copilotContextMenu = new Menu({ commands: copilotMenuCommands });
        copilotContextMenu.id = 'notebook-intelligence:editor-context-menu';
        copilotContextMenu.title.label = 'Copilot';
        copilotContextMenu.title.icon = sidebarIcon;
        copilotContextMenu.addItem({ command: CommandIDs.editorGenerateCode });
        copilotContextMenu.addItem({ command: CommandIDs.editorExplainThisCode });
        copilotContextMenu.addItem({ command: CommandIDs.editorFixThisCode });
        copilotContextMenu.addItem({ command: CommandIDs.editorExplainThisOutput });
        copilotContextMenu.addItem({
            command: CommandIDs.editorTroubleshootThisOutput
        });
        app.contextMenu.addItem({
            type: 'submenu',
            submenu: copilotContextMenu,
            selector: '.jp-Editor',
            rank: 1
        });
        app.contextMenu.addItem({
            type: 'submenu',
            submenu: copilotContextMenu,
            selector: '.jp-OutputArea-child',
            rank: 1
        });
        if (statusBar) {
            const githubCopilotStatusBarItem = new GitHubCopilotStatusBarItem({
                getApp: () => app
            });
            statusBar.registerStatusItem('notebook-intelligence:github-copilot-status', {
                item: githubCopilotStatusBarItem,
                align: 'right',
                rank: 100,
                isActive: () => NBIAPI.config.usingGitHubCopilotModel
            });
            NBIAPI.configChanged.connect(() => {
                if (NBIAPI.config.usingGitHubCopilotModel) {
                    githubCopilotStatusBarItem.show();
                }
                else {
                    githubCopilotStatusBarItem.hide();
                }
            });
        }
        const jlabApp = app;
        ActiveDocumentWatcher.initialize(jlabApp, languageRegistry);
        return extensionService;
    }
};
export * from './tokens';
export default plugin;
