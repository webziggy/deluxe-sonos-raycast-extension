# Maintainability & Architecture Rules

When generating code, refactoring, or proposing architectural changes, you MUST adhere to the following maintainability principles. These rules apply regardless of the language, framework, or platform being used.

## 1. Centralized State & Configuration
- **No Scattered State**: Do not instantiate raw cache, storage, or database connections directly inside UI components or deeply nested functions. 
- **Single Source of Truth**: Centralize state management, API clients, and configuration reads/writes into dedicated, strictly-typed manager files (e.g., `CacheManager`, `StorageService`). 

## 2. Explicit Error Handling
- **No Silent Failures**: Never use empty `catch (e) {}` blocks or swallow exceptions silently.
- **Log and Surface**: All caught errors must be explicitly logged (e.g., `console.error`, `log.error`) with contextual information so they can be debugged. When appropriate, surface the error gracefully to the user interface.

## 3. Component Modularity & Size
- **Avoid God Objects**: UI components and classes should have a single responsibility. If a file or component grows too large (e.g., handling UI rendering, network polling, and business logic simultaneously), you MUST proactively break it down into smaller, composable pieces.
- **Extract Complex Logic**: Move complex parsing, data transformation, and business logic out of UI components and into pure, testable helper functions or services.

## 4. Formal Documentation
- **Self-Documenting is Not Enough**: While variables and functions must be named semantically, you MUST also provide formal documentation headers (e.g., JSDoc, Dartdoc, Python Docstrings) for all public functions, classes, and complex logic blocks.
- **Explain the 'Why'**: Documentation should focus on *why* a decision was made, lifecycle expectations, edge cases, and side-effects, rather than just repeating what the code does.

## 5. Sensible Architecture
- **Think Before You Code**: Before writing a massive block of code, consider the long-term implications. Is this tightly coupling two unrelated systems? Is this going to be impossible to test? Propose sensible architectural patterns (like Dependency Injection, Service Layers, or Observer patterns) when building new features.
