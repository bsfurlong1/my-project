# my-project

Google Sheets + Apps Script tool for a fantasy football division-winner pick'em:
every league member picks the winner of every regular-season NFL game, and the
sheet derives who each person effectively picked as the winner of each of the
8 divisions, then tallies votes across the whole league.

## How it works

- **Schedule** tab: every regular-season game (18 weeks), auto-fetched from
  ESPN's public schedule API, plus for each game:
  - **Stadium Type** — Dome, Retractable Roof, or Open Air.
  - **Avg Temp** / **Avg Precip** — the historical average temperature and
    precipitation for that stadium's location on that calendar date (pulled
    from Open-Meteo's historical weather archive, averaged over the last 5
    years within a few days of the game date). Dome games show "N/A (Dome)"
    since weather doesn't apply.
  - Each member gets a pair of checkbox columns per game (**Away** / **Home**)
    instead of a dropdown — check the box under the team they think wins.
    Checking one automatically unchecks the other for that game.
- **Division Winners** tab: for each member, the team in each division with
  the most picked wins across the whole season is that member's division
  winner. Ties are shown explicitly; members who haven't picked every game
  yet are marked "(incomplete)".
- **Tally** tab: once a member's picks are complete, they count toward the
  vote total for their picked team in each division. Shows, for each of the
  8 divisions, which team got the most votes.

Results recompute automatically whenever anyone checks a box (no need to
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
     schedule plus stadium type and historical average weather for every
     game (authorize the script when prompted; this can take a minute or two
     the first time since it also fetches weather history).
   - **2. Add Member** — once per person in your league.
7. Share the spreadsheet (edit access) with your league. Each person checks
   the box under their pick (Away or Home) for every game on the
   **Schedule** tab.
8. Check the **Division Winners** and **Tally** tabs any time — they update
   as people pick.

To change the season, edit the `SEASON` constant at the top of `Code.gs`
before running Initialize.
