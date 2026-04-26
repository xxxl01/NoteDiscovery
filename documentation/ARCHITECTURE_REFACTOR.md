# Architecture Refactor

This project has outgrown the current "large file" structure.

Current pressure points:

- `frontend/app.js`: application state, UI behavior, editor logic, search, AI, graph, sharing, export, routing
- `frontend/index.html`: layout, styles, templates, modal markup, panel markup
- `backend/main.py`: config loading, auth, API routes, AI, files, templates, tags, graph, sharing

The goal is not a rewrite. The goal is to establish stable boundaries and then move code incrementally.

## Target frontend structure

Suggested split under `frontend/`:

- `app.js`
  - app bootstrap only
  - root state assembly
  - wires modules together
- `ai-panel.js`
  - AI sidebar state transitions and requests
- `notes.js`
  - note CRUD, loading, saving, rename, delete
- `editor.js`
  - editor behavior, autosave, undo/redo, keyboard handling
- `search.js`
  - search UI state, highlighting, quick switcher
- `folders.js`
  - folder tree, drag/drop, folder actions
- `graph.js`
  - graph initialization and interactions
- `sharing.js`
  - share modal and token actions
- `templates.js`
  - template listing and create-from-template flow

Rule:

- A module owns one panel or one capability.
- Cross-module access should happen through root state, not hidden globals.

## Target backend structure

Suggested split under `backend/`:

- `main.py`
  - app creation
  - middleware
  - router registration
  - static/index serving
- `config.py`
  - config loading and env overrides
- `auth.py`
  - auth helpers and dependencies
- `ai.py`
  - AI request models and provider calls
- `routes/notes.py`
  - note CRUD and media upload
- `routes/folders.py`
  - folder APIs
- `routes/search.py`
  - search and recent notes
- `routes/templates.py`
  - template APIs
- `routes/graph.py`
  - graph and backlinks
- `routes/system.py`
  - config, health, themes, locales

Rule:

- Route files should stay thin.
- Business logic belongs in helpers/services, not route handlers.

## Refactor order

Refactor in this order:

1. AI
2. templates
3. sharing
4. graph
5. notes CRUD
6. editor behavior
7. search and quick switcher

Reason:

- These areas are relatively separable.
- AI is directly related to the planned "quick capture" feature.
- Notes/editor are the most coupled and should be moved later, after patterns are proven.

## Definition of done for each extraction

An extraction is complete only when:

- the module has a single clear responsibility
- the original large file becomes smaller
- behavior remains unchanged
- minimal verification passes

## Immediate next step

After the initial AI extraction, the next practical step is:

- add a dedicated "quick capture" backend module
- add dedicated AI panel actions instead of generic chat-only behavior
- keep write target fixed to an inbox-style note first
