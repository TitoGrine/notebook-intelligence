import { Signal } from '@lumino/signaling';
import { IChatCompletionResponseEmitter, IChatParticipant, IContextItem, ITelemetryEvent, RequestDataType } from './tokens';
export declare enum GitHubCopilotLoginStatus {
    NotLoggedIn = "NOT_LOGGED_IN",
    ActivatingDevice = "ACTIVATING_DEVICE",
    LoggingIn = "LOGGING_IN",
    LoggedIn = "LOGGED_IN"
}
export interface IDeviceVerificationInfo {
    verificationURI: string;
    userCode: string;
}
export declare class NBIConfig {
    get llmProviders(): [any];
    get chatModels(): [any];
    get inlineCompletionModels(): [any];
    get chatModel(): any;
    get inlineCompletionModel(): any;
    get usingGitHubCopilotModel(): boolean;
    capabilities: any;
    chatParticipants: IChatParticipant[];
    changed: Signal<this, void>;
}
export declare class NBIAPI {
    static _loginStatus: GitHubCopilotLoginStatus;
    static _deviceVerificationInfo: IDeviceVerificationInfo;
    static _webSocket: WebSocket;
    static _messageReceived: Signal<unknown, any>;
    static config: NBIConfig;
    static configChanged: Signal<NBIConfig, void>;
    static initialize(): Promise<void>;
    static initializeWebsocket(): Promise<void>;
    static getLoginStatus(): GitHubCopilotLoginStatus;
    static getDeviceVerificationInfo(): IDeviceVerificationInfo;
    static loginToGitHub(): Promise<unknown>;
    static logoutFromGitHub(): Promise<unknown>;
    static updateGitHubLoginStatus(): Promise<void>;
    static fetchCapabilities(): Promise<void>;
    static setConfig(config: any): Promise<void>;
    static updateOllamaModelList(): Promise<void>;
    static chatRequest(messageId: string, chatId: string, prompt: string, language: string, filename: string, additionalContext: IContextItem[], responseEmitter: IChatCompletionResponseEmitter): Promise<void>;
    static generateCode(chatId: string, prompt: string, prefix: string, suffix: string, existingCode: string, language: string, filename: string, responseEmitter: IChatCompletionResponseEmitter): Promise<void>;
    static sendChatUserInput(messageId: string, data: any): Promise<void>;
    static sendWebSocketMessage(messageId: string, messageType: RequestDataType, data: any): Promise<void>;
    static inlineCompletionsRequest(chatId: string, messageId: string, prefix: string, suffix: string, language: string, filename: string, responseEmitter: IChatCompletionResponseEmitter): Promise<void>;
    static emitTelemetryEvent(event: ITelemetryEvent): Promise<void>;
}
