// Copyright (c) Mehmet Bektas <mbektasgh@outlook.com>
import { encoding_for_model } from 'tiktoken';
const tiktoken_encoding = encoding_for_model('gpt-4o');
export function removeAnsiChars(str) {
    return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}
export async function waitForDuration(duration) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, duration);
    });
}
export function moveCodeSectionBoundaryMarkersToNewLine(source) {
    const existingLines = source.split('\n');
    const newLines = [];
    for (const line of existingLines) {
        if (line.length > 3 && line.startsWith('```')) {
            newLines.push('```');
            let remaining = line.substring(3);
            if (remaining.startsWith('python')) {
                if (remaining.length === 6) {
                    continue;
                }
                remaining = remaining.substring(6);
            }
            if (remaining.endsWith('```')) {
                newLines.push(remaining.substring(0, remaining.length - 3));
                newLines.push('```');
            }
            else {
                newLines.push(remaining);
            }
        }
        else if (line.length > 3 && line.endsWith('```')) {
            newLines.push(line.substring(0, line.length - 3));
            newLines.push('```');
        }
        else {
            newLines.push(line);
        }
    }
    return newLines.join('\n');
}
export function extractLLMGeneratedCode(code) {
    if (code.endsWith('```')) {
        code = code.slice(0, -3);
    }
    const lines = code.split('\n');
    if (lines.length < 2) {
        return code;
    }
    const numLines = lines.length;
    let startLine = -1;
    let endLine = numLines;
    for (let i = 0; i < numLines; i++) {
        if (startLine === -1) {
            if (lines[i].trimStart().startsWith('```')) {
                startLine = i;
                continue;
            }
        }
        else {
            if (lines[i].trimStart().startsWith('```')) {
                endLine = i;
                break;
            }
        }
    }
    if (startLine !== -1) {
        return lines.slice(startLine + 1, endLine).join('\n');
    }
    return code;
}
export function isDarkTheme() {
    return document.body.getAttribute('data-jp-theme-light') === 'false';
}
export function markdownToComment(source) {
    return source
        .split('\n')
        .map(line => `# ${line}`)
        .join('\n');
}
export function cellOutputAsText(cell) {
    let content = '';
    const outputs = cell.outputArea.model.toJSON();
    for (const output of outputs) {
        if (output.output_type === 'execute_result') {
            content +=
                typeof output.data === 'object' && output.data !== null
                    ? output.data['text/plain']
                    : '' + '\n';
        }
        else if (output.output_type === 'stream') {
            content += output.text + '\n';
        }
        else if (output.output_type === 'error') {
            if (Array.isArray(output.traceback)) {
                content += output.ename + ': ' + output.evalue + '\n';
                content +=
                    output.traceback
                        .map(item => removeAnsiChars(item))
                        .join('\n') + '\n';
            }
        }
    }
    return content;
}
export function getTokenCount(source) {
    const tokens = tiktoken_encoding.encode(source);
    return tokens.length;
}
export function compareSelectionPoints(lhs, rhs) {
    return lhs.line === rhs.line && lhs.column === rhs.column;
}
export function compareSelections(lhs, rhs) {
    // if one undefined
    if ((!lhs || !rhs) && !(!lhs && !rhs)) {
        return true;
    }
    return (lhs === rhs ||
        (compareSelectionPoints(lhs.start, rhs.start) &&
            compareSelectionPoints(lhs.end, rhs.end)));
}
export function isSelectionEmpty(selection) {
    return (selection.start.line === selection.end.line &&
        selection.start.column === selection.end.column);
}
export function getSelectionInEditor(editor) {
    const selection = editor.getSelection();
    const startOffset = editor.getOffsetAt(selection.start);
    const endOffset = editor.getOffsetAt(selection.end);
    return editor.model.sharedModel.getSource().substring(startOffset, endOffset);
}
export function getWholeNotebookContent(np) {
    let content = '';
    for (const cell of np.content.widgets) {
        const cellModel = cell.model.sharedModel;
        if (cellModel.cell_type === 'code') {
            content += cellModel.source + '\n';
        }
        else if (cellModel.cell_type === 'markdown') {
            content += markdownToComment(cellModel.source) + '\n';
        }
    }
    return content;
}
export function applyCodeToSelectionInEditor(editor, code) {
    var _a;
    const selection = editor.getSelection();
    const startOffset = editor.getOffsetAt(selection.start);
    const endOffset = editor.getOffsetAt(selection.end);
    editor.model.sharedModel.updateSource(startOffset, endOffset, code);
    const numAddedLines = code.split('\n').length;
    const cursorLine = Math.min(selection.start.line + numAddedLines - 1, editor.lineCount - 1);
    const cursorColumn = ((_a = editor.getLine(cursorLine)) === null || _a === void 0 ? void 0 : _a.length) || 0;
    editor.setCursorPosition({
        line: cursorLine,
        column: cursorColumn
    });
}
