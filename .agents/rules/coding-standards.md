---
trigger: always_on
---

# Coding Standards

Define your specific coding standard rules here. Antigravity IDE and other AI agents will read this file to adhere to your stylistic and structural preferences.

## TypeScript Imports
1. **Import Order**: 
   - First: External (npm) dependencies
   - Second: `@shared` imports
   - Third: `@server-core` imports (server-side TypeScript only)
   - Fourth: Relative imports (generally in order by path, starting with parent folders, then finally files in the current folder)
2. **Relative Paths**: When navigating up folders in relative imports, always use explicitly dotted paths starting with the current directory (`./../`), avoiding the shorter equivalent (`../`). Example: `import { Something } from './../some-folder';`

## Classes and Constructors
- **Member Declarations**: Avoid using `private`/`public` inline in constructor parameter declarations (parameter properties). Instead, explicitly declare class members at the top of the class, and assign them in the constructor body. 
  *(Example: see `account-controller.ts`)*

## Control Structures
- **Block Formatting**: When writing `if/else` or `try/catch` statements, always place the `else` or `catch` keyword on a new line, rather than on the same line as the closing brace of the preceding block.

  **Prefer**:
  ```typescript
  if (condition) {
      // ...
  }
  else {
      // ...
  }

  try {
      // ...
  }
  catch (error) {
      // ...
  }
  ```

## Server / Node Rules
- **Unique IDs**: The `ShortUniqueId` package should never be used directly. All unique ID generation must go through the `EntityIdUtil` module (e.g., `EntityIdUtil.generate(...)`).
- **Date & Time**: Date/time operations must always use `DateTimeUtil`. Do not use native `Date` objects directly for parsing, formatting, or creating timestamps.

## Client / Angular Rules
- **Component Files**: Always use separate `.html` and `.scss` files instead of inlining templates or styles into the component `.ts` file. 