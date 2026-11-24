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
  leaves the bankroll unchanged. A game that ends in a **tie** resolves as a
  **push** — the stake on that one game is returned, no win or loss — rather
  than counting as "not yet decided," since a tie never gets a winner to
  wait for (ties don't count for or against anyone on the Weekly Results
  tab either, for the same reason).

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

## Fantasy Draft Day Analyzer

A separate, standalone tool for draft day itself — [`index.html`](index.html).
It's a single self-contained web app (no server, no build step, no account):
open it in any browser to track live draft picks, see the best player
available from your imported rankings, watch each team's roster needs fill
in, get a running draft grade, and — once you import projected points —
see best-by-position tiers and NFL team depth charts. Everything is saved
to your browser's local storage as you go.

### Setup tab

1. Set the number of teams, draft order (snake or linear), and which team
   is yours.
2. Set roster slots per team (defaults: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX,
   1 DST, 1 K, 6 BENCH). FLEX accepts RB/WR/TE; BENCH accepts anyone.
3. Import player rankings/ADP as CSV: columns `rank,name,position,team,bye`
   (header row optional; `team` and `bye` are optional). Paste it in, or
   upload a `.csv` file. Use **Load sample data** to try the app with
   placeholder players first — replace it with your real rankings before
   drafting for real.
4. Once rankings are imported, click **Fetch injury data** to pull current
   injury designations (Out, Doubtful, Questionable, IR, etc.) from
   [Sleeper's public players API](https://docs.sleeper.com/) and tag
   matching players — look for the colored badge next to a player's name.
   Matching is by player name (with a team check to disambiguate name
   collisions), so this works best once your rankings are loaded. Sleeper
   was chosen over ESPN's API because ESPN doesn't allow cross-origin
   browser requests (it'll fail with a CORS error) — Sleeper's API is
   public and meant for exactly this kind of client-side use, no key
   required. It can still occasionally fail or return nothing if Sleeper
   changes something; the status line under the button will say so if it
   does. Re-click any time to refresh.

### Draft tab

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

**Your picks by round**: shows your team's pick number in every round (computed from the
draft order/snake settings and your configured roster size). Rounds already picked show
what you actually took; rounds still ahead show a "chalk" projection — the player who'd be
next in your rankings if every pick between now and then goes in rank order — plus two
runners-up. It's a reference point for planning, not a prediction, since real drafts don't
follow rank order.

#### Voice mode

Click **🎤 Voice** next to the search box and speak a command (requires a
browser with Web Speech API support, e.g. Chrome or Edge; the button is
disabled otherwise):

- **"draft `<player>`"** (or "pick"/"take") — finds the best-matching
  undrafted player by name and drafts them for whichever team is currently
  on the clock (or the team selected in the "Drafting for" override).
- **"draft `<player>` for `<team>`"**, or **"`<team>` drafts `<player>`"** —
  drafts a player for a specific team by name, "team `<N>`", "me"/"my
  team" (your configured team), regardless of whose turn it is — handy for
  entering picks out of order or catching up.
- **"switch to `<team>`"** (or "drafting for"/"now drafting for") — sets
  the "Drafting for" override so subsequent picks (voice or button) go to
  that team until you switch again.
- **"search `<player>`"** (or "find"/"show") — filters the best-available
  list, same as typing in the search box.
- **"position `<POS>`"** (or "pos"/"filter") — sets the position filter
  (QB, RB, WR, TE, DST, K, or ALL).
- **"clear search"** — clears the search box.
- Anything else is treated as a search query.

Name matching is fuzzy (exact match, then substring, then per-word prefix
match) so close pronunciations of a player's or team's name still resolve,
and only undrafted players are considered.

### Analysis tab

Needs projected points imported first (Setup tab → **Projected points**): paste or upload a CSV
with columns `name,position,team,points` (header row optional; position/team optional but help
disambiguate players who share a last name). Matching against your rankings is by name — exact
match first, then last name + first-initial (so sources that only show initials, e.g. "B.
Robinson", still resolve), with team breaking ties between same-surname players. Team defenses
match by team + position instead of name, since defense naming varies wildly between sources
("Broncos" vs "Denver Defense"). Genuinely ambiguous matches (e.g. two same-team players sharing
initials, like Bijan Robinson and Brian Robinson both on Atlanta) are flagged in the import status
so you can double-check them rather than being silently guessed. Re-importing replaces all
previously matched points.

- **Best players & tiers by position**: filter by position, see every player with matched
  projected points ranked highest to lowest, grouped into tiers. Tier breaks are placed
  automatically at the largest point-gaps within a position (a gap bigger than the position's
  typical gap by more than one standard deviation starts a new tier), so each tier is a cluster of
  roughly interchangeable players. Already-drafted players are dimmed and marked.
- **NFL team depth charts**: every player with both a team and projected points, grouped by NFL
  team and ranked within each position by projection (QB, RB1/RB2/..., WR1/WR2/..., etc.) — useful
  for spotting a backup worth handcuffing or a crowded timeshare to avoid.

The Setup and Draft tables also show a Pts column once projected points are imported.

### Teams & Needs tab

**Bye week check**: pick a team (defaults to yours) and see, for every week
where two or more of its rostered players share a bye, whether that
overlap leaves the team short of enough non-bye players at a starting
position (including the RB/WR/TE pool that feeds FLEX) — e.g. rostering
exactly 2 RBs who both have the same bye week. Only weeks with at least
one shared bye are listed; a shortfall is flagged in red, otherwise
"OK". Needs bye weeks in your imported rankings (the `bye` CSV column).

One card per team showing every roster slot, filled player or "OPEN".
Slots beyond your configured count that still get filled (e.g. extra bench
picks) are marked with a `*`.

### Grades tab

For every pick with a known rank, `value = pick number − rank at pick`: a
positive value is a steal (better player than the slot implied), negative
is a reach. Each team's average value is compared against the other teams
in *this* draft to produce a relative letter grade (A+ through D), plus
that team's best and worst value picks. Manual/unranked picks don't count
toward value.

### Data

This tool ships with no real player data — you bring your own rankings via
CSV import. The "Load sample data" button is placeholder data for trying
out the UI only.
