/* D-7 재난 생존 — 지역(대한민국/북미) 현지화
 * 카드 문구 속 {토큰}을 지역·언어에 맞는 기관 이름으로, {C:43}·{L:4}·{MS:60}·{M:10}을 지역 단위로,
 * $금액을 지역 화폐로 바꾼다. 게임 안의 모든 금액은 내부적으로 달러 기준.
 */
(function (root) {
  'use strict';

  const REGIONS = {
    kr: { flag: '🇰🇷', name: '대한민국', currency: 'KRW', rate: 1300 },
    na: { flag: '🇺🇸', name: '북미 (미국·캐나다)', currency: 'USD', rate: 1 },
  };

  // [대한민국 한국어, 대한민국 영어, 북미 한국어, 북미 영어]
  const TERMS = {
    EMS: ['119', '119', '911', '911'],
    LOCAL: ['구청', 'District Office', '카운티', 'County'],
    CENTER: ['주민센터', 'Community Center', '커뮤니티 센터', 'Community Center'],
    WEATHER: ['기상청', 'Korea Meteorological Administration', '국립기상청(NWS)', 'National Weather Service'],
    HEALTH: ['질병관리청', 'KDCA', 'CDC', 'CDC'],
    GOV: ['행정안전부', 'Ministry of the Interior and Safety', 'FEMA', 'FEMA'],
    POWERCO: ['한전 협력사', 'KEPCO contractor', '전력회사 협력업체', 'Utility contractor'],
    GRID: ['전력거래소', 'Korea Power Exchange', '전력망 운영기관', 'Grid operator'],
    BRIEFING: ['중대본 브리핑', 'Disaster HQ briefing', '백악관 브리핑', 'White House briefing'],
    FOREST: ['산림청', 'Korea Forest Service', '주 산림소방국', 'State fire agency'],
    METRO: ['수도권', 'the Seoul metro area', '대도시권', 'the metro area'],
    COAST: ['한반도', 'the Korean Peninsula', '동부 해안', 'the East Coast'],
    STORM: ['태풍', 'Typhoon', '허리케인', 'Hurricane'],
    STORM_NAME: ['해오름', 'Haeoreum', '헬레나', 'Helena'],
    SHELTER: ['민방위 대피소', 'civil defense shelter', '지정 대피소', 'designated shelter'],
    CIVIL_ALERT: ['민방위 경보', 'civil defense alert', '비상경보', 'emergency alert'],
    DRILL_SIREN: ['민방위 훈련 사이렌', 'civil defense drill siren', '비상경보 시험 사이렌', 'emergency siren test'],
    VETS: ['보훈 상담센터', 'veterans counseling center', '보훈부(VA) 위기상담 전화', 'VA crisis line'],
    SHELTER_APP: ['안전디딤돌 앱 등', 'e.g. the Safety Dididimdol app', 'Ready.gov 등', 'e.g. Ready.gov'],
    SENIOR: ['경로당', 'senior centers', '시니어 센터', 'senior centers'],
    COOP: ['생협 공동구매', 'Co-op group order', '창고형 마트 대용량', 'Warehouse club bulk deal'],
  };
  const idx = (region, lang) => (region === 'na' ? 2 : 0) + (lang === 'en' ? 1 : 0);

  function fmtMoney(usd, region) {
    const r = REGIONS[region] || REGIONS.kr;
    const v = usd * r.rate;
    if (r.currency === 'KRW') {
      const won = Math.abs(v) >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100;
      return '₩' + won.toLocaleString('en-US');
    }
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  function unit(kind, v, region, lang) {
    const en = lang === 'en';
    const na = region === 'na';
    switch (kind) {
      case 'C': return na ? Math.round(v * 9 / 5 + 32) + (en ? '°F' : '℉') : v + '℃';
      case 'L': return na ? Math.max(1, Math.round(v / 3.785)) + (en ? ' gallon' : '갤런') : v + (en ? ' L' : 'L');
      case 'MS': return na ? Math.round(v * 2.237) + ' mph' : v + (en ? ' m/s' : 'm/s');
      case 'M': return na ? Math.round(v * 3.28 / 10) * 10 + (en ? ' ft' : '피트') : v + (en ? ' m' : 'm');
      default: return String(v);
    }
  }

  function localize(text, region, lang) {
    if (text == null) return '';
    const i = idx(region, lang);
    return String(text)
      .replace(/\{([A-Z_]+)\}/g, (m, k) => (TERMS[k] ? TERMS[k][i] : m))
      .replace(/\{(C|L|MS|M):(-?[\d.]+)\}/g, (m, k, v) => unit(k, parseFloat(v), region, lang))
      .replace(/\$([\d,]+)/g, (m, n) => fmtMoney(parseInt(n.replace(/,/g, ''), 10), region));
  }

  const API = { REGIONS, TERMS, fmtMoney, localize };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.D7_REGION = API;
})(typeof window !== 'undefined' ? window : globalThis);
