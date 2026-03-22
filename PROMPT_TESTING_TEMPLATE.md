# Testing Prompt Template (Production Workflow Style)

Use this prompt when you want another model to implement tests in this repository without sounding like a checklist assignment.

```text
Please work as an engineer on this repository and directly add missing tests.

Context:
- Tech stack is Vue 3 + TypeScript + Vite.
- This is a real business app codebase with Pinia stores, utility layers, and route-driven behavior.
- Current test infrastructure exists, but coverage is still incomplete.

What I need:
- Read the code first and identify the highest-risk logic for regressions.
- Prioritize stable unit tests around pure utilities and store behavior.
- Cover both happy paths and edge/error branches (not just "runs without crash").
- Keep mocks minimal and readable.
- Avoid snapshot-heavy tests.
- Only make minimal source changes if testability is blocked, and explain why.

Please implement the test files directly, include any required config updates, then share:
1. what files were changed and why,
2. how to run the tests,
3. final test result summary.
```
