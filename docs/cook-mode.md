# Cook mode — state machine & scheduling (MVP)

Implementation: [`src/lib/cook-schedule.ts`](../src/lib/cook-schedule.ts).

## States (`cook_session.state`)

| State | Meaning |
|-------|---------|
| `planning` | Session created; timeline computed; optional “ready by” set. |
| `active` | User is cooking; timers running / events scheduled. |
| `paused` | User paused; new server events not scheduled until resumed (MVP: skip). |
| `completed` | All steps done. |
| `cancelled` | Abandoned; pending scheduled events should be `skipped`. |

Transitions (MVP):

- `planning` → `active` on **Start** (persists `started_at`, schedules events).
- `active` → `completed` when last step marked done.
- Any → `cancelled` on explicit cancel.

## Timer model (linear)

Steps are ordered by `position`. For step index `i`:

- `durationSeconds`: wall time for that step (mix, bake, rest, …). Nullable = instantaneous step.
- `offsetFromPrevious`: seconds **after** step `i-1` **ends** before step `i` starts. Ignored for `i === 0`.

```
start[0] = t0
end[i]   = start[i] + duration[i]   (or start[i] if no duration)
start[i] = end[i-1] + offset[i]     for i > 0
```

## Reverse scheduling (“Ready by”)

Given `targetReadyAt` = end of final step, walk **backwards**:

```
end[last] = targetReadyAt
start[i]  = end[i] - duration[i]
end[i-1]  = start[i] - offset[i]
```

If any `start[0]` is in the past, the UI should warn (“You needed to start earlier”) — still return computed times.

## Server events

For each step with `durationSeconds > 0`, enqueue `scheduled_step_event` with:

- `kind = timer_end`
- `fire_at = start[i] + duration` (absolute UTC)
- `idempotency_key = ${cookSessionId}:step:${i}:timer_end` (stable for upserts)

The cron dispatcher sends Web Push using `push_payload` (see notifications doc).
