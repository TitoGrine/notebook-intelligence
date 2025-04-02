/// <reference types="react" />
import { ReactWidget } from '@jupyterlab/apputils';
import { IActiveDocumentInfo, ICellContents, IContextItem, ITelemetryEmitter } from './tokens';
import { JupyterFrontEnd } from '@jupyterlab/application';
export declare enum RunChatCompletionType {
    Chat = 0,
    ExplainThis = 1,
    FixThis = 2,
    GenerateCode = 3,
    ExplainThisOutput = 4,
    TroubleshootThisOutput = 5
}
export interface IRunChatCompletionRequest {
    messageId: string;
    chatId: string;
    type: RunChatCompletionType;
    content: string;
    language?: string;
    filename?: string;
    prefix?: string;
    suffix?: string;
    existingCode?: string;
    additionalContext?: IContextItem[];
}
export interface IChatSidebarOptions {
    getActiveDocumentInfo: () => IActiveDocumentInfo;
    getActiveSelectionContent: () => string;
    getCurrentCellContents: () => ICellContents;
    openFile: (path: string) => void;
    getApp: () => JupyterFrontEnd;
    getTelemetryEmitter: () => ITelemetryEmitter;
}
export declare class ChatSidebar extends ReactWidget {
    constructor(options: IChatSidebarOptions);
    render(): JSX.Element;
    private _options;
}
export interface IInlinePromptWidgetOptions {
    prompt: string;
    existingCode: string;
    prefix: string;
    suffix: string;
    onRequestSubmitted: (prompt: string) => void;
    onRequestCancelled: () => void;
    onContentStream: (content: string) => void;
    onContentStreamEnd: () => void;
    onUpdatedCodeChange: (content: string) => void;
    onUpdatedCodeAccepted: () => void;
    telemetryEmitter: ITelemetryEmitter;
}
export declare class InlinePromptWidget extends ReactWidget {
    constructor(rect: DOMRect, options: IInlinePromptWidgetOptions);
    updatePosition(rect: DOMRect): void;
    _onResponse(response: any): void;
    _onRequestSubmitted(prompt: string): void;
    render(): JSX.Element;
    private _options;
    private _requestTime;
}
export declare class GitHubCopilotStatusBarItem extends ReactWidget {
    constructor(options: {
        getApp: () => JupyterFrontEnd;
    });
    render(): JSX.Element;
    private _getApp;
}
export declare class GitHubCopilotLoginDialogBody extends ReactWidget {
    constructor(options: {
        onLoggedIn: () => void;
    });
    render(): JSX.Element;
    private _onLoggedIn;
}
export declare class ConfigurationDialogBody extends ReactWidget {
    constructor(options: {
        onSave: () => void;
    });
    render(): JSX.Element;
    private _onSave;
}
