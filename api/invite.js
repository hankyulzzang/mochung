// 카카오톡 등 링크 미리보기(og:title/og:description/og:image)는 크롤러가 JS를
// 실행하지 않기 때문에 정적 HTML에 박힌 값만 읽습니다. 그래서 이 서버리스 함수가
// 요청이 올 때마다 구글시트를 대신 읽어서 template.html의 자리표시자를 실제 값으로
// 채운 뒤 응답합니다. 화면 안의 사진/날짜/계좌 등은 지금처럼 브라우저에서 그대로
// 시트를 읽어 렌더링합니다 (이 함수는 메타태그 세 줄만 담당).
const fs = require('fs');
const path = require('path');

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR63GD_WIHKqczR9JzJ_dlWJOq1LB-1MHuMWFZSKEPWZRNVcBwaXs3oCynZbUWBA1MGZcV0k-yrQGzI/pub?gid=0&single=true&output=csv";

// 시트 A열 키 후보 목록: 영문 키를 우선으로 보되, 지금 쓰는 한글 라벨도 그대로 인식합니다.
const SHEET_KEYS = {
  kakaoPhoto: ['kakao_thumbnail_photo', '카톡전송 썸네일'],
  kakaoText: ['kakao_thumbnail_text', '썸네일 문구'],
  venueName: ['venue_name', '결혼식장 이름'],
  venueHall: ['venue_hall', '홀 이름', '결혼식장 홀']
};

// 시트/사진이 하나도 안 불러와질 때 쓰는 값. index.html의 원래 고정값과 동일합니다.
const FALLBACK = {
  ogTitle: '희근🤍한결 결혼합니다',
  ogDescription: '신도림 라마다 2층 그랜드홀',
  ogImage: 'https://lh3.googleusercontent.com/d/1r6-Y2MxAHDYhBZmJhmtKR7PRg7AwLstD'
};

// 시트 셀 안에 줄바꿈(대표문구처럼 여러 줄인 값)이 들어있으면 CSV에서
// 따옴표로 묶인 값 내부에 실제 개행문자가 그대로 들어옵니다. 그래서 줄 단위로
// 쪼개는 방식이 아니라, 따옴표 안/밖을 구분하는 파서로 처리해야 안 깨집니다.
function parseCSV(text){
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const map = {};
  let i = 0;
  const len = text.length;
  while(i < len){
    const keyStart = i;
    while(i < len && text[i] !== ',' && text[i] !== '\n') i++;
    if(text[i] !== ','){
      while(i < len && text[i] !== '\n') i++;
      i++;
      continue;
    }
    const key = text.slice(keyStart, i).trim();
    i++; // comma

    let val = '';
    if(text[i] === '"'){
      i++;
      while(i < len){
        if(text[i] === '"'){
          if(text[i+1] === '"'){ val += '"'; i += 2; continue; }
          i++;
          break;
        }
        val += text[i];
        i++;
      }
      while(i < len && text[i] !== '\n') i++;
      i++;
    } else {
      const valStart = i;
      while(i < len && text[i] !== '\n') i++;
      val = text.slice(valStart, i);
      i++;
    }

    if(key) map[key] = val.trim();
  }
  return map;
}

function pickField(data, keyList){
  for(let i=0;i<keyList.length;i++){
    if(data[keyList[i]]) return data[keyList[i]];
  }
  return null;
}

function driveDirectUrl(url){
  if(!url) return url;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if(m) return "https://lh3.googleusercontent.com/d/" + m[1];
  return url;
}

function escapeHtml(s){
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function buildMeta(){
  const meta = Object.assign({}, FALLBACK);
  try{
    const res = await fetch(SHEET_CSV_URL);
    if(!res.ok) throw new Error('sheet fetch http ' + res.status);
    const text = await res.text();
    const data = parseCSV(text);

    const photo = pickField(data, SHEET_KEYS.kakaoPhoto);
    if(photo) meta.ogImage = driveDirectUrl(photo);

    const thumbText = pickField(data, SHEET_KEYS.kakaoText);
    if(thumbText) meta.ogTitle = thumbText;

    const venueName = pickField(data, SHEET_KEYS.venueName);
    const venueHall = pickField(data, SHEET_KEYS.venueHall);
    const venueLine = venueName ? (venueName + (venueHall ? ' ' + venueHall : '')) : null;
    if(venueLine) meta.ogDescription = venueLine;
  }catch(e){
    console.error('시트를 못 불러와서 기본 썸네일 값을 씁니다', e);
  }
  return meta;
}

module.exports = async (req, res) => {
  const meta = await buildMeta();
  const templatePath = path.join(__dirname, '..', 'template.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  html = html
    .replace('{{OG_TITLE}}', escapeHtml(meta.ogTitle))
    .replace('{{OG_DESCRIPTION}}', escapeHtml(meta.ogDescription))
    .replace('{{OG_IMAGE}}', escapeHtml(meta.ogImage));

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // 카톡 등 크롤러가 매번 시트를 새로 읽지 않도록 CDN에서 짧게만 캐시하고,
  // 캐시가 오래되면 백그라운드로 새로고침합니다(방문자는 항상 즉시 응답을 받음).
  // 썸네일 문구/사진을 시트에서 자주 수정하며 확인하는 중이라 짧게 잡아뒀습니다.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  res.status(200).send(html);
};
