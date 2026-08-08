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
  Schedule tab with a pair of checkbox columns added (**Pick Away** /
  **Pick Home**) — check the box under the team they think wins. Checking
  one automatically unchecks the other for that game. Each tab is
  edit-locked (via Sheets' protection feature) to just that member's Google
  account, so nobody can change anyone else's picks.

  **Important limitation:** Google Sheets has no way to hide a tab from
  specific people within one shared file — protection controls who can
  *edit* a tab, not who can *see* it. Anyone with access to this spreadsheet
  can see every member's tab; they just can't edit anyone else's. If you
  need picks to be genuinely invisible to other members (not just locked),
  that requires a different design (e.g. one spreadsheet per member, or a
  Google Form) — ask if you want that instead.
- **Division Winners** tab (read-only): for each member, the team in each
  division with the most picked wins across the whole season is that
  member's division winner. Ties are shown explicitly; members who haven't
  picked every game yet are marked "(incomplete)".
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
