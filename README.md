# my-project

Google Sheets + Apps Script tool for a fantasy football division-winner pick'em:
every league member picks the winner of every regular-season NFL game, and the
sheet derives who each person effectively picked as the winner of each of the
8 divisions, then tallies votes across the whole league.

## How it works

- **Schedule** tab: every regular-season game (18 weeks), auto-fetched from
  ESPN's public schedule API. Each member gets their own column with a
  dropdown per game (their two team choices for that matchup).
- **Division Winners** tab: for each member, the team in each division with
  the most picked wins across the whole season is that member's division
  winner. Ties are shown explicitly; members who haven't picked every game
  yet are marked "(incomplete)".
- **Tally** tab: once a member's picks are complete, they count toward the
  vote total for their picked team in each division. Shows, for each of the
  8 divisions, which team got the most votes.

Results recompute automatically whenever anyone fills in a pick (no need to
re-run anything), via an `onEdit` trigger.

## Setup

1. Create a new Google Sheet.
2. **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and paste in this repo's `Code.gs`.
4. In the Apps Script editor, open **Project Settings** (gear icon) and
   check "Show `appsscript.json` manifest file in editor". Open that file
   and replace its contents with this repo's `appsscript.json`.
5. Save, then reload the spreadsheet tab.
6. A **NFL Picks** menu appears in the sheet. Run, in order:
   - **1. Initialize (fetch schedule)** — pulls the current season's
     schedule (authorize the script when prompted).
   - **2. Add Member** — once per person in your league.
7. Share the spreadsheet (edit access) with your league. Each person fills
   in their own column on the **Schedule** tab.
8. Check the **Division Winners** and **Tally** tabs any time — they update
   as people pick.

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
