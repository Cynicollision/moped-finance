# Coding Standards

Define your specific coding standard rules here. Antigravity IDE and other AI agents will read this file to adhere to your stylistic and structural preferences.

## TypeScript Imports
1. **Import Order**: 
   - First: External (npm) dependencies
   - Second: `@shared` imports
   - Third: `@server-core` imports (server-side TypeScript only)
   - Fourth: Relative imports (generally in order by path)
2. **Relative Paths**: When navigating up folders in relative imports, always use explicitly dotted paths starting with the current directory (`./../`), avoiding the shorter equivalent (`../`). Example: `import { Something } from './../some-folder';`

## Classes and Constructors
- **Member Declarations**: Avoid using `private`/`public` inline in constructor parameter declarations (parameter properties). Instead, explicitly declare class members at the top of the class, and assign them in the constructor body. 
  *(Example: see `account-controller.ts`)*
