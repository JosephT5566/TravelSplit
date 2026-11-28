export type CopyToClipboardResult = "ok" | "failed";

export interface ClipboardNavigatorLike {
    clipboard?: {
        writeText?: (text: string) => Promise<void>;
    };
}

export interface ClipboardTextareaLike {
    value: string;
    style?: {
        position?: string;
        top?: string;
        left?: string;
        opacity?: string;
        pointerEvents?: string;
    };
    setAttribute?: (name: string, value: string) => void;
    select?: () => void;
    setSelectionRange?: (start: number, end: number) => void;
    remove?: () => void;
}

export interface ClipboardDocumentLike {
    createElement?: (tagName: string) => ClipboardTextareaLike;
    execCommand?: (commandId: string) => boolean;
    body?: {
        appendChild?: (node: ClipboardTextareaLike) => unknown;
        removeChild?: (node: ClipboardTextareaLike) => unknown;
    } | null;
}

export interface ClipboardEnv {
    navigator?: ClipboardNavigatorLike | null;
    document?: ClipboardDocumentLike | null;
}

/**
 * Copies text to the system clipboard.
 * Tries navigator.clipboard.writeText first, then falls back to a hidden
 * readonly textarea + document.execCommand("copy").
 */
export async function copyTextToClipboard(
    text: string,
    env?: ClipboardEnv,
): Promise<CopyToClipboardResult> {
    const nav: ClipboardNavigatorLike | null | undefined =
        env && "navigator" in env
            ? env.navigator
            : typeof navigator !== "undefined"
              ? navigator
              : undefined;

    if (nav?.clipboard && typeof nav.clipboard.writeText === "function") {
        try {
            await nav.clipboard.writeText(text);
            return "ok";
        } catch {
            // Fall through to execCommand fallback.
        }
    }

    const doc: ClipboardDocumentLike | null | undefined =
        env && "document" in env
            ? env.document
            : typeof document !== "undefined"
              ? (document as unknown as ClipboardDocumentLike)
              : undefined;

    if (
        !doc ||
        typeof doc.createElement !== "function" ||
        !doc.body ||
        typeof doc.body.appendChild !== "function" ||
        typeof doc.execCommand !== "function"
    ) {
        return "failed";
    }

    let textarea: ClipboardTextareaLike | null = null;
    try {
        textarea = doc.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute?.("readonly", "");
        if (textarea.style) {
            textarea.style.position = "fixed";
            textarea.style.top = "0";
            textarea.style.left = "0";
            textarea.style.opacity = "0";
            textarea.style.pointerEvents = "none";
        }
        doc.body.appendChild(textarea);
        textarea.select?.();
        textarea.setSelectionRange?.(0, text.length);
        const copied = doc.execCommand("copy");
        return copied ? "ok" : "failed";
    } catch {
        return "failed";
    } finally {
        if (textarea) {
            try {
                if (typeof textarea.remove === "function") {
                    textarea.remove();
                } else {
                    doc.body?.removeChild?.(textarea);
                }
            } catch {
                // Ignore cleanup errors.
            }
        }
    }
}
