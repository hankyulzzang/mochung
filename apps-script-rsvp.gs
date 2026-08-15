// 참석 여부 회신 + 방명록을 구글시트에 저장/조회하는 Apps Script 웹앱입니다.
// 사용법은 저장소 README 또는 안내 메시지를 참고해 배포하세요.

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const type = e.parameter.type;

  if (type === 'rsvp') {
    let sheet = ss.getSheetByName('RSVP응답');
    if (!sheet) {
      sheet = ss.insertSheet('RSVP응답');
      sheet.appendRow(['시각', '이름', '참석측', '참석여부', '인원']);
    }
    sheet.appendRow([
      new Date(),
      e.parameter.name || '',
      e.parameter.side || '',
      e.parameter.attend || '',
      e.parameter.count || ''
    ]);

    // 신랑측/신부측 참석 인원 합계를 G/H열에 항상 채워둡니다(수식이라 응답이
    // 쌓일 때마다 자동으로 다시 계산됩니다).
    sheet.getRange('G1').setValue('신랑측 참석인원');
    sheet.getRange('H1').setFormula('=SUMIFS(E:E, C:C, "신랑측", D:D, "참석")');
    sheet.getRange('G2').setValue('신부측 참석인원');
    sheet.getRange('H2').setFormula('=SUMIFS(E:E, C:C, "신부측", D:D, "참석")');
  } else if (type === 'guestbook') {
    let sheet = ss.getSheetByName('방명록');
    if (!sheet) {
      sheet = ss.insertSheet('방명록');
      sheet.appendRow(['시각', '이름', '메시지']);
    }
    sheet.appendRow([
      new Date(),
      e.parameter.name || '',
      e.parameter.message || ''
    ]);
  } else if (type === 'babyquiz') {
    let sheet = ss.getSheetByName('화동퀴즈');
    if (!sheet) {
      sheet = ss.insertSheet('화동퀴즈');
      sheet.appendRow(['시각', '이름', '맞은개수', '전체문제수']);
    }
    sheet.appendRow([
      new Date(),
      e.parameter.name || '',
      e.parameter.score || '',
      e.parameter.total || ''
    ]);
  }

  return ContentService.createTextOutput('ok');
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('방명록');
  const result = [];

  if (sheet) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const name = rows[i][1];
      const message = rows[i][2];
      if (name || message) {
        result.push({ name: String(name), message: String(message) });
      }
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
