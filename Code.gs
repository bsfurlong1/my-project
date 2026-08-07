/**
 * Fantasy Football Division Winner Picker
 *
 * Google Sheets + Apps Script tool: everyone picks the winner of every
 * regular-season NFL game, and this derives who each person picked to win
 * each of the 8 divisions, then tallies votes across the whole league.
 *
 * Setup (run once from the "NFL Picks" menu after opening the sheet):
 *   1. Initialize (fetch schedule) - also pulls stadium type and historical
 *      average weather for each game.
 *   2. Add Member  (repeat once per league member)
 *   3. Share the sheet with the league; everyone checks a box on the
 *      "Schedule" tab. "Division Winners" and "Tally" update automatically
 *      as picks come in.
 */

const SEASON = 2026;
const SCHEDULE_SHEET = 'Schedule';
const DIVWIN_SHEET = 'Division Winners';
const TALLY_SHEET = 'Tally';

// Schedule layout: two header rows, then games starting row 3.
// Cols: 1 Week, 2 Date, 3 Away, 4 Home, 5 Stadium Type, 6 Avg Temp, 7 Avg Precip,
// then two columns per member (Away checkbox, Home checkbox) starting at col 8.
const FIRST_DATA_ROW = 3;
const MEMBER_START_COL = 8;
const WEATHER_HISTORY_YEARS = 5;

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

// type: 'Dome' (fully enclosed, weather irrelevant), 'Retractable Roof'
// (roof can open, so outdoor conditions still shown), or 'Open Air'.
const STADIUMS = {
  'Buffalo Bills': { lat: 42.7738, lon: -78.7870, type: 'Open Air' },
  'Miami Dolphins': { lat: 25.9580, lon: -80.2389, type: 'Open Air' },
  'New England Patriots': { lat: 42.0909, lon: -71.2643, type: 'Open Air' },
  'New York Jets': { lat: 40.8135, lon: -74.0745, type: 'Open Air' },
  'Baltimore Ravens': { lat: 39.2780, lon: -76.6227, type: 'Open Air' },
  'Cincinnati Bengals': { lat: 39.0955, lon: -84.5160, type: 'Open Air' },
  'Cleveland Browns': { lat: 41.5061, lon: -81.6995, type: 'Open Air' },
  'Pittsburgh Steelers': { lat: 40.4468, lon: -80.0158, type: 'Open Air' },
  'Houston Texans': { lat: 29.6847, lon: -95.4107, type: 'Retractable Roof' },
  'Indianapolis Colts': { lat: 39.7601, lon: -86.1639, type: 'Retractable Roof' },
  'Jacksonville Jaguars': { lat: 30.3239, lon: -81.6373, type: 'Open Air' },
  'Tennessee Titans': { lat: 36.1665, lon: -86.7713, type: 'Open Air' },
  'Denver Broncos': { lat: 39.7439, lon: -105.0201, type: 'Open Air' },
  'Kansas City Chiefs': { lat: 39.0489, lon: -94.4839, type: 'Open Air' },
  'Las Vegas Raiders': { lat: 36.0909, lon: -115.1833, type: 'Dome' },
  'Los Angeles Chargers': { lat: 33.9535, lon: -118.3392, type: 'Open Air' },
  'Dallas Cowboys': { lat: 32.7473, lon: -97.0945, type: 'Retractable Roof' },
  'New York Giants': { lat: 40.8135, lon: -74.0745, type: 'Open Air' },
  'Philadelphia Eagles': { lat: 39.9008, lon: -75.1675, type: 'Open Air' },
  'Washington Commanders': { lat: 38.9077, lon: -76.8645, type: 'Open Air' },
  'Chicago Bears': { lat: 41.8623, lon: -87.6167, type: 'Open Air' },
  'Detroit Lions': { lat: 42.3400, lon: -83.0456, type: 'Dome' },
  'Green Bay Packers': { lat: 44.5013, lon: -88.0622, type: 'Open Air' },
  'Minnesota Vikings': { lat: 44.9738, lon: -93.2581, type: 'Dome' },
  'Atlanta Falcons': { lat: 33.7554, lon: -84.4008, type: 'Retractable Roof' },
  'Carolina Panthers': { lat: 35.2258, lon: -80.8528, type: 'Open Air' },
  'New Orleans Saints': { lat: 29.9511, lon: -90.0812, type: 'Dome' },
  'Tampa Bay Buccaneers': { lat: 27.9759, lon: -82.5033, type: 'Open Air' },
  'Arizona Cardinals': { lat: 33.5276, lon: -112.2626, type: 'Retractable Roof' },
  'Los Angeles Rams': { lat: 33.9535, lon: -118.3392, type: 'Open Air' },
  'San Francisco 49ers': { lat: 37.4032, lon: -121.9698, type: 'Open Air' },
  'Seattle Seahawks': { lat: 47.5952, lon: -122.3316, type: 'Open Air' },
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('NFL Picks')
    .addItem('1. Initialize (fetch schedule)', 'showFetchScheduleDialog')
    .addItem('2. Add Member', 'addMemberPrompt')
    .addItem('3. Recompute Results', 'computeResults')
    .addToUi();
}

/** Simple trigger: enforce one pick per game and auto-recompute results. */
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SCHEDULE_SHEET) return;
  if (e.range.getRow() < FIRST_DATA_ROW) return;
  if (e.range.getColumn() < MEMBER_START_COL) return;
  enforceSingleSelect(sheet, e.range);
  computeResults();
}

/** A game pick is two checkbox columns (Away/Home); checking one unchecks the other. */
function enforceSingleSelect(sheet, range) {
  const startRow = range.getRow();
  const startCol = range.getColumn();
  const values = range.getValues();
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values[i].length; j++) {
      if (values[i][j] !== true) continue;
      const col = startCol + j;
      if (col < MEMBER_START_COL) continue;
      const isAwayCol = (col - MEMBER_START_COL) % 2 === 0;
      const siblingCol = isAwayCol ? col + 1 : col - 1;
      const siblingCell = sheet.getRange(startRow + i, siblingCol);
      if (siblingCell.getValue() === true) siblingCell.setValue(false);
    }
  }
}

/**
 * ESPN's schedule API blocks requests that come from Google's own server IPs
 * (Apps Script's UrlFetchApp runs on Google Cloud), returning a WAF "Access
 * Denied" page instead of data. So instead of fetching server-side, this
 * opens a small dialog that fetches the schedule from the user's own browser
 * (a normal residential/office IP, not blocked) and sends the results back.
 */
function showFetchScheduleDialog() {
  const template = HtmlService.createTemplateFromFile('FetchDialog');
  template.season = SEASON;
  const html = template.evaluate().setWidth(420).setHeight(220);
  SpreadsheetApp.getUi().showModalDialog(html, 'Fetching ' + SEASON + ' Schedule');
}

/** Called from FetchDialog.html once the browser has fetched all 18 weeks. */
function receiveScheduleFromClient(gamesJson, problemsJson) {
  const games = JSON.parse(gamesJson);
  const problems = JSON.parse(problemsJson || '[]');

  if (!games.length) {
    return {
      message: 'No games were loaded.\n' +
        (problems.slice(0, 5).join('\n') || 'Unknown error.') +
        (problems.length > 5 ? '\n(+' + (problems.length - 5) + ' more)' : ''),
    };
  }

  const weather = computeStadiumAndWeather(games);
  buildScheduleSheet(games, weather);
  computeResults();

  let msg = 'Loaded ' + games.length + ' games for the ' + SEASON + ' season, ' +
    'with stadium type and historical average weather.\n' +
    'Now use "NFL Picks > Add Member" for each person in your league.';
  if (problems.length) {
    msg += '\n\n(' + problems.length + ' week(s) had issues fetching from your browser - the rest loaded fine.)';
  }
  return { message: msg };
}

/**
 * For each game, returns { stadiumType, tempStr, precipStr }. Weather is the
 * historical average (temp + precipitation) for that stadium's location on
 * that calendar date, pulled once per unique location and reused across all
 * of that team's home games. Dome games skip weather entirely.
 */
function computeStadiumAndWeather(games) {
  const seriesCache = {};
  return games.map(function (g) {
    const info = STADIUMS[g.homeName];
    if (!info) return { stadiumType: 'Unknown', tempStr: 'N/A', precipStr: 'N/A' };
    if (info.type === 'Dome') {
      return { stadiumType: info.type, tempStr: 'N/A (Dome)', precipStr: 'N/A (Dome)' };
    }
    const key = info.lat + ',' + info.lon;
    if (!seriesCache[key]) {
      seriesCache[key] = fetchWeatherSeries(info.lat, info.lon);
      Utilities.sleep(150);
    }
    const avg = averageForDate(seriesCache[key], new Date(g.date));
    return {
      stadiumType: info.type,
      tempStr: avg ? (Math.round(avg.avgTemp * 10) / 10) + '°F' : 'N/A',
      precipStr: avg ? (Math.round(avg.avgPrecip * 100) / 100) + ' in' : 'N/A',
    };
  });
}

/** Daily temp/precip history for a location over the last WEATHER_HISTORY_YEARS full years. */
function fetchWeatherSeries(lat, lon) {
  const endYear = new Date().getFullYear() - 1;
  const startYear = endYear - WEATHER_HISTORY_YEARS + 1;
  const url = 'https://archive-api.open-meteo.com/v1/archive' +
    '?latitude=' + lat + '&longitude=' + lon +
    '&start_date=' + startYear + '-01-01&end_date=' + endYear + '-12-31' +
    '&daily=temperature_2m_mean,precipitation_sum' +
    '&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=UTC';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return [];
  const data = JSON.parse(resp.getContentText());
  const daily = data.daily;
  if (!daily || !daily.time) return [];
  return daily.time.map(function (dateStr, i) {
    return {
      date: new Date(dateStr),
      temp: daily.temperature_2m_mean[i],
      precip: daily.precipitation_sum[i],
    };
  });
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

/** Circular distance between two day-of-year values (handles wraparound near Dec/Jan). */
function doyDistance(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 366 - d);
}

/** Averages temp/precip across the same +/-3 day window on the calendar, over all history years. */
function averageForDate(series, gameDate) {
  const targetDoy = dayOfYear(gameDate);
  const temps = [];
  const precips = [];
  series.forEach(function (pt) {
    if (doyDistance(dayOfYear(pt.date), targetDoy) > 3) return;
    if (typeof pt.temp === 'number') temps.push(pt.temp);
    if (typeof pt.precip === 'number') precips.push(pt.precip);
  });
  if (!temps.length) return null;
  const sum = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0); };
  return {
    avgTemp: sum(temps) / temps.length,
    avgPrecip: precips.length ? sum(precips) / precips.length : 0,
  };
}

function buildScheduleSheet(games, weather) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SCHEDULE_SHEET);
  if (sheet) {
    try { sheet.getDataRange().breakApart(); } catch (err) { /* nothing to unmerge */ }
    sheet.clear();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(SCHEDULE_SHEET);
  }

  const staticHeaders = ['Week', 'Date', 'Away', 'Home', 'Stadium Type', 'Avg Temp', 'Avg Precip'];
  sheet.getRange(1, 1, 1, staticHeaders.length).setValues([staticHeaders]).setFontWeight('bold');
  for (let c = 1; c <= staticHeaders.length; c++) {
    sheet.getRange(1, c, 2, 1).merge().setVerticalAlignment('middle');
  }

  const rows = games.map(function (g, i) {
    const w = weather[i];
    return [g.week, formatGameDate(g.date), g.awayName, g.homeName, w.stadiumType, w.tempStr, w.precipStr];
  });
  if (rows.length) {
    sheet.getRange(FIRST_DATA_ROW, 1, rows.length, staticHeaders.length).setValues(rows);
  }
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(staticHeaders.length);
  sheet.autoResizeColumns(1, staticHeaders.length);
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

/** Adds a member as a pair of checkbox columns (Away pick / Home pick) instead of a dropdown. */
function addMember(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDULE_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Run "Initialize" first.');
    return;
  }
  const numGames = sheet.getLastRow() - (FIRST_DATA_ROW - 1);
  const awayCol = sheet.getLastColumn() + 1;
  const homeCol = awayCol + 1;

  sheet.getRange(1, awayCol, 1, 2).merge().setValue(name)
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(2, awayCol).setValue('Away').setFontStyle('italic');
  sheet.getRange(2, homeCol).setValue('Home').setFontStyle('italic');

  if (numGames > 0) {
    sheet.getRange(FIRST_DATA_ROW, awayCol, numGames, 1).insertCheckboxes();
    sheet.getRange(FIRST_DATA_ROW, homeCol, numGames, 1).insertCheckboxes();
  }
  sheet.autoResizeColumns(awayCol, 2);
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
  const numGames = sched.getLastRow() - (FIRST_DATA_ROW - 1);
  const numMembers = Math.floor((sched.getLastColumn() - MEMBER_START_COL + 1) / 2);
  if (numMembers <= 0 || numGames <= 0) {
    divSheet.getRange(1, 1).setValue('Add members and picks to see results.');
    tallySheet.getRange(1, 1).setValue('Add members and picks to see results.');
    return;
  }

  const members = [];
  for (let m = 0; m < numMembers; m++) {
    members.push(sched.getRange(1, MEMBER_START_COL + 2 * m).getValue());
  }

  // Columns C.. => [away, home, away1?, home1?, away2?, home2?, ...]
  const data = sched.getRange(FIRST_DATA_ROW, 3, numGames, sched.getLastColumn() - 2).getValues();
  const pickOffset = MEMBER_START_COL - 3; // index within the row array where member checkboxes start

  const winCounts = members.map(function () { return {}; });
  const pickedCounts = members.map(function () { return 0; });

  data.forEach(function (row) {
    const away = row[0];
    const home = row[1];
    for (let m = 0; m < numMembers; m++) {
      const awayChecked = row[pickOffset + 2 * m] === true;
      const homeChecked = row[pickOffset + 2 * m + 1] === true;
      let pick = null;
      if (awayChecked && !homeChecked) pick = away;
      else if (homeChecked && !awayChecked) pick = home;
      if (pick) {
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
