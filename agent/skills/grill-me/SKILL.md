---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding. Use when user wants to stress-test a plan, or mentions "grill me"
---

# Grill Me

This skill forces a deep questioning session to reach shared understanding before committing to code. Inspired by "The Design Tree" concept from Frederick P. Brooks' _The Design of Design_.

## Process

- **Interview relentlessly** - Ask questions about every aspect of the plan until you reach a shared understanding. Don't assume anything.
- **Walk the design tree one by one** - For each design decision, explore all branches:
   - What happens if you choose Option A?
   - What are the dependencies?
   - What happens if you choose Option B instead?
   - Resolve dependencies between decisions one by one.
- **Explore the codebase** - If a question can be answered by exploring the code base, explore it instead of asking the user.

## Guidelines

- Don't Spit Out a Plan Prematurely - Resist the urge to generate a plan document before truly understanding the problem.
- Ask Follow-up Questions - Dig deeper. "What about X?" "How does Y affect Z?"
- Resolve Dependencies First - Make sure decisions are fully worked through before moving on.
- Document the Shared Understanding - Capture key decisions and their rationale as you go.
