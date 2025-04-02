// Copyright (c) Mehmet Bektas <mbektasgh@outlook.com>
import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { VscNewFile, VscInsert, VscCopy, VscNotebook, VscAdd } from 'react-icons/vsc';
import { isDarkTheme } from './utils';
export function MarkdownRenderer({ children: markdown, getApp, getActiveDocumentInfo }) {
    const app = getApp();
    const activeDocumentInfo = getActiveDocumentInfo();
    const isNotebook = activeDocumentInfo.filename.endsWith('.ipynb');
    return (React.createElement(Markdown, { remarkPlugins: [remarkGfm], components: {
            code({ node, inline, className, children, getApp, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                const language = match ? match[1] : 'text';
                const handleCopyClick = () => {
                    navigator.clipboard.writeText(codeString);
                };
                const handleInsertAtCursorClick = () => {
                    app.commands.execute('notebook-intelligence:insert-at-cursor', {
                        language,
                        code: codeString
                    });
                };
                const handleAddCodeAsNewCell = () => {
                    app.commands.execute('notebook-intelligence:add-code-as-new-cell', {
                        language,
                        code: codeString
                    });
                };
                const handleCreateNewFileClick = () => {
                    app.commands.execute('notebook-intelligence:create-new-file', {
                        language,
                        code: codeString
                    });
                };
                const handleCreateNewNotebookClick = () => {
                    app.commands.execute('notebook-intelligence:create-new-notebook-from-py', { language, code: codeString });
                };
                return !inline && match ? (React.createElement("div", null,
                    React.createElement("div", { className: "code-block-header" },
                        React.createElement("div", { className: "code-block-header-language" },
                            React.createElement("span", null, language)),
                        React.createElement("div", { className: "code-block-header-button", onClick: () => handleCopyClick() },
                            React.createElement(VscCopy, { size: 16, title: "Copy to clipboard" }),
                            React.createElement("span", null, "Copy")),
                        React.createElement("div", { className: "code-block-header-button", onClick: () => handleInsertAtCursorClick() },
                            React.createElement(VscInsert, { size: 16, title: "Insert at cursor" })),
                        isNotebook && (React.createElement("div", { className: "code-block-header-button", onClick: () => handleAddCodeAsNewCell() },
                            React.createElement(VscAdd, { size: 16, title: "Add as new cell" }))),
                        React.createElement("div", { className: "code-block-header-button", onClick: () => handleCreateNewFileClick() },
                            React.createElement(VscNewFile, { size: 16, title: "New file" })),
                        language === 'python' && (React.createElement("div", { className: "code-block-header-button", onClick: () => handleCreateNewNotebookClick() },
                            React.createElement(VscNotebook, { size: 16, title: "New notebook" })))),
                    React.createElement(SyntaxHighlighter, { style: isDarkTheme() ? oneDark : oneLight, PreTag: "div", language: language, ...props }, codeString))) : (React.createElement("code", { className: className, ...props }, children));
            }
        } }, markdown));
}
