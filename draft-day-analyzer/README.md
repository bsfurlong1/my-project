# Fantasy Draft Day Analyzer

A single-file, offline-friendly web app for running a fantasy football draft:
track picks live, see who's the best player available, watch each team's
roster needs fill in, and get a running draft grade — all in your browser,
no server or account required.

## Use it

Open `index.html` in any browser (double-click it, or `file://` it — no
build step, no install). Everything is saved to your browser's local
storage as you go, so refreshing the page won't lose your draft.

## Setup tab

1. Set the number of teams, draft order (snake or linear), and which team
   is yours.
2. Set roster slots per team (defaults: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX,
   1 DST, 1 K, 6 BENCH). FLEX accepts RB/WR/TE; BENCH accepts anyone.
3. Import player rankings/ADP as CSV: columns `rank,name,position,team,bye`
   (header row optional; `team` and `bye` are optional). Paste it in, or
   upload a `.csv` file. Use **Load sample data** to try the app with
   placeholder players first — replace it with your real rankings before
   drafting for real.

## Draft tab

- **Best available**: ranked, filterable by position, searchable, hides
  players already drafted. Click **Draft** to assign a player to whichever
  team is on the clock.
- The on-the-clock team is computed automatically from the draft order and
  pick number; use the **Drafting for** override dropdown if a trade means
  someone else is picking in that slot.
- **Manual pick**: draft a player who isn't in your rankings list (name +
  position, rank excluded from grading since there's nothing to compare it
  to).
- **Draft log**: full pick history, undo the last pick, export the log as
  CSV.

Roster slot assignment is automatic: a pick fills the matching starter slot
if open, else FLEX (for RB/WR/TE) if open, else bench.

## Teams & Needs tab

One card per team showing every roster slot, filled player or "OPEN".
Slots beyond your configured count that still get filled (e.g. extra bench
picks) are marked with a `*`.

## Grades tab

For every pick with a known rank, `value = pick number − rank at pick`: a
positive value is a steal (better player than the slot implied), negative
is a reach. Each team's average value is compared against the other teams
in *this* draft to produce a relative letter grade (A+ through D), plus
that team's best and worst value picks. Manual/unranked picks don't count
toward value.

## Data

This tool ships with no real player data — you bring your own rankings via
CSV import. The "Load sample data" button is placeholder data for trying
out the UI only.
