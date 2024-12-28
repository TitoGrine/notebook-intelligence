// Copyright (c) Mehmet Bektas <mbektasgh@outlook.com>

import React, { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import Markdown from 'react-markdown';
import { UUID } from '@lumino/coreutils';

import { GitHubCopilot, GitHubCopilotLoginStatus } from './github-copilot';
import { IActiveDocumentInfo, IChatCompletionResponseEmitter, RequestDataType, ResponseStreamDataType } from './tokens';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { requestAPI } from "./handler";

export enum RunChatCompletionType {
    Chat,
    ExplainThis,
    FixThis,
    NewNotebook,
}

export interface IRunChatCompletionRequest {
    chatId: string,
    type: RunChatCompletionType,
    content: string,
    language?: string,
    filename?: string,
    parentDirectory?: string,
}

export interface IChatSidebarOptions {
    getActiveDocumentInfo: () => IActiveDocumentInfo;
    openFile: (path: string) => void;
    getApp: () => JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">;
}

export class ChatSidebar extends ReactWidget {
    constructor(options: IChatSidebarOptions) {
        super();

        this.node.style.height = '100%';
        this._getActiveDocumentInfo = options.getActiveDocumentInfo;
        this._openFile = options.openFile;
        this._getApp = options.getApp;
    }

    render(): JSX.Element {
        return <SidebarComponent getActiveDocumentInfo={this._getActiveDocumentInfo} openFile={this._openFile} getApp={this._getApp} />;
    }

    private _getActiveDocumentInfo: () => IActiveDocumentInfo;
    private _openFile: (path: string) => void;
    private _getApp: () => JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">;
}

interface IChatMessageContent {
    id: string;
    type: ResponseStreamDataType;
    content: any;
}

interface IChatMessage {
    id: string;
    parentId?: string;
    date: Date;
    from: string; // 'user' | 'copilot';
    contents: IChatMessageContent[];
    notebookLink?: string;
}

const answeredForms = new Map<string, string>();

function ChatResponse(props: any) {
    const msg: IChatMessage = props.message;
    const timestamp = msg.date.toLocaleTimeString('en-US', { hour12: false });

    const openNotebook = (event: any) => {
        const notebookPath = event.target.dataset['ref'];
        props.openFile(notebookPath);
    };

    const markFormConfirmed = (messageId: string) => {
        answeredForms.set(messageId, 'confirmed');
    };
    const markFormCanceled = (messageId: string) => {
        answeredForms.set(messageId, 'canceled');
    };

    const runCommand = (commandId: string, args: any) => {
        props.getApp().commands.execute(commandId, args);
    };

    // group messages by type
    const groupedContents: IChatMessageContent[] = [];
    let lastItemType: ResponseStreamDataType | undefined;

    for (let i = 0; i < msg.contents.length; i++) {
        const item = msg.contents[i];
        if (item.type === lastItemType &&
            (lastItemType === ResponseStreamDataType.Markdown || lastItemType === ResponseStreamDataType.HTML)) {
            const lastItem = groupedContents[groupedContents.length - 1];
            lastItem.content += item.content;
        } else {
            groupedContents.push(structuredClone(item));
            lastItemType = item.type;
        }
    }

    return (
        <div className={`chat-message chat-message-${msg.from}`} >
            <div className="chat-message-header">
                <div className="chat-message-from">{msg.from === 'user' ? 'User' : 'Copilot'}</div>
                <div className="chat-message-timestamp">{timestamp}</div>
            </div>
            <div className="chat-message-content">
                {groupedContents.map((item, index) => {
                    switch (item.type) {
                        case ResponseStreamDataType.Markdown:
                            return <Markdown key={`key-${index}`}>{item.content}</Markdown>;
                        case ResponseStreamDataType.HTML:
                            return <div key={`key-${index}`} dangerouslySetInnerHTML={{ __html: item.content }} />;
                        case ResponseStreamDataType.Button:
                            return <button key={`key-${index}`} onClick={() => runCommand(item.content.commandId, item.content.args)}>{item.content.title}</button>;
                        case ResponseStreamDataType.Anchor:
                            return <a key={`key-${index}`} href={item.content.uri} target="_blank">{item.content.title}</a>;
                        case ResponseStreamDataType.Progress:
                            // show only if no more message available
                            return (index === (groupedContents.length - 1)) ? <div key={`key-${index}`}>&#x2713; {item.content}</div> : null;
                        case ResponseStreamDataType.Confirmation:
                            return answeredForms.get(item.id) === 'confirmed' ? null :
                                answeredForms.get(item.id) === 'canceled' ? <div>&#10006; Canceled</div> :
                                    <div className='chat-confirmation-form' key={`key-${index}`}>
                                        {item.content.title ? <div><b>{item.content.title}</b></div> : null}
                                        {item.content.message ? <div>{item.content.message}</div> : null}
                                        <button onClick={() => {
                                            markFormConfirmed(item.id);
                                            runCommand('notebook-intelligence:chat_user_input', item.content.confirmArgs)
                                        }}>Proceed</button>
                                        <button onClick={() => {
                                            markFormCanceled(item.id);
                                            runCommand('notebook-intelligence:chat_user_input', item.content.cancelArgs);
                                        }}>Cancel</button>
                                    </div>;
                    }
                    return null;
                })}

                {msg.notebookLink && (
                    <a className="copilot-generated-notebook-link" data-ref={msg.notebookLink} onClick={openNotebook}>open notebook</a>
                )}
            </div>
        </div>
    );
}

async function submitCompletionRequest(request: IRunChatCompletionRequest, responseEmitter: IChatCompletionResponseEmitter): Promise<any> {
    switch (request.type) {
        case RunChatCompletionType.Chat:
            return GitHubCopilot.chatRequest(
                request.chatId,
                request.content,
                request.language || 'python',
                request.filename || 'Untitled.ipynb',
                responseEmitter
            );
        case RunChatCompletionType.ExplainThis:
            {
                const filename = request.filename || 'Untitled.ipynb';
                return GitHubCopilot.explainThisRequest(
                    request.content,
                    request.language || 'python',
                    filename
                );
            }
        case RunChatCompletionType.FixThis:
            {
                const filename = request.filename || 'Untitled.ipynb';
                return GitHubCopilot.fixThisRequest(
                    request.content,
                    request.language || 'python',
                    filename
                );
            }
        case RunChatCompletionType.NewNotebook:
            {
                return GitHubCopilot.newNotebookRequest(
                    request.content,
                    request.parentDirectory!
                );
            }
    }
}

function SidebarComponent(props: any) {
    const [chatMessages, setChatMessages] = useState<IChatMessage[]>([]);
    const [prompt, setPrompt] = useState<string>('');
    const [draftPrompt, setDraftPrompt] = useState<string>('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [ghLoginStatus, setGHLoginStatus] = useState(GitHubCopilotLoginStatus.NotLoggedIn);
    const [loginClickCount, setLoginClickCount] = useState(0);
    const [deviceActivationURL, setDeviceActivationURL] = useState('');
    const [deviceActivationCode, setDeviceActivationCode] = useState('');
    const [copilotRequestInProgress, setCopilotRequestInProgress] = useState(false);
    const [showPopover, setShowPopover] = useState(false);
    const [originalPrefixes, setOriginalPrefixes] = useState<string[]>([]);
    const [prefixSuggestions, setPrefixSuggestions] = useState<string[]>([]);
    const promptInputRef = useRef<HTMLTextAreaElement>(null);
    const [promptHistory, setPromptHistory] = useState<string[]>([]);
    // position on prompt history stack
    const [promptHistoryIndex, setPromptHistoryIndex] = useState(0);
    const [chatId, setChatId] = useState(UUID.uuid4());

    useEffect(() => {
        requestAPI<any>('capabilities', { method: 'GET' })
            .then(data => {
                console.log(data);
                const prefixes: string[] = [];
                for (const participant of data.chat_participants) {
                    const id = participant.id;
                    const commands = participant.commands;
                    const participantPrefix = id === 'default' ? '' : `@${id}`;
                    if (participantPrefix !== '') {
                        prefixes.push(participantPrefix);
                    }
                    let commandPrefix = participantPrefix === '' ? '' : `${participantPrefix} `;
                    for (const command of commands) {
                        prefixes.push(`${commandPrefix}/${command}`);
                    }
                }
                setOriginalPrefixes(prefixes);
                setPrefixSuggestions(prefixes);
            })
            .catch(reason => {
                console.error(
                    `The jupyter_notebook_intelligence server extension appears to be missing.\n${reason}`
                );
            });
    }, []);

    useEffect(() => {
        const fetchData = () => {
            setGHLoginStatus(GitHubCopilot.getLoginStatus());
            const info = GitHubCopilot.getDeviceVerificationInfo();
            if (info.verificationURI && info.userCode) {
                setDeviceActivationURL(info.verificationURI);
                setDeviceActivationCode(info.userCode);
            }
        };

        fetchData();

        const intervalId = setInterval(fetchData, 3000);

        return () => clearInterval(intervalId);
    }, [loginClickCount]);

    const onPromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const newPrompt = event.target.value;
        setPrompt(newPrompt);
        const trimmedPrompt = newPrompt.trimStart();
        if (trimmedPrompt === '@' || trimmedPrompt === '/') {
            setShowPopover(true);
            filterPrefixSuggestions(trimmedPrompt);
        } else if (trimmedPrompt.startsWith('@') || trimmedPrompt.startsWith('/') || trimmedPrompt === '') {
            filterPrefixSuggestions(trimmedPrompt);
        } else {
            setShowPopover(false);
        }
    };

    const prefixSuggestionSelected = (event: any) => {
        const prefix = event.target.dataset['value'];

        if (prefix.includes(prompt)) {
            setPrompt(`${prefix} `);
        } else {
            setPrompt(`${prefix} ${prompt} `);
        }
        setShowPopover(false);
        promptInputRef.current?.focus();
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

        const promptPrefix = promptPrefixParts.length > 0 ? (promptPrefixParts.join(' ') + ' ') : '';

        const messageId = UUID.uuid4();
        const newList = [
            ...chatMessages,
            {
                id: messageId,
                date: new Date(),
                from: "user",
                contents: [{
                    id: messageId,
                    type: ResponseStreamDataType.Markdown,
                    content: prompt
                }],
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
            GitHubCopilot.sendWebSocketMessage(UUID.uuid4(), RequestDataType.ClearChatHistory, { chatId });
            return;
        } else if (prompt.startsWith('/logout')) {
            setChatMessages([]);
            setPrompt('');
            resetChatId();
            resetPrefixSuggestions();
            setPromptHistory([]);
            setPromptHistoryIndex(0);
            await GitHubCopilot.logoutFromGitHub();
            setLoginClickCount(loginClickCount + 1);
            return;
        }

        setCopilotRequestInProgress(true);

        const activeDocInfo: IActiveDocumentInfo = props.getActiveDocumentInfo();
        const newNotebookPrefix = '/newNotebook ';
        const isNewNotebook = prompt.startsWith(newNotebookPrefix);
        const extractedPrompt = isNewNotebook ? prompt.substring(newNotebookPrefix.length) : prompt;
        const serverRoot = activeDocInfo.serverRoot!;
        const parentDirectory = activeDocInfo.parentDirectory!;
        const contents: IChatMessageContent[] = [];

        submitCompletionRequest({
            chatId,
            type: isNewNotebook ? RunChatCompletionType.NewNotebook : RunChatCompletionType.Chat,
            content: extractedPrompt,
            language: activeDocInfo.language,
            filename: activeDocInfo.filename,
            parentDirectory
        }, {
            emit: (response) => {
                let responseMessage = '';
                let notebookPath = undefined;
                if (isNewNotebook) {
                    if (response.data.notebook_path) {
                        notebookPath = response.data.notebook_path;
                        if (notebookPath.startsWith(serverRoot)) {
                            notebookPath = notebookPath.substring(serverRoot.length + 1);
                        }
                        responseMessage = `Notebook saved to **${notebookPath}**`;
                    } else {
                        responseMessage = `Failed to generate notebook. Please try again.`;
                    }
                } else {
                    if (response.type === 'StreamMessage') {
                        const delta = response.data["choices"]?.[0]?.["delta"];
                        if (!delta) {
                            return;
                        }
                        if (delta["nbiContent"]) {
                            const nbiContent = delta["nbiContent"];
                            contents.push({
                                id: response.id,
                                type: nbiContent.type,
                                content: nbiContent.content
                            });
                        } else {
                            responseMessage = response.data["choices"]?.[0]?.["delta"]?.["content"];
                            if (!responseMessage) {
                                return;
                            }
                            contents.push({
                                id: response.id,
                                type: ResponseStreamDataType.Markdown,
                                content: responseMessage
                            });
                        }
                    } else if (response.type === 'StreamEnd') {
                        setCopilotRequestInProgress(false);
                    }
                }
                const messageId = UUID.uuid4();
                setChatMessages([
                    ...newList,
                    {
                        id: messageId,
                        date: new Date(),
                        from: 'copilot',
                        contents: contents,
                        notebookLink: notebookPath
                    }
                ]);
            }
        });
        setPrompt(promptPrefix);
        filterPrefixSuggestions(promptPrefix);

    };

    const filterPrefixSuggestions = (prmpt: string) => {
        const userInput = prmpt.trimStart();
        if (userInput === '') {
            setPrefixSuggestions(originalPrefixes);
        } else {
            setPrefixSuggestions(originalPrefixes.filter(prefix => prefix.includes(userInput)));
        }
    };

    const resetPrefixSuggestions = () => {
        setPrefixSuggestions(originalPrefixes);
    };
    const resetChatId = () => {
        setChatId(UUID.uuid4());
    };

    const onPromptKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key == 'Enter') {
            event.stopPropagation();
            event.preventDefault();
            handleUserInputSubmit();
        } else if (event.key == 'Escape') {
            event.stopPropagation();
            event.preventDefault();
            setShowPopover(false);
        } else if (event.key == 'ArrowUp') {
            event.stopPropagation();
            event.preventDefault();
            setShowPopover(false);
            // first time up key press
            if (promptHistory.length > 0 && promptHistoryIndex == promptHistory.length) {
                setDraftPrompt(prompt);
            }

            if (promptHistory.length > 0 && promptHistoryIndex > 0 && promptHistoryIndex <= promptHistory.length) {
                const prevPrompt = promptHistory[promptHistoryIndex - 1];
                const newIndex = promptHistoryIndex - 1;
                setPrompt(prevPrompt);
                setPromptHistoryIndex(newIndex);
            }
        } else if (event.key == 'ArrowDown') {
            event.stopPropagation();
            event.preventDefault();
            setShowPopover(false);
            if (promptHistory.length > 0 && promptHistoryIndex >= 0 && promptHistoryIndex < promptHistory.length) {
                if (promptHistoryIndex == promptHistory.length - 1) {
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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    };

    const handleLoginClick = async () => {
        const response = await GitHubCopilot.loginToGitHub();
        setDeviceActivationURL((response as any).verificationURI);
        setDeviceActivationCode((response as any).userCode);
        setLoginClickCount(loginClickCount + 1);
    };

    // const handleLogoutClick = () => {
    //     // GitHubCopilot.logoutFromGitHub();
    //     setLoginClickCount(loginClickCount + 1);
    // };

    useEffect(() => {
        scrollMessagesToBottom();
    }, [copilotRequestInProgress]);

    const promptRequestHandler = useCallback((eventData: any) => {
        const request: IRunChatCompletionRequest = eventData.detail;
        const message = request.type === RunChatCompletionType.ExplainThis ?
            `Explain this code:\n\`\`\`\n${request.content}\n\`\`\`\n` :
            `Fix this code:\n\`\`\`\n${request.content}\n\`\`\`\n`;
        const messageId = UUID.uuid4();
        const newList = [
            ...chatMessages,
            {
                id: messageId,
                date: new Date(),
                from: 'user',
                contents: [{
                    id: messageId,
                    type: ResponseStreamDataType.Markdown,
                    content: message
                }]
            }
        ];
        setChatMessages(newList);

        setCopilotRequestInProgress(true);
        submitCompletionRequest(request, {
            emit: (response) => {
                const messageId = UUID.uuid4();
                setChatMessages([
                    ...newList,
                    {
                        id: messageId,
                        date: new Date(),
                        from: 'copilot',
                        contents: [{
                            id: messageId,
                            type: ResponseStreamDataType.Markdown,
                            content: response.data.message
                        }]
                    }
                ]);
                setCopilotRequestInProgress(false);
            }
        });
    }, [chatMessages]);

    useEffect(() => {
        document.addEventListener("copilotSidebar:runPrompt", promptRequestHandler);

        return () => {
            document.removeEventListener("copilotSidebar:runPrompt", promptRequestHandler);
        }
    }, [chatMessages]);


    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className='sidebar-title'>Copilot Chat</div>
                <div className='sidebar-copilot-status'>
                    {ghLoginStatus === GitHubCopilotLoginStatus.ActivatingDevice ?
                        (<div>Activating device...</div>) :
                        ghLoginStatus === GitHubCopilotLoginStatus.LoggingIn ?
                            (<div>Logging in...</div>) : null
                    }
                </div>
            </div>
            {ghLoginStatus === GitHubCopilotLoginStatus.NotLoggedIn && (
                <div className='sidebar-login-info'>
                    <div>
                        Your GitHub tokens, code and data is directly transferred to GitHub Copilot as needed without storing any copies other than keeping in the process memory.</div>
                    <div>GitHub Copilot requires a subscription and it is free for some users.
                        GitHub Copilot is subject to the <a href="https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features" target="_blank">GitHub Terms for Additional Products and Features</a>.</div>
                    <div>
                        <h3>Privacy and terms</h3>

                        By using Copilot Chat you agree to <a href="https://docs.github.com/en/copilot/responsible-use-of-github-copilot-features/responsible-use-of-github-copilot-chat-in-your-ide" target='_blank'>GitHub Copilot chat terms</a>. Review the terms to understand about usage, limitations and ways to improve Copilot Chat. Please review <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank">Privacy Statement</a> to ensure that your code snippets will not be used as suggested code for other users of GitHub Copilot.</div>
                    <div>Activate this app for access to GitHub Copilot service</div>
                    <div><button onClick={handleLoginClick}>Activate using GitHub account</button></div>
                </div>
            )}
            {
                (ghLoginStatus === GitHubCopilotLoginStatus.ActivatingDevice && deviceActivationURL && deviceActivationCode) &&
                (<div className='copilot-activation-message'>Please visit <a href={deviceActivationURL} target='_blank'>{deviceActivationURL}</a> and use code <span className="user-code-span" onClick={() => { navigator.clipboard.writeText(deviceActivationCode); return true; }}><b>{deviceActivationCode}&#x1F4CB;</b></span> to allow access to GitHub Copilot from this app.</div>)
            }
            {ghLoginStatus === GitHubCopilotLoginStatus.LoggedIn && chatMessages.length == 0 ?
                (
                    <div className="sidebar-messages">
                        <div className="sidebar-greeting">
                            Welcome! How can I assist you today?
                        </div>
                    </div>
                ) : (
                    <div className="sidebar-messages">
                        {chatMessages.map((msg, index) => (
                            <ChatResponse key={`key-${index}`} message={msg} openFile={props.openFile} getApp={props.getApp} />
                        ))}
                        <div className='copilot-progress-row' style={{ display: `${copilotRequestInProgress ? 'flex' : 'none'}` }}>
                            <div className='copilot-progress'></div>
                        </div>
                        <div ref={messagesEndRef} />
                    </div>
                )}
            {ghLoginStatus === GitHubCopilotLoginStatus.LoggedIn && (
                <div className="sidebar-user-input">
                    <textarea ref={promptInputRef} rows={3} onChange={onPromptChange} onKeyDown={onPromptKeyDown} placeholder='Ask Copilot...' spellCheck={false} value={prompt} />
                    <div className="user-input-context-row">
                        {/* <div>Context</div> */}
                    </div>
                    <div className="user-input-footer">
                        <div><a href='javascript:void(0)' onClick={() => setShowPopover(true)} title='Select chat participant'>@</a></div>
                        <div style={{ flexGrow: 1 }}></div>
                        <div><button onClick={() => handleUserInputSubmit()} disabled={prompt.length == 0}>Send</button></div>
                    </div>
                    {showPopover && prefixSuggestions.length > 0 && (
                        <div className="user-input-autocomplete">
                            {prefixSuggestions.map((prefix, index) => (
                                <div key={`key-${index}`} className='user-input-autocomplete-item' data-value={prefix} onClick={(event) => prefixSuggestionSelected(event)}>{prefix}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
