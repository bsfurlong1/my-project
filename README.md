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

A separate, standalone tool for draft day itself — see
[`draft-day-analyzer/`](draft-day-analyzer/). It's a single self-contained
HTML file (no server, no build step): open it in a browser to track live
draft picks, see the best available player by your imported rankings, watch
each team's roster needs fill in, and get a running draft grade.
