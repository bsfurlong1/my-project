/**
 * Fantasy Football Division Winner Picker
 *
 * Google Sheets + Apps Script tool: everyone picks the winner of every
 * regular-season NFL game, and this derives who each person picked to win
 * each of the 8 divisions, then tallies votes across the whole league.
 *
 * Each member gets their own tab, edit-protected so only they (and the
 * spreadsheet owner) can change it. Note: Google Sheets has no way to hide
 * one tab from specific viewers within a single shared file - protection
 * only controls who can EDIT a tab, not who can see it. Anyone with access
 * to this spreadsheet can see every member's tab; they just can't edit
 * anyone else's.
 *
 * Setup (run once from the "NFL Picks" menu after opening the sheet):
 *   1. Initialize (fetch schedule) - builds the read-only master Schedule
 *      tab with stadium type and historical average weather for each game.
 *   2. Add Member (repeat once per league member) - creates that member's
 *      own picks tab, copied from the master schedule, and locks it so only
 *      that member can edit it.
 *   3. Share the spreadsheet (Editor access) with the league. Each member
 *      checks boxes on their own tab. "Division Winners" and "Tally" update
 *      automatically as picks come in.
 */

const SEASON = 2026;
const SCHEDULE_SHEET = 'Schedule';
const DIVWIN_SHEET = 'Division Winners';
const TALLY_SHEET = 'Tally';
const MEMBERS_SHEET = 'Members';
const WEATHER_HISTORY_YEARS = 5;

// Master Schedule tab layout (read-only, no picking here): one header row,
// then games starting row 2.
const MASTER_HEADERS = ['Week', 'Date', 'Away', 'Home', 'Stadium Type', 'Avg Temp', 'Snow Chance'];
const FIRST_DATA_ROW = 2;

// Member tab layout: a checkbox sits immediately next to each team name so
// picking is a single click right on the matchup, and conditional formatting
// turns that team's name green when its checkbox is checked. Row 1 is a
// live status banner ("all picked" / "N left"), row 2 is the header, and
// game rows start at MEMBER_FIRST_DATA_ROW.
const MEMBER_HEADERS = ['Week', 'Date', '✓', 'Away', '✓', 'Home', 'Stadium Type', 'Avg Temp', 'Snow Chance'];
const MEMBER_HEADER_ROW = FIRST_DATA_ROW; // row 2
const MEMBER_FIRST_DATA_ROW = FIRST_DATA_ROW + 1; // row 3
const COL_PICK_AWAY = 3;
const COL_AWAY = 4;
const COL_PICK_HOME = 5;
const COL_HOME = 6;
const PICK_GREEN = '#b7e1cd';
const INCOMPLETE_RED = '#f4cccc';

const SYSTEM_SHEETS = [SCHEDULE_SHEET, DIVWIN_SHEET, TALLY_SHEET, MEMBERS_SHEET];

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
    .addItem('3. Recompute Results', 'recomputeResultsMenuAction')
    .addToUi();
}

/**
 * Simple trigger (fires instantly, runs as whoever is editing): only handles
 * the Away/Home checkbox toggle on the editor's own tab, which they always
 * have permission to edit. Writing results to the protected Division
 * Winners/Tally tabs needs owner authority - see recomputeOnEdit below.
 */
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (SYSTEM_SHEETS.indexOf(sheet.getName()) !== -1) return;
  if (e.range.getRow() < MEMBER_FIRST_DATA_ROW) return;
  enforceSingleSelect(sheet, e.range);
}

/**
 * Installable trigger (must be registered once - done automatically during
 * Initialize/Add Member) that always runs with the authority of whoever
 * installed it (the spreadsheet owner), so it can write to the protected
 * Division Winners/Tally tabs no matter which member made the edit.
 */
function recomputeOnEdit(e) {
  const sheet = e.range.getSheet();
  if (SYSTEM_SHEETS.indexOf(sheet.getName()) !== -1) return;
  if (e.range.getRow() < MEMBER_FIRST_DATA_ROW) return;
  computeResults();
}

function ensureRecomputeTrigger() {
  const exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'recomputeOnEdit' && t.getEventType() === ScriptApp.EventType.ON_EDIT;
  });
  if (!exists) {
    ScriptApp.newTrigger('recomputeOnEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  }
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
      if (col !== COL_PICK_AWAY && col !== COL_PICK_HOME) continue;
      const siblingCol = col === COL_PICK_AWAY ? COL_PICK_HOME : COL_PICK_AWAY;
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

  try {
    const weather = computeStadiumAndWeather(games);
    buildScheduleSheet(games, weather);
    ensureRecomputeTrigger();
    computeResults();
  } catch (err) {
    return { message: 'Fetched ' + games.length + ' games, but saving failed: ' + err.message +
      '\n\n(Only the spreadsheet owner can run Initialize.)' };
  }

  let msg = 'Loaded ' + games.length + ' games for the ' + SEASON + ' season, ' +
    'with stadium type and historical average weather.\n' +
    'Now use "NFL Picks > Add Member" for each person in your league.';
  if (problems.length) {
    msg += '\n\n(' + problems.length + ' week(s) had issues fetching from your browser - the rest loaded fine.)';
  }
  return { message: msg };
}

/**
 * For each game, returns { stadiumType, tempStr, snowStr }. Weather is the
 * historical average temperature and snow probability for that stadium's
 * location on that calendar date, pulled once per unique location and reused
 * across all of that team's home games. Dome games skip weather entirely.
 */
function computeStadiumAndWeather(games) {
  const seriesCache = {};
  return games.map(function (g) {
    const info = STADIUMS[g.homeName];
    if (!info) return { stadiumType: 'Unknown', tempStr: 'N/A', snowStr: 'N/A' };
    if (info.type === 'Dome') {
      return { stadiumType: info.type, tempStr: 'N/A (Dome)', snowStr: 'N/A (Dome)' };
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
      snowStr: avg && avg.snowProbability !== null ? Math.round(avg.snowProbability) + '% snow' : 'N/A',
    };
  });
}

/** Daily temp/snowfall history for a location over the last WEATHER_HISTORY_YEARS full years. */
function fetchWeatherSeries(lat, lon) {
  const endYear = new Date().getFullYear() - 1;
  const startYear = endYear - WEATHER_HISTORY_YEARS + 1;
  const url = 'https://archive-api.open-meteo.com/v1/archive' +
    '?latitude=' + lat + '&longitude=' + lon +
    '&start_date=' + startYear + '-01-01&end_date=' + endYear + '-12-31' +
    '&daily=temperature_2m_mean,snowfall_sum' +
    '&temperature_unit=fahrenheit&timezone=UTC';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return [];
  const data = JSON.parse(resp.getContentText());
  const daily = data.daily;
  if (!daily || !daily.time) return [];
  return daily.time.map(function (dateStr, i) {
    return {
      date: new Date(dateStr),
      temp: daily.temperature_2m_mean[i],
      snow: daily.snowfall_sum[i],
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

/**
 * Averages temp, and computes snow probability (% of days with any measurable
 * snowfall), across the same +/-3 day window on the calendar, over all
 * history years.
 */
function averageForDate(series, gameDate) {
  const targetDoy = dayOfYear(gameDate);
  const temps = [];
  let snowDaysWithData = 0;
  let snowDaysWithSnow = 0;
  series.forEach(function (pt) {
    if (doyDistance(dayOfYear(pt.date), targetDoy) > 3) return;
    if (typeof pt.temp === 'number') temps.push(pt.temp);
    if (typeof pt.snow === 'number') {
      snowDaysWithData++;
      if (pt.snow > 0) snowDaysWithSnow++;
    }
  });
  if (!temps.length) return null;
  const sum = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0); };
  return {
    avgTemp: sum(temps) / temps.length,
    snowProbability: snowDaysWithData ? (100 * snowDaysWithSnow / snowDaysWithData) : null,
  };
}

/** Builds the read-only master Schedule tab (no picks - members copy from this). */
function buildScheduleSheet(games, weather) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SCHEDULE_SHEET);
  if (sheet) {
    sheet.clear();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(SCHEDULE_SHEET);
  }

  sheet.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]).setFontWeight('bold');
  const rows = games.map(function (g, i) {
    const w = weather[i];
    return [g.week, formatGameDate(g.date), g.awayName, g.homeName, w.stadiumType, w.tempStr, w.snowStr];
  });
  if (rows.length) {
    sheet.getRange(FIRST_DATA_ROW, 1, rows.length, MASTER_HEADERS.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  sheet.autoResizeColumns(1, MASTER_HEADERS.length);
  protectReadOnlySheet(sheet);
  return sheet;
}

function formatGameDate(iso) {
  return Utilities.formatDate(new Date(iso), Session.getScriptTimeZone(), 'EEE MM/dd h:mm a');
}

function addMemberPrompt() {
  const ui = SpreadsheetApp.getUi();
  const nameResp = ui.prompt('Add League Member', 'Enter their name (this becomes their tab name):', ui.ButtonSet.OK_CANCEL);
  if (nameResp.getSelectedButton() !== ui.Button.OK) return;
  const name = nameResp.getResponseText().trim();
  if (!name) return;

  const emailResp = ui.prompt('Add League Member', 'Enter their Google account email (needed to lock their tab to just them):', ui.ButtonSet.OK_CANCEL);
  if (emailResp.getSelectedButton() !== ui.Button.OK) return;
  const email = emailResp.getResponseText().trim();
  if (!email) return;

  const result = addMember(name, email);
  ui.alert(result.message);
}

/** Creates a member's own picks tab (copied from the master schedule) and locks it to just them. */
function addMember(name, email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = ss.getSheetByName(SCHEDULE_SHEET);
  if (!master) return { message: 'Run "Initialize" first.' };
  if (ss.getSheetByName(name)) {
    return { message: 'A tab named "' + name + '" already exists - pick a different name, or delete/rename the existing tab first.' };
  }

  const numGames = master.getLastRow() - (FIRST_DATA_ROW - 1);
  if (numGames <= 0) return { message: 'Run "Initialize" first - no games loaded yet.' };

  try {
    // Master row = [week, date, away, home, stadium, temp, snow]. Re-map into
    // the member layout, which interleaves a pick checkbox before each team
    // name: [week, date, <pickAway>, away, <pickHome>, home, stadium, temp, snow].
    const masterRows = master.getRange(FIRST_DATA_ROW, 1, numGames, MASTER_HEADERS.length).getValues();
    const memberRows = masterRows.map(function (r) {
      return [r[0], r[1], '', r[2], '', r[3], r[4], r[5], r[6]];
    });

    const sheet = ss.insertSheet(name);
    sheet.getRange(MEMBER_HEADER_ROW, 1, 1, MEMBER_HEADERS.length).setValues([MEMBER_HEADERS]).setFontWeight('bold');
    sheet.getRange(MEMBER_FIRST_DATA_ROW, 1, numGames, MEMBER_HEADERS.length).setValues(memberRows);
    sheet.getRange(MEMBER_FIRST_DATA_ROW, COL_PICK_AWAY, numGames, 1).insertCheckboxes();
    sheet.getRange(MEMBER_FIRST_DATA_ROW, COL_PICK_HOME, numGames, 1).insertCheckboxes();
    sheet.setFrozenRows(MEMBER_FIRST_DATA_ROW - 1);
    sheet.setFrozenColumns(COL_HOME);
    sheet.autoResizeColumns(1, MEMBER_HEADERS.length);
    // Narrow the checkbox columns after auto-resize so it doesn't widen them back out.
    sheet.setColumnWidth(COL_PICK_AWAY, 40);
    sheet.setColumnWidth(COL_PICK_HOME, 40);

    applyStatusBanner(sheet, numGames);
    applyPickFormatting(sheet, numGames);
    protectMemberSheet(sheet, email);
    registerMember(name, email, sheet.getName());
    ensureRecomputeTrigger();
  } catch (err) {
    return { message: 'Could not add member: ' + err.message + '\n\n(Only the spreadsheet owner can add members.)' };
  }

  return { message: 'Added ' + name + '. Share the spreadsheet with ' + email + ' (Editor access) so they can fill in their tab.' };
}

/**
 * Writes a live status banner in row 1 ("All N games picked!" / "N left")
 * driven by a plain Sheets formula, so it updates instantly on every
 * checkbox click with no script/trigger round-trip. Color follows via
 * conditional formatting on the banner text itself.
 */
function applyStatusBanner(sheet, numGames) {
  const lastDataRow = MEMBER_FIRST_DATA_ROW + numGames - 1;
  const awayCol = columnLetter(COL_PICK_AWAY);
  const homeCol = columnLetter(COL_PICK_HOME);
  const awayRange = '$' + awayCol + '$' + MEMBER_FIRST_DATA_ROW + ':$' + awayCol + '$' + lastDataRow;
  const homeRange = '$' + homeCol + '$' + MEMBER_FIRST_DATA_ROW + ':$' + homeCol + '$' + lastDataRow;
  const missingCountExpr = 'COUNTIFS(' + awayRange + ',FALSE,' + homeRange + ',FALSE)';

  const formula = '=IF(' + missingCountExpr + '=0,' +
    '"✅ All ' + numGames + ' games picked!",' +
    '"⏳ " & ' + missingCountExpr + ' & " of ' + numGames + ' games still need a pick")';

  // Merging can't cross the frozen/non-frozen column boundary (set in
  // addMember before this runs), so the banner spans only the frozen
  // columns (1..COL_HOME) - which stay visible regardless of scroll anyway.
  const bannerRange = sheet.getRange(1, 1, 1, COL_HOME);
  bannerRange.merge().setFormula(formula).setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setFontWeight('bold').setFontSize(12);

  const completeRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('✅')
    .setBackground(PICK_GREEN)
    .setRanges([bannerRange])
    .build();
  const incompleteRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('⏳')
    .setBackground(INCOMPLETE_RED)
    .setRanges([bannerRange])
    .build();

  sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat([completeRule, incompleteRule]));
}

/** Turns a team's name green when its pick checkbox (in the same row) is checked. */
function applyPickFormatting(sheet, numGames) {
  const awayNameRange = sheet.getRange(MEMBER_FIRST_DATA_ROW, COL_AWAY, numGames, 1);
  const homeNameRange = sheet.getRange(MEMBER_FIRST_DATA_ROW, COL_HOME, numGames, 1);
  const awayCol = columnLetter(COL_PICK_AWAY);
  const homeCol = columnLetter(COL_PICK_HOME);

  const awayRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + awayCol + MEMBER_FIRST_DATA_ROW + '=TRUE')
    .setBackground(PICK_GREEN)
    .setBold(true)
    .setRanges([awayNameRange])
    .build();
  const homeRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + homeCol + MEMBER_FIRST_DATA_ROW + '=TRUE')
    .setBackground(PICK_GREEN)
    .setBold(true)
    .setRanges([homeNameRange])
    .build();

  sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat([awayRule, homeRule]));
}

/** Converts a 1-based column index to its A1 letter (3 -> "C"). */
function columnLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

/** Restricts editing of a sheet to just the given email (the owner always retains edit access). */
function protectMemberSheet(sheet, email) {
  const protection = sheet.protect().setDescription('Picks for ' + sheet.getName() + ' - edit-locked to that member');
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
  protection.addEditor(email);
}

/** Locks a computed/reference sheet so only the spreadsheet owner can edit it. Idempotent. */
function protectReadOnlySheet(sheet) {
  if (sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length > 0) return;
  const protection = sheet.protect().setDescription('Read-only - computed/reference data');
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
}

/** Members registry: Name | Email | Tab. Kept hidden and owner-only editable. */
function registerMember(name, email, tabName) {
  const reg = getOrCreateSheet(MEMBERS_SHEET);
  if (reg.getLastRow() === 0) {
    reg.getRange(1, 1, 1, 3).setValues([['Name', 'Email', 'Tab']]).setFontWeight('bold');
  }
  reg.appendRow([name, email, tabName]);
  reg.hideSheet();
  protectReadOnlySheet(reg);
}

/** Returns [{ name, email, tab }, ...] from the Members registry. */
function getMembers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(MEMBERS_SHEET);
  if (!reg || reg.getLastRow() < 2) return [];
  return reg.getRange(2, 1, reg.getLastRow() - 1, 3).getValues()
    .filter(function (row) { return row[0]; })
    .map(function (row) { return { name: row[0], email: row[1], tab: row[2] }; });
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function recomputeResultsMenuAction() {
  const ui = SpreadsheetApp.getUi();
  try {
    computeResults();
    ui.alert('Results recomputed.');
  } catch (err) {
    ui.alert('Could not recompute (' + err.message + '). Results already update automatically as picks come in, ' +
      'so you likely don\'t need to run this manually - only the spreadsheet owner can force a recompute.');
  }
}

function computeResults() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = ss.getSheetByName(SCHEDULE_SHEET);
  const divSheet = getOrCreateSheet(DIVWIN_SHEET);
  const tallySheet = getOrCreateSheet(TALLY_SHEET);
  divSheet.clear();
  tallySheet.clear();

  if (!master) return;
  const numGames = master.getLastRow() - (FIRST_DATA_ROW - 1);
  const memberRecords = getMembers();
  if (!memberRecords.length || numGames <= 0) {
    divSheet.getRange(1, 1).setValue('Add members and picks to see results.');
    tallySheet.getRange(1, 1).setValue('Add members and picks to see results.');
    protectReadOnlySheet(divSheet);
    protectReadOnlySheet(tallySheet);
    return;
  }

  const masterAwayHome = master.getRange(FIRST_DATA_ROW, 3, numGames, 2).getValues();
  const members = memberRecords.map(function (m) { return m.name; });
  const winCounts = members.map(function () { return {}; });
  const pickedCounts = members.map(function () { return 0; });

  memberRecords.forEach(function (mem, m) {
    const sheet = ss.getSheetByName(mem.tab);
    if (!sheet) return; // tab was renamed/deleted; treat as no picks
    // COL_PICK_AWAY and COL_PICK_HOME aren't adjacent (the team name column
    // sits between them), so they're read separately rather than as one range.
    const awayPicks = sheet.getRange(MEMBER_FIRST_DATA_ROW, COL_PICK_AWAY, numGames, 1).getValues();
    const homePicks = sheet.getRange(MEMBER_FIRST_DATA_ROW, COL_PICK_HOME, numGames, 1).getValues();
    for (let g = 0; g < numGames; g++) {
      const away = masterAwayHome[g][0];
      const home = masterAwayHome[g][1];
      const awayChecked = awayPicks[g][0] === true;
      const homeChecked = homePicks[g][0] === true;
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
  protectReadOnlySheet(divSheet);
  protectReadOnlySheet(tallySheet);
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
