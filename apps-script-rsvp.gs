// 참석 여부 회신 + 방명록을 구글시트에 저장/조회하는 Apps Script 웹앱입니다.
// 사용법은 저장소 README 또는 안내 메시지를 참고해 배포하세요.

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const type = e.parameter.type;

  if (type === 'rsvp') {
    let sheet = ss.getSheetByName('RSVP응답');
    if (!sheet) {
      sheet = ss.insertSheet('RSVP응답');
      sheet.appendRow(['시각', '이름', '참석측', '참석여부', '인원', '식사여부']);
    }
    sheet.appendRow([
      new Date(),
      e.parameter.name || '',
      e.parameter.side || '',
      e.parameter.attend || '',
      e.parameter.count || '',
      e.parameter.meal || ''
    ]);
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
