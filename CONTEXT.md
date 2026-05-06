# Domain Context

This package provides pi agent configuration via symlink trick (see ADR-0001).

## Library
A git submodule in `libs/`. Provides capabilities to pi via Extensions and/or Skills. Always a submodule.

## Extension
pi's capability system. Loaded from a Library's `.agents/extensions/` or `agent/extensions/`.

## Skill
pi's instruction set. Loaded from a Library's `.agents/skills/` or `agent/skills/`.

## Session
Runtime context stored in `agent/sessions/`. Persists across agent invocations.