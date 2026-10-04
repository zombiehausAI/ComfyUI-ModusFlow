import * as vscode from "vscode";
import { ComfyClient } from "./comfyClient";

export async function runOllamaRefinerAction(client: ComfyClient, action: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage("Open a prompt file to refine selection.");
        return;
    }

    let selection = editor.selection;
    let selectedText = editor.document.getText(selection).trim();

    // If no explicit selection, snap to word under cursor
    if (!selectedText) {
        const wordRange = editor.document.getWordRangeAtPosition(selection.active, /[a-zA-Z0-9_\-:#.]+/);
        if (wordRange) {
            selection = new vscode.Selection(wordRange.start, wordRange.end);
            selectedText = editor.document.getText(selection).trim();
        }
    }

    if (!selectedText) {
        vscode.window.showInformationMessage("Highlight a word or phrase to refine with Ollama.");
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `ModusFlow Ollama: Refining "${selectedText.length > 25 ? selectedText.substring(0, 25) + '...' : selectedText}"...`,
            cancellable: false
        },
        async () => {
            const res = await client.refineSelection(selectedText, action);
            if (!res.success) {
                vscode.window.showErrorMessage(`Ollama Refiner Error: ${res.message || "Failed"}`);
                return;
            }

            if (action === "synonyms" && res.choices && res.choices.length > 0) {
                const pickItems = res.choices.map(c => ({
                    label: c,
                    description: "Replace selection with this synonym"
                }));
                const wrapOpt = {
                    label: "⚄ Wrap all into {choice|choice}",
                    description: `Format as {${selectedText}|${res.choices.join("|")}}`
                };
                const picked = await vscode.window.showQuickPick([wrapOpt, ...pickItems], {
                    placeHolder: `Pick an alternative for "${selectedText}"`
                });
                if (!picked) return;

                editor.edit(editBuilder => {
                    if (picked === wrapOpt) {
                        editBuilder.replace(selection, `{${selectedText}|${res.choices!.join("|")}}`);
                    } else {
                        editBuilder.replace(selection, picked.label);
                    }
                });
                return;
            }

            if (res.refined_text) {
                editor.edit(editBuilder => {
                    editBuilder.replace(selection, res.refined_text!);
                });
                vscode.window.showInformationMessage(`✨ Inpainted with Ollama (${action})`);
            }
        }
    );
}
