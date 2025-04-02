// Copyright (c) Mehmet Bektas <mbektasgh@outlook.com>
var _a;
import { ServerConnection } from '@jupyterlab/services';
import { requestAPI } from './handler';
import { URLExt } from '@jupyterlab/coreutils';
import { UUID } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import { GITHUB_COPILOT_PROVIDER_ID, RequestDataType } from './tokens';
const LOGIN_STATUS_UPDATE_INTERVAL = 2000;
export var GitHubCopilotLoginStatus;
(function (GitHubCopilotLoginStatus) {
    GitHubCopilotLoginStatus["NotLoggedIn"] = "NOT_LOGGED_IN";
    GitHubCopilotLoginStatus["ActivatingDevice"] = "ACTIVATING_DEVICE";
    GitHubCopilotLoginStatus["LoggingIn"] = "LOGGING_IN";
    GitHubCopilotLoginStatus["LoggedIn"] = "LOGGED_IN";
})(GitHubCopilotLoginStatus || (GitHubCopilotLoginStatus = {}));
export class NBIConfig {
    constructor() {
        this.capabilities = {};
        this.chatParticipants = [];
        this.changed = new Signal(this);
    }
    get llmProviders() {
        return this.capabilities.llm_providers;
    }
    get chatModels() {
        return this.capabilities.chat_models;
    }
    get inlineCompletionModels() {
        return this.capabilities.inline_completion_models;
    }
    get chatModel() {
        return this.capabilities.chat_model;
    }
    get inlineCompletionModel() {
        return this.capabilities.inline_completion_model;
    }
    get usingGitHubCopilotModel() {
        return (this.chatModel.provider === GITHUB_COPILOT_PROVIDER_ID ||
            this.inlineCompletionModel.provider === GITHUB_COPILOT_PROVIDER_ID);
    }
}
class NBIAPI {
    static async initialize() {
        await this.fetchCapabilities();
        this.updateGitHubLoginStatus();
        setInterval(() => {
            this.updateGitHubLoginStatus();
        }, LOGIN_STATUS_UPDATE_INTERVAL);
        NBIAPI.initializeWebsocket();
    }
    static async initializeWebsocket() {
        const serverSettings = ServerConnection.makeSettings();
        const wsUrl = URLExt.join(serverSettings.wsUrl, 'notebook-intelligence', 'copilot');
        this._webSocket = new serverSettings.WebSocket(wsUrl);
        this._webSocket.onmessage = msg => {
            this._messageReceived.emit(msg.data);
        };
        this._webSocket.onerror = msg => {
            console.error(`Websocket error: ${msg}. Closing...`);
            this._webSocket.close();
        };
        this._webSocket.onclose = msg => {
            console.log(`Websocket is closed: ${msg.reason}. Reconnecting...`);
            setTimeout(() => {
                NBIAPI.initializeWebsocket();
            }, 1000);
        };
    }
    static getLoginStatus() {
        return this._loginStatus;
    }
    static getDeviceVerificationInfo() {
        return this._deviceVerificationInfo;
    }
    static async loginToGitHub() {
        this._loginStatus = GitHubCopilotLoginStatus.ActivatingDevice;
        return new Promise((resolve, reject) => {
            requestAPI('gh-login', { method: 'POST' })
                .then(data => {
                resolve({
                    verificationURI: data.verification_uri,
                    userCode: data.user_code
                });
                this.updateGitHubLoginStatus();
            })
                .catch(reason => {
                console.error(`Failed to login to GitHub Copilot.\n${reason}`);
                reject(reason);
            });
        });
    }
    static async logoutFromGitHub() {
        this._loginStatus = GitHubCopilotLoginStatus.ActivatingDevice;
        return new Promise((resolve, reject) => {
            requestAPI('gh-logout', { method: 'GET' })
                .then(data => {
                this.updateGitHubLoginStatus().then(() => {
                    resolve(data);
                });
            })
                .catch(reason => {
                console.error(`Failed to logout from GitHub Copilot.\n${reason}`);
                reject(reason);
            });
        });
    }
    static async updateGitHubLoginStatus() {
        return new Promise((resolve, reject) => {
            requestAPI('gh-login-status')
                .then(response => {
                this._loginStatus = response.status;
                this._deviceVerificationInfo.verificationURI =
                    response.verification_uri || '';
                this._deviceVerificationInfo.userCode = response.user_code || '';
                resolve();
            })
                .catch(reason => {
                console.error(`Failed to fetch GitHub Copilot login status.\n${reason}`);
                reject(reason);
            });
        });
    }
    static async fetchCapabilities() {
        return new Promise((resolve, reject) => {
            requestAPI('capabilities', { method: 'GET' })
                .then(data => {
                this.config.capabilities = structuredClone(data);
                this.config.chatParticipants = structuredClone(data.chat_participants);
                this.configChanged.emit();
                resolve();
            })
                .catch(reason => {
                console.error(`Failed to get extension capabilities.\n${reason}`);
                reject(reason);
            });
        });
    }
    static async setConfig(config) {
        requestAPI('config', {
            method: 'POST',
            body: JSON.stringify(config)
        })
            .then(data => {
            NBIAPI.fetchCapabilities();
        })
            .catch(reason => {
            console.error(`Failed to set NBI config.\n${reason}`);
        });
    }
    static async updateOllamaModelList() {
        return new Promise((resolve, reject) => {
            requestAPI('update-provider-models', {
                method: 'POST',
                body: JSON.stringify({ provider: 'ollama' })
            })
                .then(async (data) => {
                await NBIAPI.fetchCapabilities();
                resolve();
            })
                .catch(reason => {
                console.error(`Failed to update ollama model list.\n${reason}`);
                reject(reason);
            });
        });
    }
    static async chatRequest(messageId, chatId, prompt, language, filename, additionalContext, responseEmitter) {
        this._messageReceived.connect((_, msg) => {
            msg = JSON.parse(msg);
            if (msg.id === messageId) {
                responseEmitter.emit(msg);
            }
        });
        this._webSocket.send(JSON.stringify({
            id: messageId,
            type: RequestDataType.ChatRequest,
            data: { chatId, prompt, language, filename, additionalContext }
        }));
    }
    static async generateCode(chatId, prompt, prefix, suffix, existingCode, language, filename, responseEmitter) {
        const messageId = UUID.uuid4();
        this._messageReceived.connect((_, msg) => {
            msg = JSON.parse(msg);
            if (msg.id === messageId) {
                responseEmitter.emit(msg);
            }
        });
        this._webSocket.send(JSON.stringify({
            id: messageId,
            type: RequestDataType.GenerateCode,
            data: {
                chatId,
                prompt,
                prefix,
                suffix,
                existingCode,
                language,
                filename
            }
        }));
    }
    static async sendChatUserInput(messageId, data) {
        this._webSocket.send(JSON.stringify({
            id: messageId,
            type: RequestDataType.ChatUserInput,
            data
        }));
    }
    static async sendWebSocketMessage(messageId, messageType, data) {
        this._webSocket.send(JSON.stringify({ id: messageId, type: messageType, data }));
    }
    static async inlineCompletionsRequest(chatId, messageId, prefix, suffix, language, filename, responseEmitter) {
        this._messageReceived.connect((_, msg) => {
            msg = JSON.parse(msg);
            if (msg.id === messageId) {
                responseEmitter.emit(msg);
            }
        });
        this._webSocket.send(JSON.stringify({
            id: messageId,
            type: RequestDataType.InlineCompletionRequest,
            data: {
                chatId,
                prefix,
                suffix,
                language,
                filename
            }
        }));
    }
    static async emitTelemetryEvent(event) {
        return new Promise((resolve, reject) => {
            requestAPI('emit-telemetry-event', {
                method: 'POST',
                body: JSON.stringify(event)
            })
                .then(async (data) => {
                resolve();
            })
                .catch(reason => {
                console.error(`Failed to emit telemetry event.\n${reason}`);
                reject(reason);
            });
        });
    }
}
_a = NBIAPI;
NBIAPI._loginStatus = GitHubCopilotLoginStatus.NotLoggedIn;
NBIAPI._deviceVerificationInfo = {
    verificationURI: '',
    userCode: ''
};
NBIAPI._messageReceived = new Signal(_a);
NBIAPI.config = new NBIConfig();
NBIAPI.configChanged = _a.config.changed;
export { NBIAPI };
