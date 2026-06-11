# Revise session plan for ElysiaJS

## Goal

Update `session.md` so Akasha is planned as a from-scratch Bun + ElysiaJS + TypeScript project instead of a Python/Flask migration from `tos-browser`.

## Requirements

* Make ElysiaJS the primary web/API framework.
* Keep the core storage abstraction framework-independent.
* Keep the Akasha naming theme.
* Preserve rclone.conf compatibility goals.
* Preserve `tos-browser` facts as migration/reference material, not as the main implementation path.

## Acceptance Criteria

* [x] `session.md` no longer presents Flask, boto3, or Python files as the primary architecture.
* [x] `session.md` documents Bun, ElysiaJS, TypeScript, and typed API/client expectations.
* [x] Core concepts remain `Darshan`, `Akademiya`, `Gnosis`, `Capsule`, and `HouseOfWisdom`.
* [x] Milestones and risks reflect the ElysiaJS implementation route.

## Definition of Done

* Documentation updated.
* No application code changed.
* Final response summarizes the changed direction.

## Out of Scope

* Scaffolding the Bun/ElysiaJS project.
* Installing dependencies.
* Implementing storage engines.

## Technical Notes

* `session.md` is the only target project document for this task.
* Existing backend/frontend specs are placeholders and do not impose project-specific implementation conventions yet.
