# Operator Pilot Playbook

**Work order:** WO-ARGOS-041
**Audience:** the real person playing the operator role during the pilot. This document is operational — what to click, in what order — not an explanation of how MOVOS is built.

## 1. Logging in

Go to `https://movos-web.vercel.app/login`. Enter your email and password. You'll land on `/dashboard`.

## 2. What to open first

`/dashboard` has two kinds of content on it right now, and it matters which one you're looking at:

- **The "Inteligencia operativa" card is real** — it shows genuine, computed recommendations about your fleet, and any `HIGH`-severity card has a real "Crear orden de trabajo" button.
- **Everything else on that page — the top metrics, the alerts list, the activity feed — is still placeholder demo content**, not live data. Don't make decisions based on those numbers during the pilot.

For anything related to the pilot itself, your real working screen is **`/work-orders`**, in the sidebar under "Órdenes de trabajo."

## 3. Inspecting network state

Go to a station's own page (`/sites` → pick a site → pick a station) to see its real, live connectivity and status badges. This is real device data where a station is actually connected; for pilot stations that aren't connected to anything yet, it will honestly show "Desconocido."

## 4. Recognizing a relevant problem

A problem is "relevant" for this pilot if it's something you'd otherwise handle today with a phone call or a message to a technician — a station not working, a connector reported faulty, anything that needs someone to physically go look at it. You don't need to wait for MOVOS to tell you; if you know about it, that's enough to start.

## 5. When to create or use a WorkOrder

- If MOVOS already created one for you (from the recommendation button, or automatically for a connectivity loss), you'll see it on `/work-orders` — open it.
- Otherwise, click **"Nueva orden de trabajo"** on `/work-orders`, fill in the title, description, priority, and station, and submit. This takes under a minute.

## 6. Assigning the technician

Open the `WorkOrder`. Under "Técnico asignado," use the dropdown to select the pilot technician's name, then click **"Asignar técnico."** That's it — they'll see it the next time they check `/my-work`.

## 7. Monitoring progress

`/work-orders` refreshes itself automatically every 30 seconds, and shows the current status of everything ("Abierta," "Asignada," "En progreso," "Resuelta"). Open any `WorkOrder` to see its full real-time history — every step the technician takes appears there as it happens.

## 8. Verifying resolution

When a `WorkOrder` shows **"Resuelta,"** open it and read the timeline from top to bottom: what was found, what was done, what was validated, and the technician's closing note. You'll also see the real device connectivity state captured at each diagnosis/validation step — if it ever looks like the technician's note and the live device state don't agree, that's worth a follow-up conversation, not something to ignore.

## 9. If MOVOS itself is unavailable

Don't wait on it. See `docs/pilot/PILOT_FALLBACK_PLAN.md` — call or message the technician exactly the way you would have before the pilot, get the work done, and log what happened once MOVOS is back so it isn't lost. MOVOS being briefly unavailable should never be the reason a real problem doesn't get fixed.
