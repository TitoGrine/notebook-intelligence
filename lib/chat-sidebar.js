// Copyright (c) Mehmet Bektas <mbektasgh@outlook.com>
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { UUID } from '@lumino/coreutils';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import { NBIAPI, GitHubCopilotLoginStatus } from './api';
import { BackendMessageType, ContextType, GITHUB_COPILOT_PROVIDER_ID, RequestDataType, ResponseStreamDataType, TelemetryEventType } from './tokens';
import { MarkdownRenderer } from './markdown-renderer';
import copySvgstr from '../style/icons/copy.svg';
import copilotSvgstr from '../style/icons/copilot.svg';
import copilotWarningSvgstr from '../style/icons/copilot-warning.svg';
import { VscSend, VscStopCircle, VscEye, VscEyeClosed, VscTriangleRight, VscTriangleDown } from 'react-icons/vsc';
import { extractLLMGeneratedCode, isDarkTheme } from './utils';
const OPENAI_COMPATIBLE_CHAT_MODEL_ID = 'openai-compatible-chat-model';
const LITELLM_COMPATIBLE_CHAT_MODEL_ID = 'litellm-compatible-chat-model';
const OPENAI_COMPATIBLE_INLINE_COMPLETION_MODEL_ID = 'openai-compatible-inline-completion-model';
const LITELLM_COMPATIBLE_INLINE_COMPLETION_MODEL_ID = 'litellm-compatible-inline-completion-model';
export var RunChatCompletionType;
(function (RunChatCompletionType) {
    RunChatCompletionType[RunChatCompletionType["Chat"] = 0] = "Chat";
    RunChatCompletionType[RunChatCompletionType["ExplainThis"] = 1] = "ExplainThis";
    RunChatCompletionType[RunChatCompletionType["FixThis"] = 2] = "FixThis";
    RunChatCompletionType[RunChatCompletionType["GenerateCode"] = 3] = "GenerateCode";
    RunChatCompletionType[RunChatCompletionType["ExplainThisOutput"] = 4] = "ExplainThisOutput";
    RunChatCompletionType[RunChatCompletionType["TroubleshootThisOutput"] = 5] = "TroubleshootThisOutput";
})(RunChatCompletionType || (RunChatCompletionType = {}));
export class ChatSidebar extends ReactWidget {
    constructor(options) {
        super();
        this._options = options;
        this.node.style.height = '100%';
    }
    render() {
        return (React.createElement(SidebarComponent, { getActiveDocumentInfo: this._options.getActiveDocumentInfo, getActiveSelectionContent: this._options.getActiveSelectionContent, getCurrentCellContents: this._options.getCurrentCellContents, openFile: this._options.openFile, getApp: this._options.getApp, getTelemetryEmitter: this._options.getTelemetryEmitter }));
    }
}
export class InlinePromptWidget extends ReactWidget {
    constructor(rect, options) {
        super();
        this.node.classList.add('inline-prompt-widget');
        this.node.style.top = `${rect.top + 32}px`;
        this.node.style.left = `${rect.left}px`;
        this.node.style.width = rect.width + 'px';
        this.node.style.height = '48px';
        this._options = options;
        this.node.addEventListener('focusout', (event) => {
            if (this.node.contains(event.relatedTarget)) {
                return;
            }
            this._options.onRequestCancelled();
        });
    }
    updatePosition(rect) {
        this.node.style.top = `${rect.top + 32}px`;
        this.node.style.left = `${rect.left}px`;
        this.node.style.width = rect.width + 'px';
    }
    _onResponse(response) {
        var _a, _b, _c, _d, _e;
        if (response.type === BackendMessageType.StreamMessage) {
            const delta = (_b = (_a = response.data['choices']) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b['delta'];
            if (!delta) {
                return;
            }
            const responseMessage = (_e = (_d = (_c = response.data['choices']) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d['delta']) === null || _e === void 0 ? void 0 : _e['content'];
            if (!responseMessage) {
                return;
            }
            this._options.onContentStream(responseMessage);
        }
        else if (response.type === BackendMessageType.StreamEnd) {
            this._options.onContentStreamEnd();
            const timeElapsed = (new Date().getTime() - this._requestTime.getTime()) / 1000;
            this._options.telemetryEmitter.emitTelemetryEvent({
                type: TelemetryEventType.InlineChatResponse,
                data: {
                    chatModel: {
                        provider: NBIAPI.config.chatModel.provider,
                        model: NBIAPI.config.chatModel.model
                    },
                    timeElapsed
                }
            });
        }
    }
    _onRequestSubmitted(prompt) {
        // code update
        if (this._options.existingCode !== '') {
            this.node.style.height = '300px';
        }
        // save the prompt in case of a rerender
        this._options.prompt = prompt;
        this._options.onRequestSubmitted(prompt);
        this._requestTime = new Date();
        this._options.telemetryEmitter.emitTelemetryEvent({
            type: TelemetryEventType.InlineChatRequest,
            data: {
                chatModel: {
                    provider: NBIAPI.config.chatModel.provider,
                    model: NBIAPI.config.chatModel.model
                },
                prompt: prompt
            }
        });
    }
    render() {
        return (React.createElement(InlinePopoverComponent, { prompt: this._options.prompt, existingCode: this._options.existingCode, onRequestSubmitted: this._onRequestSubmitted.bind(this), onRequestCancelled: this._options.onRequestCancelled, onResponseEmit: this._onResponse.bind(this), prefix: this._options.prefix, suffix: this._options.suffix, onUpdatedCodeChange: this._options.onUpdatedCodeChange, onUpdatedCodeAccepted: this._options.onUpdatedCodeAccepted }));
    }
}
export class GitHubCopilotStatusBarItem extends ReactWidget {
    constructor(options) {
        super();
        this._getApp = options.getApp;
    }
    render() {
        return React.createElement(GitHubCopilotStatusComponent, { getApp: this._getApp });
    }
}
export class GitHubCopilotLoginDialogBody extends ReactWidget {
    constructor(options) {
        super();
        this._onLoggedIn = options.onLoggedIn;
    }
    render() {
        return (React.createElement(GitHubCopilotLoginDialogBodyComponent, { onLoggedIn: () => this._onLoggedIn() }));
    }
}
export class ConfigurationDialogBody extends ReactWidget {
    constructor(options) {
        super();
        this._onSave = options.onSave;
    }
    render() {
        return React.createElement(ConfigurationDialogBodyComponent, { onSave: this._onSave });
    }
}
const answeredForms = new Map();
function ChatResponseHTMLFrame(props) {
    const iframSrc = useMemo(() => URL.createObjectURL(new Blob([props.source], { type: 'text/html' })), []);
    return (React.createElement("div", { className: "chat-response-html-frame", key: `key-${props.index}` },
        React.createElement("iframe", { className: "chat-response-html-frame-iframe", height: props.height, sandbox: "allow-scripts", src: iframSrc })));
}
function ChatResponse(props) {
    var _a, _b, _c;
    const [renderCount, setRenderCount] = useState(0);
    const msg = props.message;
    const timestamp = msg.date.toLocaleTimeString('en-US', { hour12: false });
    const openNotebook = (event) => {
        const notebookPath = event.target.dataset['ref'];
        props.openFile(notebookPath);
    };
    const markFormConfirmed = (contentId) => {
        answeredForms.set(contentId, 'confirmed');
    };
    const markFormCanceled = (contentId) => {
        answeredForms.set(contentId, 'canceled');
    };
    const runCommand = (commandId, args) => {
        props.getApp().commands.execute(commandId, args);
    };
    // group messages by type
    const groupedContents = [];
    let lastItemType;
    const extractReasoningContent = (item) => {
        let currentContent = item.content;
        if (typeof currentContent !== 'string') {
            return false;
        }
        let reasoningContent = '';
        let reasoningStartTime = new Date();
        const reasoningEndTime = new Date();
        const startPos = currentContent.indexOf('<think>');
        const hasStart = startPos >= 0;
        reasoningStartTime = new Date(item.created);
        if (hasStart) {
            currentContent = currentContent.substring(startPos + 7);
        }
        const endPos = currentContent.indexOf('</think>');
        const hasEnd = endPos >= 0;
        if (hasEnd) {
            reasoningContent += currentContent.substring(0, endPos);
            currentContent = currentContent.substring(endPos + 8);
        }
        else {
            if (hasStart) {
                reasoningContent += currentContent;
                currentContent = '';
            }
        }
        item.content = currentContent;
        item.reasoningContent = reasoningContent;
        item.reasoningFinished = hasEnd;
        item.reasoningTime =
            (reasoningEndTime.getTime() - reasoningStartTime.getTime()) / 1000;
        return hasStart && !hasEnd; // is thinking
    };
    for (let i = 0; i < msg.contents.length; i++) {
        const item = msg.contents[i];
        if (item.type === lastItemType &&
            lastItemType === ResponseStreamDataType.MarkdownPart) {
            const lastItem = groupedContents[groupedContents.length - 1];
            lastItem.content += item.content;
        }
        else {
            groupedContents.push(structuredClone(item));
            lastItemType = item.type;
        }
    }
    const [thinkingInProgress, setThinkingInProgress] = useState(false);
    for (const item of groupedContents) {
        const isThinking = extractReasoningContent(item);
        if (isThinking && !thinkingInProgress) {
            setThinkingInProgress(true);
        }
    }
    useEffect(() => {
        let intervalId = undefined;
        if (thinkingInProgress) {
            intervalId = setInterval(() => {
                setRenderCount(prev => prev + 1);
                setThinkingInProgress(false);
            }, 1000);
        }
        return () => clearInterval(intervalId);
    }, [thinkingInProgress]);
    const onExpandCollapseClick = (event) => {
        const parent = event.currentTarget.parentElement;
        if (parent.classList.contains('expanded')) {
            parent.classList.remove('expanded');
        }
        else {
            parent.classList.add('expanded');
        }
    };
    return (React.createElement("div", { className: `chat-message chat-message-${msg.from}`, "data-render-count": renderCount },
        React.createElement("div", { className: "chat-message-header" },
            React.createElement("div", { className: "chat-message-from" },
                ((_a = msg.participant) === null || _a === void 0 ? void 0 : _a.iconPath) && (React.createElement("div", { className: `chat-message-from-icon ${((_b = msg.participant) === null || _b === void 0 ? void 0 : _b.id) === 'default' ? 'chat-message-from-icon-default' : ''} ${isDarkTheme() ? 'dark' : ''}` },
                    React.createElement("img", { src: msg.participant.iconPath }))),
                React.createElement("div", { className: "chat-message-from-title" }, msg.from === 'user' ? 'User' : ((_c = msg.participant) === null || _c === void 0 ? void 0 : _c.name) || 'Copilot'),
                React.createElement("div", { className: "chat-message-from-progress", style: { display: `${props.showGenerating ? 'visible' : 'none'}` } },
                    React.createElement("div", { className: "loading-ellipsis" }, "Generating"))),
            React.createElement("div", { className: "chat-message-timestamp" }, timestamp)),
        React.createElement("div", { className: "chat-message-content" },
            groupedContents.map((item, index) => {
                switch (item.type) {
                    case ResponseStreamDataType.Markdown:
                    case ResponseStreamDataType.MarkdownPart:
                        return (React.createElement(React.Fragment, null,
                            item.reasoningContent && (React.createElement("div", { className: "chat-reasoning-content" },
                                React.createElement("div", { className: "chat-reasoning-content-title", onClick: (event) => onExpandCollapseClick(event) },
                                    React.createElement(VscTriangleRight, { className: "collapsed-icon" }),
                                    React.createElement(VscTriangleDown, { className: "expanded-icon" }),
                                    ' ',
                                    item.reasoningFinished
                                        ? 'Thought'
                                        : `Thinking (${Math.floor(item.reasoningTime)} s)`),
                                React.createElement("div", { className: "chat-reasoning-content-text" },
                                    React.createElement(MarkdownRenderer, { key: `key-${index}`, getApp: props.getApp, getActiveDocumentInfo: props.getActiveDocumentInfo }, item.reasoningContent)))),
                            React.createElement(MarkdownRenderer, { key: `key-${index}`, getApp: props.getApp, getActiveDocumentInfo: props.getActiveDocumentInfo }, item.content)));
                    case ResponseStreamDataType.Image:
                        return (React.createElement("div", { className: "chat-response-img", key: `key-${index}` },
                            React.createElement("img", { src: item.content })));
                    case ResponseStreamDataType.HTMLFrame:
                        return (React.createElement(ChatResponseHTMLFrame, { index: index, source: item.content.source, height: item.content.height }));
                    case ResponseStreamDataType.Button:
                        return (React.createElement("div", { className: "chat-response-button", key: `key-${index}` },
                            React.createElement("button", { className: "jp-Dialog-button jp-mod-accept jp-mod-styled", onClick: () => runCommand(item.content.commandId, item.content.args) },
                                React.createElement("div", { className: "jp-Dialog-buttonLabel" }, item.content.title))));
                    case ResponseStreamDataType.Anchor:
                        return (React.createElement("div", { className: "chat-response-anchor", key: `key-${index}` },
                            React.createElement("a", { href: item.content.uri, target: "_blank" }, item.content.title)));
                    case ResponseStreamDataType.Progress:
                        // show only if no more message available
                        return index === groupedContents.length - 1 ? (React.createElement("div", { key: `key-${index}` },
                            "\u2713 ",
                            item.content)) : null;
                    case ResponseStreamDataType.Confirmation:
                        return answeredForms.get(item.id) ===
                            'confirmed' ? null : answeredForms.get(item.id) ===
                            'canceled' ? (React.createElement("div", null, "\u2716 Canceled")) : (React.createElement("div", { className: "chat-confirmation-form", key: `key-${index}` },
                            item.content.title ? (React.createElement("div", null,
                                React.createElement("b", null, item.content.title))) : null,
                            item.content.message ? (React.createElement("div", null, item.content.message)) : null,
                            React.createElement("button", { className: "jp-Dialog-button jp-mod-accept jp-mod-styled", onClick: () => {
                                    markFormConfirmed(item.id);
                                    runCommand('notebook-intelligence:chat-user-input', item.content.confirmArgs);
                                } },
                                React.createElement("div", { className: "jp-Dialog-buttonLabel" }, item.content.confirmLabel)),
                            React.createElement("button", { className: "jp-Dialog-button jp-mod-reject jp-mod-styled", onClick: () => {
                                    markFormCanceled(item.id);
                                    runCommand('notebook-intelligence:chat-user-input', item.content.cancelArgs);
                                } },
                                React.createElement("div", { className: "jp-Dialog-buttonLabel" }, item.content.cancelLabel))));
                }
                return null;
            }),
            msg.notebookLink && (React.createElement("a", { className: "copilot-generated-notebook-link", "data-ref": msg.notebookLink, onClick: openNotebook }, "open notebook")))));
}
async function submitCompletionRequest(request, responseEmitter) {
    switch (request.type) {
        case RunChatCompletionType.Chat:
            return NBIAPI.chatRequest(request.messageId, request.chatId, request.content, request.language || 'python', request.filename || 'Untitled.ipynb', request.additionalContext || [], responseEmitter);
        case RunChatCompletionType.ExplainThis:
        case RunChatCompletionType.FixThis:
        case RunChatCompletionType.ExplainThisOutput:
        case RunChatCompletionType.TroubleshootThisOutput: {
            return NBIAPI.chatRequest(request.messageId, request.chatId, request.content, request.language || 'python', request.filename || 'Untitled.ipynb', [], responseEmitter);
        }
        case RunChatCompletionType.GenerateCode:
            return NBIAPI.generateCode(request.chatId, request.content, request.prefix || '', request.suffix || '', request.existingCode || '', request.language || 'python', request.filename || 'Untitled.ipynb', responseEmitter);
    }
}
function SidebarComponent(props) {
    const [chatMessages, setChatMessages] = useState([]);
    const [prompt, setPrompt] = useState('');
    const [draftPrompt, setDraftPrompt] = useState('');
    const messagesEndRef = useRef(null);
    const [ghLoginStatus, setGHLoginStatus] = useState(GitHubCopilotLoginStatus.NotLoggedIn);
    const [loginClickCount, _setLoginClickCount] = useState(0);
    const [copilotRequestInProgress, setCopilotRequestInProgress] = useState(false);
    const [showPopover, setShowPopover] = useState(false);
    const [originalPrefixes, setOriginalPrefixes] = useState([]);
    const [prefixSuggestions, setPrefixSuggestions] = useState([]);
    const [selectedPrefixSuggestionIndex, setSelectedPrefixSuggestionIndex] = useState(0);
    const promptInputRef = useRef(null);
    const [promptHistory, setPromptHistory] = useState([]);
    // position on prompt history stack
    const [promptHistoryIndex, setPromptHistoryIndex] = useState(0);
    const [chatId, setChatId] = useState(UUID.uuid4());
    const lastMessageId = useRef('');
    const lastRequestTime = useRef(new Date());
    const [contextOn, setContextOn] = useState(false);
    const [activeDocumentInfo, setActiveDocumentInfo] = useState(null);
    const [currentFileContextTitle, setCurrentFileContextTitle] = useState('');
    const telemetryEmitter = props.getTelemetryEmitter();
    useEffect(() => {
        const prefixes = [];
        const chatParticipants = NBIAPI.config.chatParticipants;
        for (const participant of chatParticipants) {
            const id = participant.id;
            const commands = participant.commands;
            const participantPrefix = id === 'default' ? '' : `@${id}`;
            if (participantPrefix !== '') {
                prefixes.push(participantPrefix);
            }
            const commandPrefix = participantPrefix === '' ? '' : `${participantPrefix} `;
            for (const command of commands) {
                prefixes.push(`${commandPrefix}/${command}`);
            }
        }
        setOriginalPrefixes(prefixes);
        setPrefixSuggestions(prefixes);
    }, []);
    useEffect(() => {
        const fetchData = () => {
            setGHLoginStatus(NBIAPI.getLoginStatus());
        };
        fetchData();
        const intervalId = setInterval(fetchData, 1000);
        return () => clearInterval(intervalId);
    }, [loginClickCount]);
    useEffect(() => {
        setSelectedPrefixSuggestionIndex(0);
    }, [prefixSuggestions]);
    const onPromptChange = (event) => {
        const newPrompt = event.target.value;
        setPrompt(newPrompt);
        const trimmedPrompt = newPrompt.trimStart();
        if (trimmedPrompt === '@' || trimmedPrompt === '/') {
            setShowPopover(true);
            filterPrefixSuggestions(trimmedPrompt);
        }
        else if (trimmedPrompt.startsWith('@') ||
            trimmedPrompt.startsWith('/') ||
            trimmedPrompt === '') {
            filterPrefixSuggestions(trimmedPrompt);
        }
        else {
            setShowPopover(false);
        }
    };
    const applyPrefixSuggestion = (prefix) => {
        var _a;
        if (prefix.includes(prompt)) {
            setPrompt(`${prefix} `);
        }
        else {
            setPrompt(`${prefix} ${prompt} `);
        }
        setShowPopover(false);
        (_a = promptInputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        setSelectedPrefixSuggestionIndex(0);
    };
    const prefixSuggestionSelected = (event) => {
        const prefix = event.target.dataset['value'];
        applyPrefixSuggestion(prefix);
    };
    const handleSubmitStopChatButtonClick = async () => {
        if (!copilotRequestInProgress) {
            handleUserInputSubmit();
        }
        else {
            handleUserInputCancel();
        }
    };
    const handleUserInputSubmit = async () => {
        setPromptHistoryIndex(promptHistory.length + 1);
        setPromptHistory([...promptHistory, prompt]);
        setShowPopover(false);
        const promptPrefixParts = [];
        const promptParts = prompt.split(' ');
        if (promptParts.length > 1) {
            for (let i = 0; i < Math.min(promptParts.length, 2); i++) {
                const part = promptParts[i];
                if (part.startsWith('@') || part.startsWith('/')) {
                    promptPrefixParts.push(part);
                }
            }
        }
        const promptPrefix = promptPrefixParts.length > 0 ? promptPrefixParts.join(' ') + ' ' : '';
        lastMessageId.current = UUID.uuid4();
        lastRequestTime.current = new Date();
        const newList = [
            ...chatMessages,
            {
                id: lastMessageId.current,
                date: new Date(),
                from: 'user',
                contents: [
                    {
                        id: UUID.uuid4(),
                        type: ResponseStreamDataType.Markdown,
                        content: prompt,
                        created: new Date()
                    }
                ]
            }
        ];
        setChatMessages(newList);
        if (prompt.startsWith('/clear')) {
            setChatMessages([]);
            setPrompt('');
            resetChatId();
            resetPrefixSuggestions();
            setPromptHistory([]);
            setPromptHistoryIndex(0);
            NBIAPI.sendWebSocketMessage(UUID.uuid4(), RequestDataType.ClearChatHistory, { chatId });
            return;
        }
        setCopilotRequestInProgress(true);
        const activeDocInfo = props.getActiveDocumentInfo();
        const extractedPrompt = prompt;
        const contents = [];
        const app = props.getApp();
        const additionalContext = [];
        if (contextOn && (activeDocumentInfo === null || activeDocumentInfo === void 0 ? void 0 : activeDocumentInfo.filename)) {
            const selection = activeDocumentInfo.selection;
            const textSelected = selection &&
                !(selection.start.line === selection.end.line &&
                    selection.start.column === selection.end.column);
            additionalContext.push({
                type: ContextType.CurrentFile,
                content: props.getActiveSelectionContent(),
                currentCellContents: textSelected
                    ? null
                    : props.getCurrentCellContents(),
                filePath: activeDocumentInfo.filePath,
                cellIndex: activeDocumentInfo.activeCellIndex,
                startLine: selection ? selection.start.line + 1 : 1,
                endLine: selection ? selection.end.line + 1 : 1
            });
        }
        submitCompletionRequest({
            messageId: lastMessageId.current,
            chatId,
            type: RunChatCompletionType.Chat,
            content: extractedPrompt,
            language: activeDocInfo.language,
            filename: activeDocInfo.filename,
            additionalContext
        }, {
            emit: async (response) => {
                var _a, _b, _c, _d, _e;
                if (response.id !== lastMessageId.current) {
                    return;
                }
                let responseMessage = '';
                if (response.type === BackendMessageType.StreamMessage) {
                    const delta = (_b = (_a = response.data['choices']) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b['delta'];
                    if (!delta) {
                        return;
                    }
                    if (delta['nbiContent']) {
                        const nbiContent = delta['nbiContent'];
                        contents.push({
                            id: UUID.uuid4(),
                            type: nbiContent.type,
                            content: nbiContent.content,
                            created: new Date(response.created)
                        });
                    }
                    else {
                        responseMessage =
                            (_e = (_d = (_c = response.data['choices']) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d['delta']) === null || _e === void 0 ? void 0 : _e['content'];
                        if (!responseMessage) {
                            return;
                        }
                        contents.push({
                            id: UUID.uuid4(),
                            type: ResponseStreamDataType.MarkdownPart,
                            content: responseMessage,
                            created: new Date(response.created)
                        });
                    }
                }
                else if (response.type === BackendMessageType.StreamEnd) {
                    setCopilotRequestInProgress(false);
                    const timeElapsed = (new Date().getTime() - lastRequestTime.current.getTime()) / 1000;
                    telemetryEmitter.emitTelemetryEvent({
                        type: TelemetryEventType.ChatResponse,
                        data: {
                            chatModel: {
                                provider: NBIAPI.config.chatModel.provider,
                                model: NBIAPI.config.chatModel.model
                            },
                            timeElapsed
                        }
                    });
                }
                else if (response.type === BackendMessageType.RunUICommand) {
                    const messageId = response.id;
                    const result = await app.commands.execute(response.data.commandId, response.data.args);
                    const data = {
                        callback_id: response.data.callback_id,
                        result: result || 'void'
                    };
                    try {
                        JSON.stringify(data);
                    }
                    catch (error) {
                        data.result = 'Could not serialize the result';
                    }
                    NBIAPI.sendWebSocketMessage(messageId, RequestDataType.RunUICommandResponse, data);
                }
                setChatMessages([
                    ...newList,
                    {
                        id: UUID.uuid4(),
                        date: new Date(),
                        from: 'copilot',
                        contents: contents,
                        participant: NBIAPI.config.chatParticipants.find(participant => {
                            return participant.id === response.participant;
                        })
                    }
                ]);
            }
        });
        const newPrompt = prompt.startsWith('/settings') ? '' : promptPrefix;
        setPrompt(newPrompt);
        filterPrefixSuggestions(newPrompt);
        telemetryEmitter.emitTelemetryEvent({
            type: TelemetryEventType.ChatRequest,
            data: {
                chatModel: {
                    provider: NBIAPI.config.chatModel.provider,
                    model: NBIAPI.config.chatModel.model
                },
                prompt: extractedPrompt
            }
        });
    };
    const handleUserInputCancel = async () => {
        NBIAPI.sendWebSocketMessage(lastMessageId.current, RequestDataType.CancelChatRequest, { chatId });
        lastMessageId.current = '';
        setCopilotRequestInProgress(false);
    };
    const filterPrefixSuggestions = (prmpt) => {
        const userInput = prmpt.trimStart();
        if (userInput === '') {
            setPrefixSuggestions(originalPrefixes);
        }
        else {
            setPrefixSuggestions(originalPrefixes.filter(prefix => prefix.includes(userInput)));
        }
    };
    const resetPrefixSuggestions = () => {
        setPrefixSuggestions(originalPrefixes);
        setSelectedPrefixSuggestionIndex(0);
    };
    const resetChatId = () => {
        setChatId(UUID.uuid4());
    };
    const onPromptKeyDown = async (event) => {
        if (event.key === 'Enter') {
            event.stopPropagation();
            event.preventDefault();
            if (showPopover) {
                applyPrefixSuggestion(prefixSuggestions[selectedPrefixSuggestionIndex]);
                return;
            }
            setSelectedPrefixSuggestionIndex(0);
            handleSubmitStopChatButtonClick();
        }
        else if (event.key === 'Tab') {
            if (showPopover) {
                event.stopPropagation();
                event.preventDefault();
                applyPrefixSuggestion(prefixSuggestions[selectedPrefixSuggestionIndex]);
                return;
            }
        }
        else if (event.key === 'Escape') {
            event.stopPropagation();
            event.preventDefault();
            setShowPopover(false);
            setSelectedPrefixSuggestionIndex(0);
        }
        else if (event.key === 'ArrowUp') {
            event.stopPropagation();
            event.preventDefault();
            if (showPopover) {
                setSelectedPrefixSuggestionIndex((selectedPrefixSuggestionIndex - 1 + prefixSuggestions.length) %
                    prefixSuggestions.length);
                return;
            }
            setShowPopover(false);
            // first time up key press
            if (promptHistory.length > 0 &&
                promptHistoryIndex === promptHistory.length) {
                setDraftPrompt(prompt);
            }
            if (promptHistory.length > 0 &&
                promptHistoryIndex > 0 &&
                promptHistoryIndex <= promptHistory.length) {
                const prevPrompt = promptHistory[promptHistoryIndex - 1];
                const newIndex = promptHistoryIndex - 1;
                setPrompt(prevPrompt);
                setPromptHistoryIndex(newIndex);
            }
        }
        else if (event.key === 'ArrowDown') {
            event.stopPropagation();
            event.preventDefault();
            if (showPopover) {
                setSelectedPrefixSuggestionIndex((selectedPrefixSuggestionIndex + 1 + prefixSuggestions.length) %
                    prefixSuggestions.length);
                return;
            }
            setShowPopover(false);
            if (promptHistory.length > 0 &&
                promptHistoryIndex >= 0 &&
                promptHistoryIndex < promptHistory.length) {
                if (promptHistoryIndex === promptHistory.length - 1) {
                    setPrompt(draftPrompt);
                    setPromptHistoryIndex(promptHistory.length);
                    return;
                }
                const prevPrompt = promptHistory[promptHistoryIndex + 1];
                const newIndex = promptHistoryIndex + 1;
                setPrompt(prevPrompt);
                setPromptHistoryIndex(newIndex);
            }
        }
    };
    const scrollMessagesToBottom = () => {
        var _a;
        (_a = messagesEndRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth' });
    };
    const handleConfigurationClick = async () => {
        props
            .getApp()
            .commands.execute('notebook-intelligence:open-configuration-dialog');
    };
    const handleLoginClick = async () => {
        props
            .getApp()
            .commands.execute('notebook-intelligence:open-github-copilot-login-dialog');
    };
    useEffect(() => {
        scrollMessagesToBottom();
    }, [chatMessages]);
    const promptRequestHandler = useCallback((eventData) => {
        const request = eventData.detail;
        request.chatId = chatId;
        let message = '';
        switch (request.type) {
            case RunChatCompletionType.ExplainThis:
                message = `Explain this code:\n\`\`\`\n${request.content}\n\`\`\`\n`;
                break;
            case RunChatCompletionType.FixThis:
                message = `Fix this code:\n\`\`\`\n${request.content}\n\`\`\`\n`;
                break;
            case RunChatCompletionType.ExplainThisOutput:
                message = `Explain this notebook cell output: \n\`\`\`\n${request.content}\n\`\`\`\n`;
                break;
            case RunChatCompletionType.TroubleshootThisOutput:
                message = `Troubleshoot errors reported in the notebook cell output: \n\`\`\`\n${request.content}\n\`\`\`\n`;
                break;
        }
        const messageId = UUID.uuid4();
        request.messageId = messageId;
        const newList = [
            ...chatMessages,
            {
                id: messageId,
                date: new Date(),
                from: 'user',
                contents: [
                    {
                        id: messageId,
                        type: ResponseStreamDataType.Markdown,
                        content: message,
                        created: new Date()
                    }
                ]
            }
        ];
        setChatMessages(newList);
        setCopilotRequestInProgress(true);
        const contents = [];
        submitCompletionRequest(request, {
            emit: response => {
                var _a, _b, _c, _d, _e;
                if (response.type === BackendMessageType.StreamMessage) {
                    const delta = (_b = (_a = response.data['choices']) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b['delta'];
                    if (!delta) {
                        return;
                    }
                    const responseMessage = (_e = (_d = (_c = response.data['choices']) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d['delta']) === null || _e === void 0 ? void 0 : _e['content'];
                    if (!responseMessage) {
                        return;
                    }
                    contents.push({
                        id: response.id,
                        type: ResponseStreamDataType.MarkdownPart,
                        content: responseMessage,
                        created: new Date(response.created)
                    });
                }
                else if (response.type === BackendMessageType.StreamEnd) {
                    setCopilotRequestInProgress(false);
                }
                const messageId = UUID.uuid4();
                setChatMessages([
                    ...newList,
                    {
                        id: messageId,
                        date: new Date(),
                        from: 'copilot',
                        contents: contents,
                        participant: NBIAPI.config.chatParticipants.find(participant => {
                            return participant.id === response.participant;
                        })
                    }
                ]);
            }
        });
    }, [chatMessages]);
    useEffect(() => {
        document.addEventListener('copilotSidebar:runPrompt', promptRequestHandler);
        return () => {
            document.removeEventListener('copilotSidebar:runPrompt', promptRequestHandler);
        };
    }, [chatMessages]);
    const activeDocumentChangeHandler = (eventData) => {
        var _a;
        // if file changes reset the context toggle
        if (((_a = eventData.detail.activeDocumentInfo) === null || _a === void 0 ? void 0 : _a.filePath) !==
            (activeDocumentInfo === null || activeDocumentInfo === void 0 ? void 0 : activeDocumentInfo.filePath)) {
            setContextOn(false);
        }
        setActiveDocumentInfo({
            ...eventData.detail.activeDocumentInfo,
            ...{ activeWidget: null }
        });
        setCurrentFileContextTitle(getActiveDocumentContextTitle(eventData.detail.activeDocumentInfo));
    };
    useEffect(() => {
        document.addEventListener('copilotSidebar:activeDocumentChanged', activeDocumentChangeHandler);
        return () => {
            document.removeEventListener('copilotSidebar:activeDocumentChanged', activeDocumentChangeHandler);
        };
    }, [activeDocumentInfo]);
    const getActiveDocumentContextTitle = (activeDocumentInfo) => {
        if (!(activeDocumentInfo === null || activeDocumentInfo === void 0 ? void 0 : activeDocumentInfo.filename)) {
            return '';
        }
        const wholeFile = !activeDocumentInfo.selection ||
            (activeDocumentInfo.selection.start.line ===
                activeDocumentInfo.selection.end.line &&
                activeDocumentInfo.selection.start.column ===
                    activeDocumentInfo.selection.end.column);
        let cellAndLineIndicator = '';
        if (!wholeFile) {
            if (activeDocumentInfo.filename.endsWith('.ipynb')) {
                cellAndLineIndicator = ` · Cell ${activeDocumentInfo.activeCellIndex + 1}`;
            }
            if (activeDocumentInfo.selection.start.line ===
                activeDocumentInfo.selection.end.line) {
                cellAndLineIndicator += `:${activeDocumentInfo.selection.start.line + 1}`;
            }
            else {
                cellAndLineIndicator += `:${activeDocumentInfo.selection.start.line + 1}-${activeDocumentInfo.selection.end.line + 1}`;
            }
        }
        return `${activeDocumentInfo.filename}${cellAndLineIndicator}`;
    };
    const nbiConfig = NBIAPI.config;
    const getGHLoginRequired = () => {
        return (nbiConfig.usingGitHubCopilotModel &&
            NBIAPI.getLoginStatus() === GitHubCopilotLoginStatus.NotLoggedIn);
    };
    const getChatEnabled = () => {
        return nbiConfig.chatModel.provider === GITHUB_COPILOT_PROVIDER_ID
            ? !getGHLoginRequired()
            : nbiConfig.llmProviders.find(provider => provider.id === nbiConfig.chatModel.provider);
    };
    const [ghLoginRequired, setGHLoginRequired] = useState(getGHLoginRequired());
    const [chatEnabled, setChatEnabled] = useState(getChatEnabled());
    NBIAPI.configChanged.connect(() => {
        setGHLoginRequired(getGHLoginRequired());
        setChatEnabled(getChatEnabled());
    });
    useEffect(() => {
        setGHLoginRequired(getGHLoginRequired());
        setChatEnabled(getChatEnabled());
    }, [ghLoginStatus]);
    return (React.createElement("div", { className: "sidebar" },
        React.createElement("div", { className: "sidebar-header" },
            React.createElement("div", { className: "sidebar-title" }, "Notebook Intelligence")),
        !chatEnabled && !ghLoginRequired && (React.createElement("div", { className: "sidebar-login-info" },
            "Chat is disabled as you don't have a model configured.",
            React.createElement("button", { className: "jp-Dialog-button jp-mod-accept jp-mod-styled", onClick: handleConfigurationClick },
                React.createElement("div", { className: "jp-Dialog-buttonLabel" }, "Configure models")))),
        ghLoginRequired && (React.createElement("div", { className: "sidebar-login-info" },
            React.createElement("div", null, "You are not logged in to GitHub Copilot. Please login now to activate chat."),
            React.createElement("div", { className: "sidebar-login-buttons" },
                React.createElement("button", { className: "jp-Dialog-button jp-mod-accept jp-mod-styled", onClick: handleLoginClick },
                    React.createElement("div", { className: "jp-Dialog-buttonLabel" }, "Login to GitHub Copilot")),
                React.createElement("button", { className: "jp-Dialog-button jp-mod-reject jp-mod-styled", onClick: handleConfigurationClick },
                    React.createElement("div", { className: "jp-Dialog-buttonLabel" }, "Change provider"))))),
        chatEnabled &&
            (chatMessages.length === 0 ? (React.createElement("div", { className: "sidebar-messages" },
                React.createElement("div", { className: "sidebar-greeting" }, "Welcome! How can I assist you today?"))) : (React.createElement("div", { className: "sidebar-messages" },
                chatMessages.map((msg, index) => (React.createElement(ChatResponse, { key: `key-${index}`, message: msg, openFile: props.openFile, getApp: props.getApp, getActiveDocumentInfo: props.getActiveDocumentInfo, showGenerating: index === chatMessages.length - 1 &&
                        msg.from === 'copilot' &&
                        copilotRequestInProgress }))),
                React.createElement("div", { ref: messagesEndRef })))),
        chatEnabled && (React.createElement("div", { className: `sidebar-user-input ${copilotRequestInProgress ? 'generating' : ''}` },
            React.createElement("textarea", { ref: promptInputRef, rows: 3, onChange: onPromptChange, onKeyDown: onPromptKeyDown, placeholder: "Ask Copilot...", spellCheck: false, value: prompt }),
            (activeDocumentInfo === null || activeDocumentInfo === void 0 ? void 0 : activeDocumentInfo.filename) && (React.createElement("div", { className: "user-input-context-row" },
                React.createElement("div", { className: `user-input-context user-input-context-active-file ${contextOn ? 'on' : 'off'}` },
                    React.createElement("div", null, currentFileContextTitle),
                    contextOn ? (React.createElement("div", { className: "user-input-context-toggle", onClick: () => setContextOn(!contextOn) },
                        React.createElement(VscEye, { title: "Use as context" }))) : (React.createElement("div", { className: "user-input-context-toggle", onClick: () => setContextOn(!contextOn) },
                        React.createElement(VscEyeClosed, { title: "Don't use as context" })))))),
            React.createElement("div", { className: "user-input-footer" },
                React.createElement("div", null,
                    React.createElement("a", { href: "javascript:void(0)", onClick: () => {
                            var _a;
                            setShowPopover(true);
                            (_a = promptInputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
                        }, title: "Select chat participant" }, "@")),
                React.createElement("div", { style: { flexGrow: 1 } }),
                React.createElement("div", null,
                    React.createElement("button", { className: "jp-Dialog-button jp-mod-accept jp-mod-styled send-button", onClick: () => handleSubmitStopChatButtonClick(), disabled: prompt.length === 0 && !copilotRequestInProgress }, copilotRequestInProgress ? React.createElement(VscStopCircle, null) : React.createElement(VscSend, null)))),
            showPopover && prefixSuggestions.length > 0 && (React.createElement("div", { className: "user-input-autocomplete" }, prefixSuggestions.map((prefix, index) => (React.createElement("div", { key: `key-${index}`, className: `user-input-autocomplete-item ${index === selectedPrefixSuggestionIndex ? 'selected' : ''}`, "data-value": prefix, onClick: event => prefixSuggestionSelected(event) }, prefix)))))))));
}
function InlinePopoverComponent(props) {
    const [modifiedCode, setModifiedCode] = useState('');
    const [promptSubmitted, setPromptSubmitted] = useState(false);
    const originalOnRequestSubmitted = props.onRequestSubmitted;
    const originalOnResponseEmit = props.onResponseEmit;
    const onRequestSubmitted = (prompt) => {
        setModifiedCode('');
        setPromptSubmitted(true);
        originalOnRequestSubmitted(prompt);
    };
    const onResponseEmit = (response) => {
        var _a, _b, _c, _d, _e;
        if (response.type === BackendMessageType.StreamMessage) {
            const delta = (_b = (_a = response.data['choices']) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b['delta'];
            if (!delta) {
                return;
            }
            const responseMessage = (_e = (_d = (_c = response.data['choices']) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d['delta']) === null || _e === void 0 ? void 0 : _e['content'];
            if (!responseMessage) {
                return;
            }
            setModifiedCode((modifiedCode) => modifiedCode + responseMessage);
        }
        else if (response.type === BackendMessageType.StreamEnd) {
            setModifiedCode((modifiedCode) => extractLLMGeneratedCode(modifiedCode));
        }
        originalOnResponseEmit(response);
    };
    return (React.createElement("div", { className: "inline-popover" },
        React.createElement(InlinePromptComponent, { ...props, onRequestSubmitted: onRequestSubmitted, onResponseEmit: onResponseEmit, onUpdatedCodeAccepted: props.onUpdatedCodeAccepted, limitHeight: props.existingCode !== '' && promptSubmitted }),
        props.existingCode !== '' && promptSubmitted && (React.createElement(React.Fragment, null,
            React.createElement(InlineDiffViewerComponent, { ...props, modifiedCode: modifiedCode }),
            React.createElement("div", { className: "inline-popover-footer" },
                React.createElement("div", null,
                    React.createElement("button", { className: "jp-Button jp-mod-accept jp-mod-styled jp-mod-small", onClick: () => props.onUpdatedCodeAccepted() }, "Accept")),
                React.createElement("div", null,
                    React.createElement("button", { className: "jp-Button jp-mod-reject jp-mod-styled jp-mod-small", onClick: () => props.onRequestCancelled() }, "Cancel")))))));
}
function InlineDiffViewerComponent(props) {
    const editorContainerRef = useRef(null);
    const [diffEditor, setDiffEditor] = useState(null);
    useEffect(() => {
        const editorEl = editorContainerRef.current;
        editorEl.className = 'monaco-editor-container';
        const existingModel = monaco.editor.createModel(props.existingCode, 'text/plain');
        const modifiedModel = monaco.editor.createModel(props.modifiedCode, 'text/plain');
        const editor = monaco.editor.createDiffEditor(editorEl, {
            originalEditable: false,
            automaticLayout: true,
            theme: isDarkTheme() ? 'vs-dark' : 'vs'
        });
        editor.setModel({
            original: existingModel,
            modified: modifiedModel
        });
        modifiedModel.onDidChangeContent(() => {
            props.onUpdatedCodeChange(modifiedModel.getValue());
        });
        setDiffEditor(editor);
    }, []);
    useEffect(() => {
        var _a;
        (_a = diffEditor === null || diffEditor === void 0 ? void 0 : diffEditor.getModifiedEditor().getModel()) === null || _a === void 0 ? void 0 : _a.setValue(props.modifiedCode);
    }, [props.modifiedCode]);
    return (React.createElement("div", { ref: editorContainerRef, className: "monaco-editor-container" }));
}
function InlinePromptComponent(props) {
    const [prompt, setPrompt] = useState(props.prompt);
    const promptInputRef = useRef(null);
    const [inputSubmitted, setInputSubmitted] = useState(false);
    const onPromptChange = (event) => {
        const newPrompt = event.target.value;
        setPrompt(newPrompt);
    };
    const handleUserInputSubmit = async () => {
        const promptPrefixParts = [];
        const promptParts = prompt.split(' ');
        if (promptParts.length > 1) {
            for (let i = 0; i < Math.min(promptParts.length, 2); i++) {
                const part = promptParts[i];
                if (part.startsWith('@') || part.startsWith('/')) {
                    promptPrefixParts.push(part);
                }
            }
        }
        submitCompletionRequest({
            messageId: UUID.uuid4(),
            chatId: UUID.uuid4(),
            type: RunChatCompletionType.GenerateCode,
            content: prompt,
            language: undefined,
            filename: undefined,
            prefix: props.prefix,
            suffix: props.suffix,
            existingCode: props.existingCode
        }, {
            emit: async (response) => {
                props.onResponseEmit(response);
            }
        });
        setInputSubmitted(true);
    };
    const onPromptKeyDown = async (event) => {
        if (event.key === 'Enter') {
            event.stopPropagation();
            event.preventDefault();
            if (inputSubmitted && (event.metaKey || event.ctrlKey)) {
                props.onUpdatedCodeAccepted();
            }
            else {
                props.onRequestSubmitted(prompt);
                handleUserInputSubmit();
            }
        }
        else if (event.key === 'Escape') {
            event.stopPropagation();
            event.preventDefault();
            props.onRequestCancelled();
        }
    };
    useEffect(() => {
        var _a;
        const input = promptInputRef.current;
        if (input) {
            input.select();
            (_a = promptInputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        }
    }, []);
    return (React.createElement("div", { className: "inline-prompt-container", style: { height: props.limitHeight ? '40px' : '100%' } },
        React.createElement("textarea", { ref: promptInputRef, rows: 3, onChange: onPromptChange, onKeyDown: onPromptKeyDown, placeholder: "Ask Copilot to generate Python code...", spellCheck: false, value: prompt })));
}
function GitHubCopilotStatusComponent(props) {
    const [ghLoginStatus, setGHLoginStatus] = useState(GitHubCopilotLoginStatus.NotLoggedIn);
    const [loginClickCount, _setLoginClickCount] = useState(0);
    useEffect(() => {
        const fetchData = () => {
            setGHLoginStatus(NBIAPI.getLoginStatus());
        };
        fetchData();
        const intervalId = setInterval(fetchData, 1000);
        return () => clearInterval(intervalId);
    }, [loginClickCount]);
    const onStatusClick = () => {
        props
            .getApp()
            .commands.execute('notebook-intelligence:open-github-copilot-login-dialog');
    };
    return (React.createElement("div", { title: `GitHub Copilot: ${ghLoginStatus === GitHubCopilotLoginStatus.LoggedIn ? 'Logged in' : 'Not logged in'}`, className: "github-copilot-status-bar", onClick: () => onStatusClick(), dangerouslySetInnerHTML: {
            __html: ghLoginStatus === GitHubCopilotLoginStatus.LoggedIn
                ? copilotSvgstr
                : copilotWarningSvgstr
        } }));
}
function GitHubCopilotLoginDialogBodyComponent(props) {
    const [ghLoginStatus, setGHLoginStatus] = useState(GitHubCopilotLoginStatus.NotLoggedIn);
    const [loginClickCount, setLoginClickCount] = useState(0);
    const [loginClicked, setLoginClicked] = useState(false);
    const [deviceActivationURL, setDeviceActivationURL] = useState('');
    const [deviceActivationCode, setDeviceActivationCode] = useState('');
    useEffect(() => {
        const fetchData = () => {
            const status = NBIAPI.getLoginStatus();
            setGHLoginStatus(status);
            if (status === GitHubCopilotLoginStatus.LoggedIn && loginClicked) {
                setTimeout(() => {
                    props.onLoggedIn();
                }, 1000);
            }
        };
        fetchData();
        const intervalId = setInterval(fetchData, 1000);
        return () => clearInterval(intervalId);
    }, [loginClickCount]);
    const handleLoginClick = async () => {
        const response = await NBIAPI.loginToGitHub();
        setDeviceActivationURL(response.verificationURI);
        setDeviceActivationCode(response.userCode);
        setLoginClickCount(loginClickCount + 1);
        setLoginClicked(true);
    };
    const handleLogoutClick = async () => {
        await NBIAPI.logoutFromGitHub();
        setLoginClickCount(loginClickCount + 1);
    };
    const loggedIn = ghLoginStatus === GitHubCopilotLoginStatus.LoggedIn;
    return (React.createElement("div", { className: "github-copilot-login-dialog" },
        React.createElement("div", { className: "github-copilot-login-status" },
            React.createElement("h4", null,
                "Login status:",
                ' ',
                React.createElement("span", { className: `github-copilot-login-status-text ${loggedIn ? 'logged-in' : ''}` }, loggedIn
                    ? 'Logged in'
                    : ghLoginStatus === GitHubCopilotLoginStatus.LoggingIn
                        ? 'Logging in...'
                        : ghLoginStatus === GitHubCopilotLoginStatus.ActivatingDevice
                            ? 'Activating device...'
                            : ghLoginStatus === GitHubCopilotLoginStatus.NotLoggedIn
                                ? 'Not logged in'
                                : 'Unknown'))),
        ghLoginStatus === GitHubCopilotLoginStatus.NotLoggedIn && (React.createElement(React.Fragment, null,
            React.createElement("div", null, "Your code and data are directly transferred to GitHub Copilot as needed without storing any copies other than keeping in the process memory."),
            React.createElement("div", null,
                React.createElement("a", { href: "https://github.com/features/copilot", target: "_blank" }, "GitHub Copilot"),
                ' ',
                "requires a subscription and it has a free tier. GitHub Copilot is subject to the",
                ' ',
                React.createElement("a", { href: "https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features", target: "_blank" }, "GitHub Terms for Additional Products and Features"),
                "."),
            React.createElement("div", null,
                React.createElement("h4", null, "Privacy and terms"),
                "By using Notebook Intelligence with GitHub Copilot subscription you agree to",
                ' ',
                React.createElement("a", { href: "https://docs.github.com/en/copilot/responsible-use-of-github-copilot-features/responsible-use-of-github-copilot-chat-in-your-ide", target: "_blank" }, "GitHub Copilot chat terms"),
                ". Review the terms to understand about usage, limitations and ways to improve GitHub Copilot. Please review",
                ' ',
                React.createElement("a", { href: "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement", target: "_blank" }, "Privacy Statement"),
                "."),
            React.createElement("div", null,
                React.createElement("button", { className: "jp-Dialog-button jp-mod-accept jp-mod-reject jp-mod-styled", onClick: handleLoginClick },
                    React.createElement("div", { className: "jp-Dialog-buttonLabel" }, "Login using your GitHub account"))))),
        loggedIn && (React.createElement("div", null,
            React.createElement("button", { className: "jp-Dialog-button jp-mod-reject jp-mod-styled", onClick: handleLogoutClick },
                React.createElement("div", { className: "jp-Dialog-buttonLabel" }, "Logout")))),
        ghLoginStatus === GitHubCopilotLoginStatus.ActivatingDevice &&
            deviceActivationURL &&
            deviceActivationCode && (React.createElement("div", null,
            React.createElement("div", { className: "copilot-activation-message" },
                "Copy code",
                ' ',
                React.createElement("span", { className: "user-code-span", onClick: () => {
                        navigator.clipboard.writeText(deviceActivationCode);
                        return true;
                    } },
                    React.createElement("b", null,
                        deviceActivationCode,
                        ' ',
                        React.createElement("span", { className: "copy-icon", dangerouslySetInnerHTML: { __html: copySvgstr } }))),
                ' ',
                "and enter at",
                ' ',
                React.createElement("a", { href: deviceActivationURL, target: "_blank" }, deviceActivationURL),
                ' ',
                "to allow access to GitHub Copilot from this app. Activation could take up to a minute after you enter the code."))),
        ghLoginStatus === GitHubCopilotLoginStatus.ActivatingDevice && (React.createElement("div", { style: { marginTop: '10px' } },
            React.createElement("button", { className: "jp-Dialog-button jp-mod-reject jp-mod-styled", onClick: handleLogoutClick },
                React.createElement("div", { className: "jp-Dialog-buttonLabel" }, "Cancel activation"))))));
}
function ConfigurationDialogBodyComponent(props) {
    const nbiConfig = NBIAPI.config;
    const llmProviders = nbiConfig.llmProviders;
    const [chatModels, setChatModels] = useState([]);
    const [inlineCompletionModels, setInlineCompletionModels] = useState([]);
    const handleSaveClick = async () => {
        await NBIAPI.setConfig({
            chat_model: {
                provider: chatModelProvider,
                model: chatModel,
                properties: chatModelProperties
            },
            inline_completion_model: {
                provider: inlineCompletionModelProvider,
                model: inlineCompletionModel,
                properties: inlineCompletionModelProperties
            }
        });
        props.onSave();
    };
    const handleRefreshOllamaModelListClick = async () => {
        await NBIAPI.updateOllamaModelList();
        updateModelOptionsForProvider(chatModelProvider, 'chat');
    };
    const [chatModelProvider, setChatModelProvider] = useState(nbiConfig.chatModel.provider || 'none');
    const [inlineCompletionModelProvider, setInlineCompletionModelProvider] = useState(nbiConfig.inlineCompletionModel.provider || 'none');
    const [chatModel, setChatModel] = useState(nbiConfig.chatModel.model);
    const [chatModelProperties, setChatModelProperties] = useState([]);
    const [inlineCompletionModelProperties, setInlineCompletionModelProperties] = useState([]);
    const [inlineCompletionModel, setInlineCompletionModel] = useState(nbiConfig.inlineCompletionModel.model);
    const updateModelOptionsForProvider = (providerId, modelType) => {
        if (modelType === 'chat') {
            setChatModelProvider(providerId);
        }
        else {
            setInlineCompletionModelProvider(providerId);
        }
        const models = modelType === 'chat'
            ? nbiConfig.chatModels
            : nbiConfig.inlineCompletionModels;
        const selectedModelId = modelType === 'chat'
            ? nbiConfig.chatModel.model
            : nbiConfig.inlineCompletionModel.model;
        const providerModels = models.filter((model) => model.provider === providerId);
        if (modelType === 'chat') {
            setChatModels(providerModels);
        }
        else {
            setInlineCompletionModels(providerModels);
        }
        let selectedModel = providerModels.find((model) => model.id === selectedModelId);
        if (!selectedModel) {
            selectedModel = providerModels === null || providerModels === void 0 ? void 0 : providerModels[0];
        }
        if (selectedModel) {
            if (modelType === 'chat') {
                setChatModel(selectedModel.id);
                setChatModelProperties(selectedModel.properties);
            }
            else {
                setInlineCompletionModel(selectedModel.id);
                setInlineCompletionModelProperties(selectedModel.properties);
            }
        }
        else {
            if (modelType === 'chat') {
                setChatModelProperties([]);
            }
            else {
                setInlineCompletionModelProperties([]);
            }
        }
    };
    const onModelPropertyChange = (modelType, propertyId, value) => {
        const modelProperties = modelType === 'chat'
            ? chatModelProperties
            : inlineCompletionModelProperties;
        const updatedProperties = modelProperties.map((property) => {
            if (property.id === propertyId) {
                return { ...property, value };
            }
            return property;
        });
        if (modelType === 'chat') {
            setChatModelProperties(updatedProperties);
        }
        else {
            setInlineCompletionModelProperties(updatedProperties);
        }
    };
    useEffect(() => {
        updateModelOptionsForProvider(chatModelProvider, 'chat');
        updateModelOptionsForProvider(inlineCompletionModelProvider, 'inline-completion');
    }, []);
    return (React.createElement("div", { className: "config-dialog" },
        React.createElement("div", { className: "config-dialog-body" },
            React.createElement("div", { className: "model-config-section" },
                React.createElement("div", { className: "model-config-section-header" }, "Chat model"),
                React.createElement("div", { className: "model-config-section-body" },
                    React.createElement("div", { className: "model-config-section-row" },
                        React.createElement("div", { className: "model-config-section-column" },
                            React.createElement("div", null, "Provider"),
                            React.createElement("div", null,
                                React.createElement("select", { className: "jp-mod-styled", onChange: event => updateModelOptionsForProvider(event.target.value, 'chat') },
                                    llmProviders.map((provider, index) => (React.createElement("option", { key: index, value: provider.id, selected: provider.id === chatModelProvider }, provider.name))),
                                    React.createElement("option", { key: -1, value: "none", selected: chatModelProvider === 'none' ||
                                            !llmProviders.find(provider => provider.id === chatModelProvider) }, "None")))),
                        !['openai-compatible', 'litellm-compatible', 'none'].includes(chatModelProvider) &&
                            chatModels.length > 0 && (React.createElement("div", { className: "model-config-section-column" },
                            React.createElement("div", null, "Model"),
                            ![
                                OPENAI_COMPATIBLE_CHAT_MODEL_ID,
                                LITELLM_COMPATIBLE_CHAT_MODEL_ID
                            ].includes(chatModel) &&
                                chatModels.length > 0 && (React.createElement("div", null,
                                React.createElement("select", { className: "jp-mod-styled", onChange: event => setChatModel(event.target.value) }, chatModels.map((model, index) => (React.createElement("option", { key: index, value: model.id, selected: model.id === chatModel }, model.name))))))))),
                    React.createElement("div", { className: "model-config-section-row" },
                        React.createElement("div", { className: "model-config-section-column" }, chatModelProvider === 'ollama' && chatModels.length === 0 && (React.createElement("div", { className: "ollama-warning-message" },
                            "No Ollama models found! Make sure",
                            ' ',
                            React.createElement("a", { href: "https://ollama.com/", target: "_blank" }, "Ollama"),
                            ' ',
                            "is running and models are downloaded to your computer.",
                            ' ',
                            React.createElement("a", { href: "javascript:void(0)", onClick: handleRefreshOllamaModelListClick }, "Try again"),
                            ' ',
                            "once ready.")))),
                    React.createElement("div", { className: "model-config-section-row" },
                        React.createElement("div", { className: "model-config-section-column" }, chatModelProperties.map((property, index) => (React.createElement("div", { className: "form-field-row", key: index },
                            React.createElement("div", { className: "form-field-description" },
                                property.name,
                                " ",
                                property.optional ? '(optional)' : ''),
                            React.createElement("input", { name: "chat-model-id-input", placeholder: property.description, className: "jp-mod-styled", spellCheck: false, value: property.value, onChange: event => onModelPropertyChange('chat', property.id, event.target.value) })))))))),
            React.createElement("div", { className: "model-config-section" },
                React.createElement("div", { className: "model-config-section-header" }, "Auto-complete model"),
                React.createElement("div", { className: "model-config-section-body" },
                    React.createElement("div", { className: "model-config-section-row" },
                        React.createElement("div", { className: "model-config-section-column" },
                            React.createElement("div", null, "Provider"),
                            React.createElement("div", null,
                                React.createElement("select", { className: "jp-mod-styled", onChange: event => updateModelOptionsForProvider(event.target.value, 'inline-completion') },
                                    llmProviders.map((provider, index) => (React.createElement("option", { key: index, value: provider.id, selected: provider.id === inlineCompletionModelProvider }, provider.name))),
                                    React.createElement("option", { key: -1, value: "none", selected: inlineCompletionModelProvider === 'none' ||
                                            !llmProviders.find(provider => provider.id === inlineCompletionModelProvider) }, "None")))),
                        !['openai-compatible', 'litellm-compatible', 'none'].includes(inlineCompletionModelProvider) && (React.createElement("div", { className: "model-config-section-column" },
                            React.createElement("div", null, "Model"),
                            ![
                                OPENAI_COMPATIBLE_INLINE_COMPLETION_MODEL_ID,
                                LITELLM_COMPATIBLE_INLINE_COMPLETION_MODEL_ID
                            ].includes(inlineCompletionModel) && (React.createElement("div", null,
                                React.createElement("select", { className: "jp-mod-styled", onChange: event => setInlineCompletionModel(event.target.value) }, inlineCompletionModels.map((model, index) => (React.createElement("option", { key: index, value: model.id, selected: model.id === inlineCompletionModel }, model.name))))))))),
                    React.createElement("div", { className: "model-config-section-row" },
                        React.createElement("div", { className: "model-config-section-column" }, inlineCompletionModelProperties.map((property, index) => (React.createElement("div", { className: "form-field-row", key: index },
                            React.createElement("div", { className: "form-field-description" },
                                property.name,
                                " ",
                                property.optional ? '(optional)' : ''),
                            React.createElement("input", { name: "inline-completion-model-id-input", placeholder: property.description, className: "jp-mod-styled", spellCheck: false, value: property.value, onChange: event => onModelPropertyChange('inline-completion', property.id, event.target.value) }))))))))),
        React.createElement("div", { className: "config-dialog-footer" },
            React.createElement("button", { className: "jp-Dialog-button jp-mod-accept jp-mod-styled", onClick: handleSaveClick },
                React.createElement("div", { className: "jp-Dialog-buttonLabel" }, "Save")))));
}
