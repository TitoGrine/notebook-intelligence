// Copyright (c) Mehmet Bektas <mbektasgh@outlook.com>
import { Token } from '@lumino/coreutils';
export var RequestDataType;
(function (RequestDataType) {
    RequestDataType["ChatRequest"] = "chat-request";
    RequestDataType["ChatUserInput"] = "chat-user-input";
    RequestDataType["ClearChatHistory"] = "clear-chat-history";
    RequestDataType["RunUICommandResponse"] = "run-ui-command-response";
    RequestDataType["GenerateCode"] = "generate-code";
    RequestDataType["CancelChatRequest"] = "cancel-chat-request";
    RequestDataType["InlineCompletionRequest"] = "inline-completion-request";
    RequestDataType["CancelInlineCompletionRequest"] = "cancel-inline-completion-request";
})(RequestDataType || (RequestDataType = {}));
export var BackendMessageType;
(function (BackendMessageType) {
    BackendMessageType["StreamMessage"] = "stream-message";
    BackendMessageType["StreamEnd"] = "stream-end";
    BackendMessageType["RunUICommand"] = "run-ui-command";
})(BackendMessageType || (BackendMessageType = {}));
export var ResponseStreamDataType;
(function (ResponseStreamDataType) {
    ResponseStreamDataType["LLMRaw"] = "llm-raw";
    ResponseStreamDataType["Markdown"] = "markdown";
    ResponseStreamDataType["MarkdownPart"] = "markdown-part";
    ResponseStreamDataType["Image"] = "image";
    ResponseStreamDataType["HTMLFrame"] = "html-frame";
    ResponseStreamDataType["Button"] = "button";
    ResponseStreamDataType["Anchor"] = "anchor";
    ResponseStreamDataType["Progress"] = "progress";
    ResponseStreamDataType["Confirmation"] = "confirmation";
})(ResponseStreamDataType || (ResponseStreamDataType = {}));
export var ContextType;
(function (ContextType) {
    ContextType["Custom"] = "custom";
    ContextType["CurrentFile"] = "current-file";
})(ContextType || (ContextType = {}));
export const GITHUB_COPILOT_PROVIDER_ID = 'github-copilot';
export var TelemetryEventType;
(function (TelemetryEventType) {
    TelemetryEventType["InlineCompletionRequest"] = "inline-completion-request";
    TelemetryEventType["ExplainThisRequest"] = "explain-this-request";
    TelemetryEventType["FixThisCodeRequest"] = "fix-this-code-request";
    TelemetryEventType["ExplainThisOutputRequest"] = "explain-this-output-request";
    TelemetryEventType["TroubleshootThisOutputRequest"] = "troubleshoot-this-output-request";
    TelemetryEventType["GenerateCodeRequest"] = "generate-code-request";
    TelemetryEventType["ChatRequest"] = "chat-request";
    TelemetryEventType["InlineChatRequest"] = "inline-chat-request";
    TelemetryEventType["ChatResponse"] = "chat-response";
    TelemetryEventType["InlineChatResponse"] = "inline-chat-response";
    TelemetryEventType["InlineCompletionResponse"] = "inline-completion-response";
})(TelemetryEventType || (TelemetryEventType = {}));
export const INotebookIntelligence = new Token('@notebook-intelligence/notebook-intelligence:INotebookIntelligence', 'AI coding assistant for JupyterLab.');
