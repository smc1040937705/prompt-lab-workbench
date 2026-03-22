# Test Blueprint (Expanded Surface)

This codebase now supports a much larger, realistic test plan.
You do not need to force an exact number, but a normal comprehensive pass can easily exceed 100 useful unit tests.

## Core high-value modules

1. `src/utils/index.ts`
2. `src/store/tabs.ts`
3. `src/utils/task.ts`
4. `src/utils/workflow.ts`
5. `src/utils/storage.ts`
6. `src/utils/http-client.ts`
7. `src/store/modules/tasks.ts`
8. `src/store/modules/user.ts`
9. `src/store/modules/analytics.ts`

## Suggested coverage distribution

- Utility layer (`index`, `task`, `workflow`, `storage`, `http-client`): 55-75 cases
- Store layer (`tabs`, `tasks`, `user`, `analytics`): 45-65 cases
- Optional shallow component behavior: 10-20 cases

## Example focus points

### `src/utils/workflow.ts`
- transition allow/deny matrix by role and status
- required block reason and reviewer checks
- workflow log creation timestamps and notes
- risk scoring factors and level boundaries
- SLA bucket assignment per priority policy
- delivery forecast with zero and non-zero velocity
- risk-based ordering stability

### `src/utils/http-client.ts`
- query serialization and URL joining
- header merge and auth header injection
- JSON/text/raw parsing branches
- 204 response handling
- timeout branch and abort behavior
- retry on retryable status codes
- non-retryable HTTP failures
- network exceptions and final failure shape

### `src/store/modules/tasks.ts`
- filters (status/priority/assignee/sprint/keyword/overdue)
- sort modes (`priority`, `dueDate`, `status`, `title`, `risk`, `updatedAt`)
- transition action success and denial paths
- workflow log retention
- selection and bulk archive behavior
- import merge vs replace
- draft save/apply/clear/list
- sync success/failure/exception state
- dependency issue getters
- forecast and SLA getters

### `src/store/modules/user.ts`
- session hydrate parse success/failure
- login/logout persistence behavior
- role switching and permission matrix
- expiration and refresh behavior
- login by username success/failure

### `src/store/modules/analytics.ts`
- snapshot generation and merge semantics
- trend calculation edge cases
- keep-days clamping and pruning
- import dedupe by date

## Practical note

The goal is to mimic a real team workflow:
- start from pure functions
- then store actions/getters
- then route-aware store behavior (tabs)
- then optional shallow component checks

This sequence usually yields stable, maintainable tests with low flakiness.
