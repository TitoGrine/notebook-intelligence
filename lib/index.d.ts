import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookIntelligence } from './tokens';
/**
 * Initialization data for the @notebook-intelligence/notebook-intelligence extension.
 */
declare const plugin: JupyterFrontEndPlugin<INotebookIntelligence>;
export * from './tokens';
export default plugin;
