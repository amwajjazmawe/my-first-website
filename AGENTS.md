# Repository Guidelines

## Project Structure & Module Organization

This is a small, static, browser-based task manager. The repository root contains the app: `index.html` defines the Hebrew right-to-left interface, `styles.css` provides responsive styling, and `app.js` handles task behavior and browser storage. There are no separate source, asset, or test directories at present; keep related files together unless the project grows enough to justify folders.

## Build, Test, and Development Commands

There is no package manifest or build pipeline. Open `index.html` directly in a modern browser for quick review. To serve it locally over HTTP, run `python -m http.server 8000` from the repository root and visit `http://localhost:8000`. Stop the server with Ctrl+C. No automated test command is currently configured.

## Coding Style & Naming Conventions

Use two spaces for indentation in JavaScript and HTML. Keep JavaScript framework-free and organized into small functions; use `camelCase` for variables/functions and uppercase names for constants (for example, `STORAGE_KEY`). Use descriptive, lowercase kebab-case CSS classes (for example, `.task-row`) and keep responsive rules close to the existing media-query conventions. Preserve Hebrew text, RTL layout, accessible labels, and the current local-storage data compatibility when changing behavior. Escape user-provided text before inserting it into HTML.

## Testing Guidelines

No test framework or coverage target is configured. For UI or behavior changes, manually check task creation, editing, completion, filtering, sorting, due-date states, and persistence after reload. Review both desktop and narrow mobile layouts, and verify keyboard use and visible focus states.

## Commit & Pull Request Guidelines

Git history could not be inspected in this environment, so no established commit convention is known. Use short, imperative commit subjects such as `Improve task filtering`. Pull requests should explain the user-visible change, list manual checks performed, link related issues when applicable, and include screenshots for visual changes.

## Security & Configuration

The app stores task data in browser `localStorage`; do not commit personal task data, secrets, or environment-specific configuration. Keep dynamic content escaped and avoid adding external dependencies without a clear need.
