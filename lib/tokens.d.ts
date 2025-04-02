import { Widget } from '@lumino/widgets';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { Token } from '@lumino/coreutils';
export interface IActiveDocumentInfo {
    activeWidget: Widget | null;
    language: string;
    filename: string;
    filePath: string;
    activeCellIndex: number;
    selection?: CodeEditor.IRange;
}
export interface IChatCompletionResponseEmitter {
    emit: (response: any) => void;
}
export declare enum RequestDataType {
    ChatRequest = "chat-request",
    ChatUserInput = "chat-user-input",
    ClearChatHistory = "clear-chat-history",
    RunUICommandResponse = "run-ui-command-response",
    GenerateCode = "generate-code",
    CancelChatRequest = "cancel-chat-request",
    InlineCompletionRequest = "inline-completion-request",
    CancelInlineCompletionRequest = "cancel-inline-completion-request"
}
export declare enum BackendMessageType {
    StreamMessage = "stream-message",
    StreamEnd = "stream-end",
    RunUICommand = "run-ui-command"
}
export declare enum ResponseStreamDataType {
    LLMRaw = "llm-raw",
    Markdown = "markdown",
    MarkdownPart = "markdown-part",
    Image = "image",
    HTMLFrame = "html-frame",
    Button = "button",
    Anchor = "anchor",
    Progress = "progress",
    Confirmation = "confirmation"
}
export declare enum ContextType {
    Custom = "custom",
    CurrentFile = "current-file"
}
export interface IContextItem {
    type: ContextType;
    content: string;
    currentCellContents: ICellContents;
    filePath?: string;
    cellIndex?: number;
    startLine?: number;
    endLine?: number;
}
export interface ICellContents {
    input: string;
    output: string;
}
export interface IChatParticipant {
    id: string;
    name: string;
    description: string;
    iconPath: string;
    commands: string[];
}
export declare const GITHUB_COPILOT_PROVIDER_ID = "github-copilot";
export declare enum TelemetryEventType {
    InlineCompletionRequest = "inline-completion-request",
    ExplainThisRequest = "explain-this-request",
    FixThisCodeRequest = "fix-this-code-request",
    ExplainThisOutputRequest = "explain-this-output-request",
    TroubleshootThisOutputRequest = "troubleshoot-this-output-request",
    GenerateCodeRequest = "generate-code-request",
    ChatRequest = "chat-request",
    InlineChatRequest = "inline-chat-request",
    ChatResponse = "chat-response",
    InlineChatResponse = "inline-chat-response",
    InlineCompletionResponse = "inline-completion-response"
}
export interface ITelemetryEvent {
    type: TelemetryEventType;
    data?: any;
}
export interface ITelemetryListener {
    get name(): string;
    onTelemetryEvent: (event: ITelemetryEvent) => void;
}
export interface ITelemetryEmitter {
    emitTelemetryEvent(event: ITelemetryEvent): void;
}
export declare const INotebookIntelligence: Token<INotebookIntelligence>;
export interface INotebookIntelligence {
    registerTelemetryListener: (listener: ITelemetryListener) => void;
    unregisterTelemetryListener: (listener: ITelemetryListener) => void;
}
