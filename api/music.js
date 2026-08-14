// 배경음악 파일을 구글드라이브에서 대신 받아와 그대로 흘려보내는 프록시입니다.
// 드라이브의 다운로드 주소를 <audio> 태그에 직접 넣으면 브라우저가 "파일 다운로드"로
// 취급해버려서(Content-Disposition: attachment) 페이지 안에서 바로 재생되지 않습니다.
// 그래서 이 서버리스 함수가 대신 파일을 받아 Content-Disposition 없이(inline) 그대로
// 돌려줘서, <audio src="/api/music">처럼 우리 사이트 안의 평범한 오디오 파일처럼
// 다뤄지게 만듭니다. 또한 재생 위치 이동(currentTime 설정)이 되려면 브라우저가
// 파일 크기/구간 요청(Range)을 알아야 해서, Content-Length와 Range 요청도 그대로
// 구글드라이브 쪽에 전달하고 응답을 그대로 돌려줍니다.
const BG_MUSIC_DRIVE_ID = '1cLKn4VWr7xkkPCP67COfQKCBZrf_1BjA';

module.exports = async (req, res) => {
  const driveUrl = 'https://drive.usercontent.google.com/download?id=' + BG_MUSIC_DRIVE_ID + '&export=download&confirm=t';

  const fetchHeaders = {};
  if (req.headers.range) fetchHeaders.range = req.headers.range;

  let driveRes;
  try {
    driveRes = await fetch(driveUrl, { headers: fetchHeaders });
  } catch (e) {
    res.status(502).send('음원을 불러오지 못했습니다');
    return;
  }
  if (!driveRes.body || (!driveRes.ok && driveRes.status !== 206)) {
    res.status(502).send('음원을 불러오지 못했습니다');
    return;
  }

  const contentType = driveRes.headers.get('content-type') || '';
  res.setHeader('Content-Type', contentType.startsWith('audio/') ? contentType : 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Accept-Ranges', 'bytes');

  const contentLength = driveRes.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  const contentRange = driveRes.headers.get('content-range');
  if (contentRange) res.setHeader('Content-Range', contentRange);

  res.status(driveRes.status === 206 ? 206 : 200);

  const reader = driveRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
};
