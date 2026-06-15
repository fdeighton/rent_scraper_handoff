# Code Quality, Standards & Modularity

## Core Principles

- Prioritize clarity over cleverness.
- Prioritize explicit behavior over implicit behavior.
- Prefer predictable patterns over custom abstractions.
- Prefer boring, maintainable code over clever code.
- Readability is more important than compactness.

---

## Module Responsibility

- Each module should have one clear responsibility.
- Business logic, UI, orchestration, logging, and data access should remain separated.
- Avoid overly large “god files” or hyper-centralized structures.
- Shared logic belongs in shared packages, not duplicated across applications.
- Modules should be easy to understand, test, and replace independently.

---

## Architectural Boundaries

- Domain boundaries should remain explicit.
- Applications must not directly depend on other applications.
- Cross-domain communication should happen through stable interfaces.
- Avoid circular dependencies.
- Avoid hidden coupling between unrelated systems.
- Dependencies should be intentional, visible, and easy to trace.

---

## Composition

- Prefer composition over inheritance.
- Prefer small reusable utilities over framework-like abstractions.
- Extract abstractions only after patterns become stable and repeatable.
- Avoid premature generalization.
- Abstractions should reduce complexity, not hide it.

---

## Readability

- Functions should be understandable in isolation.
- Naming should describe business intent, not implementation detail.
- Prefer straightforward control flow.
- Avoid deep nesting and excessive indirection.
- Minimize hidden side effects.
- Code should be easy to scan before it is optimized for compactness.

---

## Definition of Good Code

Good code should be:

- easy to read
- easy to explain
- easy to debug
- easy to test
- easy to refactor
- modular and composable
- predictable in behavior
- understandable with minimal external context

Code should optimize for local reasoning.

An engineer or AI agent should be able to understand a module with minimal external context.

---

## Review Expectations

When reviewing code, evaluate whether it is:

- clear
- modular
- maintainable
- testable
- easy to debug
- consistent with existing patterns
- free of unnecessary abstraction
- separated across appropriate responsibilities

Code that works but is difficult to reason about should not be considered complete.
