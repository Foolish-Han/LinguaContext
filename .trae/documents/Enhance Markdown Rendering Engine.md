I will upgrade the Markdown rendering engine to support more features.

### 1. Update `parseMarkdown` in `src/content/content-script.js`
- **Support Headings H4-H6**: Extend the current H1-H3 support to cover `####`, `#####`, and `######`.
- **Support Ordered Lists**: Add recognition for numbered lists (e.g., `1. Item`), rendering them as `<ol>`.
- **Support Strikethrough**: Add parsing for `~~deleted text~~` -> `<del>deleted text</del>`.
- **Refactor Heading Logic**: Use a regex approach to handle all heading levels (H1-H6) more cleanly.

### 2. Update Styles in `src/dashboard/dashboard.css`
- **Add H4-H6 Styles**: Define font sizes and weights for the new heading levels to match the dark theme.
- **Add Ordered List Styles**: Ensure `<ol>` is styled correctly with numbers.
- **Add Strikethrough Styles**: Ensure `<del>` text appears with a line-through and slightly dimmed color.

This will ensure a more complete Markdown rendering experience in both the popup overlay and the dashboard.