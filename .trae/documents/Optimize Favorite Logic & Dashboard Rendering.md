
# Optimize Favorite Logic & Dashboard Rendering

I will implement the following changes to enable toggle-save functionality and fix the dashboard rendering for Markdown content.

## 1. Toggle Save Logic (Background & Content Script)
### Background (`service-worker.js`)
- Update `handleCheckIsSaved` to return the `id` of the saved word if it exists, not just a boolean.
- This allows the Content Script to know *which* ID to delete when toggling off.

### Content Script (`content-script.js`)
- Update `checkIsSaved` to store the returned `savedId`.
- Modify `toggleSave`:
  - **If already saved**: Call `REMOVE_WORD` using the stored `savedId`, then update the UI (empty star).
  - **If not saved**: Call `SAVE_WORD`, then store the returned `id` and update the UI (filled star).

## 2. Dashboard Rendering (Dashboard)
### Dashboard Logic (`dashboard.js`)
- Update `createCard` to check for the new data format (`data.html` / `data.markdown`).
- **New Format**: Render the stored HTML directly inside a `.lc-markdown` container within the card. This ensures all rich text (tables, lists, quotes) is displayed correctly.
- **Legacy Format**: Retain the existing rendering logic for older saved items (backward compatibility).

### Dashboard Styles (`dashboard.css`)
- Port the `.lc-markdown` CSS styles from `content/styles.css` to `dashboard/dashboard.css`.
- Ensure Markdown elements (headers, tables, lists, code blocks) look consistent in the dashboard.

## Verification
- **Toggle Save**: Verify that clicking the star icon in the overlay repeatedly toggles between "Saved" (filled) and "Unsaved" (empty) states without errors.
- **Dashboard**: Open the dashboard and verify that newly saved Markdown content is rendered correctly (not empty), with proper formatting for headers, lists, and tables.
