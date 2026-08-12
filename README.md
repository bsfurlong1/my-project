# my-project

Google Sheets + Apps Script tool for a fantasy football division-winner pick'em:
every league member picks the winner of every regular-season NFL game, and the
sheet derives who each person effectively picked as the winner of each of the
8 divisions, then tallies votes across the whole league.

## How it works

- **Schedule** tab (read-only, owner-only edit): every regular-season game
  (18 weeks), auto-fetched from ESPN's public schedule API, plus for each
  game:
  - **Stadium Type** — Dome, Retractable Roof, or Open Air.
  - **Avg Temp** / **Snow Chance** — the historical average temperature and
    probability of measurable snow for that stadium's location on that
    calendar date (pulled from Open-Meteo's historical weather archive,
    averaged over the last 5 years within a few days of the game date). Dome
    games show "N/A (Dome)" since weather doesn't apply.
- **Each member gets their own tab**, named after them, copied from the
  Schedule tab, with a live status banner at the very top: a green
  "✅ All N games picked!" once every game has a pick, or a red
  "⏳ N of M games still need a pick" otherwise. It's a plain Sheets formula
  (`COUNTIFS`), so it updates instantly on every checkbox click with no
  script involved.

  Picking is a single click: a small checkbox (✓ column) sits
  immediately to the left of each team's name, and checking it turns that
  team's name **green** via conditional formatting — so the pick is made and
  confirmed right on the matchup, not in a separate part of the sheet.
  Checking one team's box automatically unchecks the other team's for that
  game. Each tab is edit-locked (via Sheets' protection feature) to just
  that member's Google account, so nobody can change anyone else's picks.

  (A checkbox can't display the team's name *inside itself* — Sheets always
  renders a checkbox cell as just the checkbox, with no visible label — so
  the checkbox lives in its own narrow column right next to the name rather
  than being merged into it. This is the closest one-click, clear-feedback
  version Sheets can actually do.)

  **Important limitation:** Google Sheets has no way to hide a tab from
  specific people within one shared file — protection controls who can
  *edit* a tab, not who can *see* it. Anyone with access to this spreadsheet
  can see every member's tab; they just can't edit anyone else's. If you
  need picks to be genuinely invisible to other members (not just locked),
  that requires a different design (e.g. one spreadsheet per member, or a
  Google Form) — ask if you want that instead.
- **Division Winners** tab (read-only): for each member, the team in each
  division with the most picked wins across the whole season is that
  member's division winner. Members who haven't picked every game yet are
  marked "(incomplete)".

  Ties (two or more teams picked to the same win total) are broken using
  the first two of the NFL/ESPN's actual posted tiebreakers, applied to that
  member's picks: **head-to-head** (record in games between just the tied
  teams), then **division record** (record across all games within the
  division) if still tied. Both are fully computable from picks alone,
  since divisions always play a full home-and-away round robin. A resolved
  pick shows how it was decided, e.g. "Buffalo Bills (12 wins, won
  tiebreaker on head-to-head)". The remaining official tiebreakers (common
  games, conference record, strength of victory/schedule, points-based
  tiebreakers, coin toss) are **not** applied — some of those need real game
  scores, which this tool never tracks. A tie that survives both steps is
  shown explicitly, e.g. "TIE: Buffalo Bills / Miami Dolphins (12 wins
  each)", and the Tally tab credits a vote to every team still tied.
- **Tally** tab (read-only): once a member's picks are complete, they count
  toward the vote total for their picked team in each division. Shows, for
  each of the 8 divisions, which team got the most votes.
- **Members** tab: hidden registry of name/email/tab used internally — no
  need to touch it.

Results recompute automatically whenever anyone checks a box (no need to
re-run anything).

## Setup

1. Create a new Google Sheet.
2. **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and paste in this repo's `Code.gs`.
4. Add the dialog file: in the Apps Script editor, click the **+** next to
   "Files" > **HTML**, name it exactly `FetchDialog` (Apps Script adds the
   `.html` extension itself), and paste in this repo's `FetchDialog.html`.
5. In the Apps Script editor, open **Project Settings** (gear icon) and
   check "Show `appsscript.json` manifest file in editor". Open that file
   and replace its contents with this repo's `appsscript.json`.
6. Save, then reload the spreadsheet tab.
7. **You (the spreadsheet owner) must run these two menu items** — members
   don't have permission to, since they create/lock tabs:
   - **1. Initialize (fetch schedule)** — opens a small dialog that fetches
     the schedule from ESPN *from your browser* (not Google's servers,
     which ESPN's API blocks) and then pulls stadium type and historical
     average weather for every game server-side. Authorize the script when
     prompted; this can take a minute or two the first time. Do this
     **before** adding any members.
   - **2. Add Member** — once per person in your league. You'll be asked
     for their name (becomes their tab name) and their Google account
     email (needed to lock their tab to just them).
8. Share the spreadsheet with your league — **Editor** access (Viewer access
   isn't enough for them to fill in their own tab, since Sheets can't grant
   more access than the file-level sharing allows). Each person fills in
   their own tab.
9. Check the **Division Winners** and **Tally** tabs any time — they update
   as people pick.

To change the season, edit the `SEASON` constant at the top of `Code.gs`
before running Initialize.

**Upgrading `Code.gs` on a spreadsheet that already has member tabs:** new
tab features (like the status banner) only apply to tabs created *after*
the update — existing member tabs won't retroactively get them. To pick up
a change, delete that member's tab and run **Add Member** for them again
(their old picks are lost, so only do this before picks are underway, or
ask the member to re-enter theirs).
