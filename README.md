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
  five of the NFL/ESPN's actual posted tiebreakers, applied in order to that
  member's picks:
  1. **Head-to-head** — record in games between just the tied teams.
  2. **Division record** — record across all games within the division.
  3. **Conference record** — record across all games within the conference
     (AFC or NFC).
  4. **Strength of victory** — aggregate record of every team this team has
     beaten.
  5. **Strength of schedule** — aggregate record of every team this team has
     played.

  All five are fully computable from picks alone. A resolved pick shows how
  it was decided, e.g. "Buffalo Bills (12 wins, won tiebreaker on
  conference record)". **Not applied:** common games (skipped — rarely
  decisive once conference record is in play), the points-based tiebreakers,
  and the final coin toss — those need real game scores, which this tool
  never tracks. A tie that survives all five steps (rare — it means two
  teams are genuinely identical by every computable measure) is shown
  explicitly, e.g. "TIE: Buffalo Bills / Miami Dolphins (12 wins each)", and
  the Tally tab credits a vote to every team still tied.
- **Tally** tab (read-only): once a member's picks are complete, they count
  toward the vote total for their picked team in each division. Shows, for
  each of the 8 divisions, which team got the most votes.
- **Weekly Results** tab (read-only): scores every member's picks against
  what actually happened, once real games are played. Updated by running
  **NFL Picks > 3. Update Actual Results** (see Setup below) — do this
  weekly, e.g. every Tuesday after Monday Night Football. The top of the
  tab is a plain-text block meant to be selected and pasted straight into a
  group chat:
  ```
  🏈 WEEK 3 RESULTS
  Alice: 12-4 (75.0%)
  Bob: 10-6 (62.5%)

  📊 SEASON STANDINGS (through Week 3)
  1. Alice — 34-14 (70.8%)
  2. Bob — 30-18 (62.5%)
  ```
  Below that is the full week-by-week matrix (one row per week, one column
  per member, `correct-wrong` per cell) plus a season-total row. A game only
  counts once it's actually been played; an unplayed or unpicked game is
  simply skipped (shown as `-`) rather than counted as wrong, and a member
  doesn't need to have finished picking the whole season for their played
  weeks to show up here — this tracks week-by-week, unlike Division
  Winners/Tally which need a complete season of picks.
- **Gambling Analysis** tab (read-only): a simulated $100-per-member
  bankroll, run against real moneyline odds. Each member starts Week 1 with
  $100, split equally as a moneyline bet across that week's picks; every
  week after, they re-bet their **entire current bankroll**, split equally
  across that week's picks — so a bad week compounds, and once a bankroll
  hits $0 it stays at $0 (busted) for the rest of the season. Updated by
  running **NFL Picks > 4. Fetch Betting Odds** (see Setup below).

  Leads with a postable standings block, then a week-by-week bankroll
  matrix:
  ```
  💰 BANKROLL STANDINGS (started at $100.00)
  1. Alice — $212.40
  2. Bob — $0.00
  ```
  A week shows `pending` until every one of that week's bet-eligible games
  (picked, with known odds) has an actual result — all of a week's bets are
  placed before any outcome is known, so next week's bet size can't be set
  until this week is fully settled. A picked game with no odds data found is
  simply left out of that week's bet split; a week with nothing to bet on
  leaves the bankroll unchanged.

  **Caveat on the odds data:** ESPN's betting-odds API shape wasn't
  verifiable while building this (no network access to espn.com from this
  environment), unlike the schedule/score endpoints, which were. The fetch
  dialog tries a couple of known ESPN field layouts and reports exactly how
  many games it found odds for — check that number the first time you run
  it. If it's low or zero, ESPN's actual odds format differs from what's
  coded here and the extraction logic needs adjusting against real data.
- **Members** tab: hidden registry of name/email/tab used internally — no
  need to touch it.

Results recompute automatically whenever anyone checks a box (no need to
re-run anything).

## Setup

1. Create a new Google Sheet.
2. **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and paste in this repo's `Code.gs`.
4. Add the dialog files: in the Apps Script editor, click the **+** next to
   "Files" > **HTML** three times, naming them exactly `FetchDialog`,
   `ResultsDialog`, and `OddsDialog` (Apps Script adds the `.html`
   extension itself), and paste in this repo's `FetchDialog.html`,
   `ResultsDialog.html`, and `OddsDialog.html` respectively.
5. In the Apps Script editor, open **Project Settings** (gear icon) and
   check "Show `appsscript.json` manifest file in editor". Open that file
   and replace its contents with this repo's `appsscript.json`.
6. Save, then reload the spreadsheet tab.
7. **You (the spreadsheet owner) must run these menu items** — members
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
10. Once games start, run **NFL Picks > 3. Update Actual Results** weekly
    (same browser-fetch dialog as Initialize) to score everyone's picks
    against real outcomes on the **Weekly Results** tab.
11. Run **NFL Picks > 4. Fetch Betting Odds** (once near the start of the
    season is enough, since real moneylines don't change retroactively; you
    can re-run it any time to backfill games it missed) to build the
    **Gambling Analysis** tab. Check the "Found moneyline odds for X of Y
    games" message it reports — see the caveat above.

To change the season, edit the `SEASON` constant at the top of `Code.gs`
before running Initialize.

**Upgrading `Code.gs` on a spreadsheet that already has member tabs:** new
tab features (like the status banner) only apply to tabs created *after*
the update — existing member tabs won't retroactively get them. To pick up
a change, delete that member's tab and run **Add Member** for them again
(their old picks are lost, so only do this before picks are underway, or
ask the member to re-enter theirs).
