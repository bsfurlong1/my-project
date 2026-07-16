/**
 * Fantasy Football Division Winner Picker
 *
 * Google Sheets + Apps Script tool: everyone picks the winner of every
 * regular-season NFL game, and this derives who each person picked to win
 * each of the 8 divisions, then tallies votes across the whole league.
 *
 * Setup (run once from the "NFL Picks" menu after opening the sheet):
 *   1. Initialize (fetch schedule)
 *   2. Add Member  (repeat once per league member)
 *   3. Share the sheet with the league; everyone fills in their own column
 *      on the "Schedule" tab. "Division Winners" and "Tally" update
 *      automatically as picks come in.
 */

const SEASON = 2026;
const SCHEDULE_SHEET = 'Schedule';
const DIVWIN_SHEET = 'Division Winners';
const TALLY_SHEET = 'Tally';
const FIRST_MEMBER_COL = 5; // A=Week, B=Date, C=Away, D=Home, E.. = members

const DIVISIONS = {
  'AFC East': ['Buffalo Bills', 'Miami Dolphins', 'New England Patriots', 'New York Jets'],
  'AFC North': ['Baltimore Ravens', 'Cincinnati Bengals', 'Cleveland Browns', 'Pittsburgh Steelers'],
  'AFC South': ['Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans'],
  'AFC West': ['Denver Broncos', 'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers'],
  'NFC East': ['Dallas Cowboys', 'New York Giants', 'Philadelphia Eagles', 'Washington Commanders'],
  'NFC North': ['Chicago Bears', 'Detroit Lions', 'Green Bay Packers', 'Minnesota Vikings'],
  'NFC South': ['Atlanta Falcons', 'Carolina Panthers', 'New Orleans Saints', 'Tampa Bay Buccaneers'],
  'NFC West': ['Arizona Cardinals', 'Los Angeles Rams', 'San Francisco 49ers', 'Seattle Seahawks'],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('NFL Picks')
    .addItem('1. Initialize (fetch schedule)', 'initialize')
    .addItem('2. Add Member', 'addMemberPrompt')
    .addItem('3. Recompute Results', 'computeResults')
    .addToUi();
}

/** Simple trigger: auto-recompute whenever someone fills in a pick. */
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SCHEDULE_SHEET) return;
  if (e.range.getColumn() < FIRST_MEMBER_COL) return;
  if (e.range.getRow() < 2) return;
  computeResults();
}

function initialize() {
  const games = fetchSchedule();
  buildScheduleSheet(games);
  computeResults();
  SpreadsheetApp.getUi().alert(
    'Loaded ' + games.length + ' games for the ' + SEASON + ' season.\n' +
    'Now use "NFL Picks > Add Member" for each person in your league.'
  );
}

function fetchSchedule() {
  const games = [];
  for (let week = 1; week <= 18; week++) {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard' +
      '?dates=' + SEASON + '&seasontype=2&week=' + week;
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) continue;
    const data = JSON.parse(resp.getContentText());
    (data.events || []).forEach(function (event) {
      const comp = event.competitions[0];
      const home = comp.competitors.filter(function (c) { return c.homeAway === 'home'; })[0];
      const away = comp.competitors.filter(function (c) { return c.homeAway === 'away'; })[0];
      games.push({
        week: week,
        date: event.date,
        awayName: away.team.displayName,
        homeName: home.team.displayName,
      });
    });
    Utilities.sleep(150);
  }
  return games;
}

function buildScheduleSheet(games) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SCHEDULE_SHEET);
  if (sheet) {
    sheet.clear();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(SCHEDULE_SHEET);
  }
  const header = ['Week', 'Date', 'Away', 'Home'];
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  const rows = games.map(function (g) {
    return [g.week, formatGameDate(g.date), g.awayName, g.homeName];
  });
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  sheet.autoResizeColumns(1, header.length);
}

function formatGameDate(iso) {
  return Utilities.formatDate(new Date(iso), Session.getScriptTimeZone(), 'EEE MM/dd h:mm a');
}

function addMemberPrompt() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Add League Member', 'Enter their name:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const name = resp.getResponseText().trim();
  if (!name) return;
  addMember(name);
  computeResults();
}

function addMember(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDULE_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Run "Initialize" first.');
    return;
  }
  const numGames = sheet.getLastRow() - 1;
  const newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue(name).setFontWeight('bold');
  if (numGames <= 0) return;

  const awayHome = sheet.getRange(2, 3, numGames, 2).getValues();
  const rules = awayHome.map(function (row) {
    return [SpreadsheetApp.newDataValidation()
      .requireValueInList([row[0], row[1]], true)
      .setAllowInvalid(false)
      .build()];
  });
  sheet.getRange(2, newCol, numGames, 1).setDataValidations(rules);
  sheet.autoResizeColumn(newCol);
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function computeResults() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sched = ss.getSheetByName(SCHEDULE_SHEET);
  const divSheet = getOrCreateSheet(DIVWIN_SHEET);
  const tallySheet = getOrCreateSheet(TALLY_SHEET);
  divSheet.clear();
  tallySheet.clear();

  if (!sched) return;
  const numGames = sched.getLastRow() - 1;
  const numMembers = sched.getLastColumn() - (FIRST_MEMBER_COL - 1);
  if (numMembers <= 0 || numGames <= 0) {
    divSheet.getRange(1, 1).setValue('Add members and picks to see results.');
    tallySheet.getRange(1, 1).setValue('Add members and picks to see results.');
    return;
  }

  const members = sched.getRange(1, FIRST_MEMBER_COL, 1, numMembers).getValues()[0];
  // Columns C.. => [away, home, pick1, pick2, ...]
  const data = sched.getRange(2, 3, numGames, 2 + numMembers).getValues();

  const winCounts = members.map(function () { return {}; });
  const pickedCounts = members.map(function () { return 0; });

  data.forEach(function (row) {
    const away = row[0];
    const home = row[1];
    for (let m = 0; m < numMembers; m++) {
      const pick = row[2 + m];
      if (pick === away || pick === home) {
        pickedCounts[m]++;
        winCounts[m][pick] = (winCounts[m][pick] || 0) + 1;
      }
    }
  });

  const complete = pickedCounts.map(function (c) { return c === numGames; });
  const divNames = Object.keys(DIVISIONS);

  writeDivisionWinners(divSheet, members, complete, pickedCounts, numGames, winCounts, divNames);
  writeTally(tallySheet, members, complete, winCounts, divNames);
}

function writeDivisionWinners(divSheet, members, complete, pickedCounts, numGames, winCounts, divNames) {
  const header = ['Division'].concat(members);
  divSheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');

  const rows = divNames.map(function (div) {
    const teams = DIVISIONS[div];
    const row = [div];
    members.forEach(function (mem, m) {
      if (!complete[m]) {
        row.push('(incomplete: ' + pickedCounts[m] + '/' + numGames + ')');
        return;
      }
      const counts = teams.map(function (t) { return winCounts[m][t] || 0; });
      const max = Math.max.apply(null, counts);
      const winners = teams.filter(function (t, i) { return counts[i] === max; });
      row.push(winners.length > 1
        ? 'TIE: ' + winners.join(' / ') + ' (' + max + ' wins each)'
        : winners[0] + ' (' + max + ' wins)');
    });
    return row;
  });

  divSheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  divSheet.setFrozenColumns(1);
  divSheet.autoResizeColumns(1, header.length);
}

function writeTally(tallySheet, members, complete, winCounts, divNames) {
  const completeCount = complete.filter(Boolean).length;
  const out = [];
  out.push(['Tally based on ' + completeCount + ' of ' + members.length + ' members with complete picks']);
  out.push(['']);

  divNames.forEach(function (div) {
    const teams = DIVISIONS[div];
    out.push([div]);

    const tally = teams.map(function (team) {
      let votes = 0;
      members.forEach(function (mem, m) {
        if (!complete[m]) return;
        const counts = teams.map(function (t) { return winCounts[m][t] || 0; });
        const max = Math.max.apply(null, counts);
        if (max > 0 && (winCounts[m][team] || 0) === max) votes++;
      });
      return [team, votes];
    });

    tally.sort(function (a, b) { return b[1] - a[1]; });
    const topVotes = tally.length ? tally[0][1] : 0;
    tally.forEach(function (pair) {
      const team = pair[0];
      const votes = pair[1];
      const label = votes + (votes === 1 ? ' vote' : ' votes') +
        (votes > 0 && votes === topVotes ? '  <-- Division Winner Pick' : '');
      out.push(['', team, label]);
    });
    out.push(['']);
  });

  const width = out.reduce(function (w, r) { return Math.max(w, r.length); }, 1);
  const padded = out.map(function (r) {
    const copy = r.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });
  tallySheet.getRange(1, 1, padded.length, width).setValues(padded);
  tallySheet.autoResizeColumns(1, width);
}
