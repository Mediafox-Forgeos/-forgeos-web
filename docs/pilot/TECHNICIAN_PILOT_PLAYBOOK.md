# Technician Pilot Playbook

**Work order:** WO-ARGOS-041
**Audience:** the real person playing the technician role during the pilot. This document is operational — what to click, in what order — not an explanation of how MOVOS is built.

## 1. Logging in

Go to `https://movos-web.vercel.app/login`. Enter your email and password. You'll land directly on **`/my-work`** — that's your only real screen; you won't see anything else in the menu besides "Mi trabajo" and "Configuración."

## 2. Accessing /my-work

You're already there right after login. If you ever navigate away, click "Mi trabajo" in the sidebar to come back. Check it at the start of your day and periodically — nothing currently notifies you when something new is assigned (see step 9), so checking is on you for now.

## 3. Identifying the highest-priority assignment

`/my-work` sorts your "Asignadas" and "En progreso" lists by priority first, then by how long they've been waiting. The top row in each list is the one to look at first. The priority badge ("Alta," "Media," "Baja," "Crítica") tells you how urgent it is.

## 4. Starting a WorkOrder

Open it, then click **"Iniciar trabajo."** Do this when you actually begin working the problem — not before, not after you've already started.

## 5. Executing the checklist

Below the execution controls, you'll see the field checklist:

1. **Confirmar llegada** — one tap when you arrive. If your browser asks for location permission, it's optional; declining is fine.
2. **Diagnóstico** — write what you actually found.
3. **Intervención** — write what you actually did about it.
4. **Validación** — write what you checked to confirm it worked.

Each one is a real, permanent, timestamped record with your name on it. None of them are required to close the `WorkOrder` — use the ones that make sense for the problem in front of you.

## 6. Entering useful notes

Be specific. "No funciona" tells the next person nothing; "El conector no responde a la tarjeta, reinicié el módulo y volvió a conectar" tells them exactly what happened. Your own notes are the record — write them the way you'd want to read them later if you'd forgotten the details.

## 7. Resolving the WorkOrder

Once you're actually done, click **"Resolver,"** write a closing note, and confirm. This is the single most important step in the whole pilot — it's the moment the loop actually closes without anyone needing to call the operator to say "listo."

## 8. What MOVOS resolution does and does NOT mean

Clicking "Resolver" records **that you finished your work** — it does not, and cannot, verify that the physical station itself reconnected or came back online. If you look at the "Dónde" panel while working and it still shows "Desconectado" even after your fix, that's real, live information about the device, not something MOVOS is contradicting you about — write what you actually did, honestly, even if the device hasn't caught up yet. That live status is shown to the operator too, on the exact same screen you see it on.

## 9. If the platform is unavailable

Don't wait on it and don't let it block the physical work. Do the job the way you would have before the pilot — go fix the problem — and either log it in MOVOS as soon as it's back, or tell the operator directly so they can log it for you. See `docs/pilot/PILOT_FALLBACK_PLAN.md`.
