# Agent Documentation

This directory defines the operating protocols, context contracts, and behavioral boundaries for all AI agents operating within the MediaFOX Forge workspace.

---

## What belongs here

Documents in this directory answer:

- How does a specific agent receive context?
- What tools is an agent authorized to invoke?
- What must an agent always log?
- What must an agent never do?
- How does an agent hand off work to another agent or a human?
- What is the expected output format for each agent type?

---

## Agents

| Agent | Role | Status |
| --- | --- | --- |
| ARGOS | Chief AI Orchestrator — coordinates, synthesizes, surfaces | Active (UI simulation; real integration is Mission 004) |
| VULCAN | Lead Software Engineer — architects, implements, reviews | Active |
| ATLAS | Chief Product Officer — defines scope, owns roadmap | Planned |
| NOVA | Head of UX — owns design system, experience standards | Planned |
| SENTINEL | Quality & Reliability Lead — enforces quality gates, security | Planned |

---

## Planned Documents

| Document | Description |
| --- | --- |
| ARGOS Protocol | Context contract, tool permissions, conversation schema, and output format |
| Agent Coordination Model | How agents hand off, escalate, and resolve conflicts |
| Tool Authorization Matrix | Which agent can invoke which tool under which conditions |
| Agent Logging Standard | Mandatory log format for all agent actions and decisions |
| ARGOS Integration Brief | Technical specification for Mission 004 real AI integration |

---

## Authority

Agent behavioral boundaries are defined in the [Founder Team Constitution](../company/FOUNDER_TEAM_CONSTITUTION.md). Agents must operate within those limits. This directory documents the technical protocols that enforce those limits in practice.

*Owner: ARGOS | Reviewed by: VULCAN | Authority: CEO*
