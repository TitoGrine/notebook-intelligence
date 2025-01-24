// Copyright (c) Mehmet Bektas <mbektasgh@outlook.com>

import { CodeCell } from '@jupyterlab/cells';
import { PartialJSONObject } from '@lumino/coreutils';

export function removeAnsiChars(str: string): string {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}

export async function waitForDuration(duration: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

export function moveCodeSectionBoundaryMarkersToNewLine(
  source: string
): string {
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
      } else {
        newLines.push(remaining);
      }
    } else if (line.length > 3 && line.endsWith('```')) {
      newLines.push(line.substring(0, line.length - 3));
      newLines.push('```');
    } else {
      newLines.push(line);
    }
  }
  return newLines.join('\n');
}

export function extractCodeFromMarkdown(source: string): string {
  // make sure end of code block is in new line
  source = moveCodeSectionBoundaryMarkersToNewLine(source);
  const codeBlockRegex = /^```(?:\w+)?\s*\n(.*?)(?=^```)```/gms;
  let code = '';
  let match;
  while ((match = codeBlockRegex.exec(source)) !== null) {
    code += match[1] + '\n';
  }
  return code.trim() || source;
}

export function isDarkTheme(): boolean {
  return document.body.getAttribute('data-jp-theme-light') === 'false';
}

export function markdownToComment(source: string): string {
  return source
    .split('\n')
    .map(line => `# ${line}`)
    .join('\n');
}

export function cellOutputAsText(cell: CodeCell): string {
  let content = '';
  const outputs = cell.outputArea.model.toJSON();
  for (const output of outputs) {
    if (output.output_type === 'execute_result') {
      content +=
        typeof output.data === 'object' && output.data !== null
          ? (output.data as PartialJSONObject)['text/plain']
          : '' + '\n';
    } else if (output.output_type === 'stream') {
      content += output.text + '\n';
    } else if (output.output_type === 'error') {
      if (Array.isArray(output.traceback)) {
        content += output.ename + ': ' + output.evalue + '\n';
        content +=
          output.traceback
            .map(item => removeAnsiChars(item as string))
            .join('\n') + '\n';
      }
    }
  }

  return content;
}
