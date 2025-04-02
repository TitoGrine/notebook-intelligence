import React from 'react';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { IActiveDocumentInfo } from './tokens';
type MarkdownRendererProps = {
    children: string;
    getApp: () => JupyterFrontEnd;
    getActiveDocumentInfo(): IActiveDocumentInfo;
};
export declare function MarkdownRenderer({ children: markdown, getApp, getActiveDocumentInfo }: MarkdownRendererProps): React.JSX.Element;
export {};
