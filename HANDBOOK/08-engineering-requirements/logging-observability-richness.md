# Logging, Observability & Semantic Richness

## Purpose

This standard defines how systems should expose operational behavior through structured logging, observability, and semantic runtime context.

The goal is not generating more logs.

The goal is making workflows:
- traceable
- reconstructable
- debuggable
- operationally understandable

Observability should be treated as a core part of system design rather than an afterthought added during debugging.

Logs should communicate meaningful business and workflow behavior, not just technical execution details.

Systems should be observable enough that engineers and AI agents can:
- understand runtime behavior
- trace workflow execution
- diagnose failures
- reconstruct state transitions
- identify operational intent

without relying on tribal knowledge.

---

## Observability Philosophy
Observability exists to make systems operationally understandible

A system should expose enough runtime context that engineers and AI agents can:
- understand workflow behaviour 
- trace execution paths
- diagnose failures 
- reconstruct state transitions
- identify operational limits 

Without replacing manual interface or tribal knowledge. Observability is not limited to error logging. 

It includes:
- workflow visibiility
- execution tracebility
- operational context 
- state transition visibility
- meaningful event communication

Logs should describe meaningful business and workflow behaviour, not just low level tehcnical activity

### Systems should prioritize 
- explicit operational visibility
- reconstructable execution flow
- traceable workflow transitions
- meaningful runtime context
- predictible operational behaviour 

### Avoid
- opaque workflows
- silent failures
- ambiguous event names
- hidden state transitions
- logs without operational meaning
- runtime behavior that cannot be reconstructed

Operational visibility is part of maintainability, not a separate operational concern.

---

## Structured & Semantic Logging

Logs should be structured, consistent, and operationally meaningful.

Logging should support:
- debugging
- workflow reconstruction
- operational visibility
- incident investigation
- distributed tracing
- AI-assisted runtime reasoning

Logs should communicate:
- what happened
- why it mattered
- which workflow was affected
- what state changed
- what operational context is needed to understand the event

### Prefer

- structured fields over freeform text
- meaningful business events over technical noise
- business-oriented event names
- domain-specific terminology
- explicit workflow transitions
- meaningful intermediate workflow steps
- traceable execution context
- predictable event structure
- operational context that supports debugging

### Standard Log Context

Where appropriate, logs should include:

- event name
- actor or initiator
- resource type
- resource identifier
- action performed
- workflow state
- result or outcome
- correlation identifier
- relevant operational metadata

### Avoid

- freeform console output
- vague or ambiguous event names
- generic success or failure logs
- implementation-specific noise
- logs without operational meaning
- hidden workflow transitions
- excessive low-level execution logging
- logs that require tribal knowledge to interpret

### Example

```ts
logger.info("payment.validation.started", {
  paymentId,
  tenantId,
  leaseId,
  correlationId,
})

logger.info("payment.validation.failed", {
  paymentId,
  tenantId,
  leaseId,
  failureReason,
  retryAttempt,
  correlationId,
})
```

### Anti-Pattern

```ts
console.log("success")
console.log("step complete")
```

### Logging Principles

- Logs should describe workflows, not just execution steps.
- Event names should preserve business meaning.
- Intermediate logs should represent meaningful workflow transitions.
- Logs should support reconstruction of business events and state transitions.
- Systems should remain observable without requiring deep system knowledge.
- Runtime systems should communicate operational intent through observable behavior.

Excessive low-signal logging reduces observability quality.


## Event Design & Naming

Event names should be consistent, domain-oriented, and easy to understand outside their implementation context.

### Prefer

- business meaningful event names
- consistent naming patterns
- domain-specific terminology
- action-oriented event names
- names that describe what happened
- names that support workflow reconstruction

### Avoid

- vague event names
- generic names like `success`, `failed`, or `complete`
- implementation-specific naming
- inconsistent naming patterns
- names that only make sense inside one function

### Recommended Pattern

Use:
domain.entity.action

Examples:
lease.approved
payment.validation.failed
tenant.invitation.sent
application.review.started


### Naming Principles

- Event names should describe meaningful workflow behavior.
- Event names should remain stable over time.
- Event names should be understandable by engineers, operators, and AI agents.
- Event names should help reconstruct what happened without reading the source code.

---

## Workflow Traceability

Workflows should be traceable across meaningful steps, not only final outcomes.

Logs should make it possible to understand:
- where a workflow started
- which meaningful steps occurred
- what state changed
- where failures happened
- what outcome was reached

### Prefer

- logging meaningful workflow transitions
- logging state changes
- logging retries and recovery behavior
- logging external dependency interactions
- preserving workflow context across steps

### Avoid

- logging only final success or failure
- silent intermediate transitions
- hidden orchestration behavior
- workflows that require source-code tracing to understand
- excessive low-level step logging

### Traceability Principle

A workflow should be reconstructable from logs without relying on tribal knowledge.

---

## Correlation & Execution Flow

Related events should be linkable across services, jobs, requests, and workflows.

Correlation identifiers should make it possible to follow execution flow across system boundaries.

### Prefer

- correlation IDs across related events
- workflow IDs for long-running processes
- request IDs for API execution
- job IDs for background work
- consistent propagation of trace context
- linking async work back to the initiating action

### Avoid

- isolated logs with no shared identifier
- async events that cannot be linked to their origin
- workflows split across systems without trace context
- logs that cannot be grouped into a single execution path

### Standard Context

Where appropriate, include:

- `correlationId`
- `requestId`
- `workflowId`
- `jobId`
- `actorId`
- `resourceId`

### Principle

Execution flow should remain traceable even when work crosses service, queue, API, or background job boundaries.

---

## Intent, Invariants & Side Effects

Important logic should preserve enough context to explain why it exists and what must remain true.

This does not mean commenting obvious code.

It means documenting intent where behavior is non-obvious, business-critical, or operationally risky.

### Use intent comments for

- non-obvious business rules
- security-sensitive decisions
- state transitions
- external integrations
- retries and idempotency
- workflow orchestration
- meaningful side effects

### Document

- why the design exists
- assumptions
- invariants
- side effects
- failure expectations
- operational constraints

### Prefer

```ts
/**
 * WHY:
 * Lease approval must remain idempotent because payment webhooks may retry.
 *
 * INVARIANTS:
 * - Lease may only transition from PENDING -> APPROVED
 * - Billing must succeed before activation
 *
 * SIDE EFFECTS:
 * - Sends tenant email
 * - Emits lease.approved event
 * - Writes audit log
 */
```

### Avoid

```ts
// increments retry count
```

### Principle

Comments should explain intent and constraints, not obvious implementation details.

---

## Operational Visibility

Critical workflows should expose enough runtime context to be understood during normal operation and during failure.

Observability is part of feature completeness.

### Critical workflows include

- authentication
- authorization
- payments
- provisioning
- external integrations
- background jobs
- workflow state transitions
- AI orchestration
- data synchronization

### Prefer

- observable state transitions
- meaningful error context
- external dependency visibility
- retry and failure visibility
- operationally useful metadata
- clear success and failure outcomes

### Avoid

- silent failures
- hidden retries
- unobservable background work
- missing error context
- workflows that only become understandable through source-code inspection

### Principle

If a workflow is important to the business, it should be observable in production.

---

## AI-Native Observability Principle

AI-assisted debugging and refactoring improve when systems expose clear operational context.

AI agents reason more effectively when:
- events are semantically named
- workflows are traceable
- state transitions are explicit
- correlation IDs link related behavior
- logs preserve business meaning
- intent and side effects are documented where needed

Semantic observability reduces:
- prompt size
- context retrieval cost
- static code traversal
- hallucinated assumptions
- debugging retries
- refactor risk

The repository and runtime logs should work together as machine-readable engineering context.

---

## Final Principle

Systems should be observable enough that important workflows can be reconstructed without relying on tribal knowledge.

Operational visibility is a core part of maintainability, not an optional debugging aid.

Logs should help future engineers and AI agents understand what happened, why it mattered, and how the system behaved.