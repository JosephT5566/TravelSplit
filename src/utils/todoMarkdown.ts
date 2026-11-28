import {
    groupTodosByCategory,
    sanitizeTodoLineBreaks,
} from "./todoList.ts";

export type TodoMarkdownItem = {
    text: string;
    checked: boolean;
    category?: string;
    createdAt: string;
};

export type FormatTodosAsMarkdownOptions = {
    ownerDisplayName: string;
};

const MARKDOWN_SPECIAL_CHAR_PATTERN = /[\\`*_[\]#<>~|]/g;

/**
 * Backslash-escapes Markdown syntax characters while leaving Chinese text
 * untouched and converting any embedded line breaks to single spaces.
 */
export function escapeMarkdownText(raw: string): string {
    return sanitizeTodoLineBreaks(raw).replace(
        MARKDOWN_SPECIAL_CHAR_PATTERN,
        "\\$&",
    );
}

/**
 * Formats a todo list as a GitHub-Flavored Markdown task list grouped in the
 * exact UI order (earliest createdAt per group, 未分類 last).
 */
export function formatTodosAsMarkdown(
    items: readonly TodoMarkdownItem[],
    { ownerDisplayName }: FormatTodosAsMarkdownOptions,
): string {
    const trimmedOwner = sanitizeTodoLineBreaks(ownerDisplayName).trim();
    const safeOwnerName = trimmedOwner || "我";
    const title = `## ${escapeMarkdownText(safeOwnerName)} 的待辦清單`;

    const groups = groupTodosByCategory(items);
    if (groups.length === 0) {
        return `${title}\n`;
    }

    const sections = groups.map((group) => {
        const lines: string[] = [];
        if (group.showHeader) {
            lines.push(`### ${escapeMarkdownText(group.label)}`);
        }
        for (const item of group.items) {
            const marker = item.checked ? "x" : " ";
            lines.push(`- [${marker}] ${escapeMarkdownText(item.text)}`);
        }
        return lines.join("\n");
    });

    return `${title}\n\n${sections.join("\n\n")}\n`;
}
