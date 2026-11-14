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

  /* ---------- 북미: 우편번호 → 주(州)/주(province) ---------- */
  const PLACES = {
    AL: ['앨라배마', 'Alabama'], AK: ['알래스카', 'Alaska'], AZ: ['애리조나', 'Arizona'], AR: ['아칸소', 'Arkansas'],
    CA: ['캘리포니아', 'California'], CO: ['콜로라도', 'Colorado'], CT: ['코네티컷', 'Connecticut'], DE: ['델라웨어', 'Delaware'],
    DC: ['워싱턴 D.C.', 'Washington, D.C.'], FL: ['플로리다', 'Florida'], GA: ['조지아', 'Georgia'], HI: ['하와이', 'Hawaii'],
    ID: ['아이다호', 'Idaho'], IL: ['일리노이', 'Illinois'], IN: ['인디애나', 'Indiana'], IA: ['아이오와', 'Iowa'],
    KS: ['캔자스', 'Kansas'], KY: ['켄터키', 'Kentucky'], LA: ['루이지애나', 'Louisiana'], ME: ['메인', 'Maine'],
    MD: ['메릴랜드', 'Maryland'], MA: ['매사추세츠', 'Massachusetts'], MI: ['미시간', 'Michigan'], MN: ['미네소타', 'Minnesota'],
    MS: ['미시시피', 'Mississippi'], MO: ['미주리', 'Missouri'], MT: ['몬태나', 'Montana'], NE: ['네브래스카', 'Nebraska'],
    NV: ['네바다', 'Nevada'], NH: ['뉴햄프셔', 'New Hampshire'], NJ: ['뉴저지', 'New Jersey'], NM: ['뉴멕시코', 'New Mexico'],
    NY: ['뉴욕', 'New York'], NC: ['노스캐롤라이나', 'North Carolina'], ND: ['노스다코타', 'North Dakota'], OH: ['오하이오', 'Ohio'],
    OK: ['오클라호마', 'Oklahoma'], OR: ['오리건', 'Oregon'], PA: ['펜실베이니아', 'Pennsylvania'], RI: ['로드아일랜드', 'Rhode Island'],
    SC: ['사우스캐롤라이나', 'South Carolina'], SD: ['사우스다코타', 'South Dakota'], TN: ['테네시', 'Tennessee'], TX: ['텍사스', 'Texas'],
    UT: ['유타', 'Utah'], VT: ['버몬트', 'Vermont'], VA: ['버지니아', 'Virginia'], WA: ['워싱턴주', 'Washington'],
    WV: ['웨스트버지니아', 'West Virginia'], WI: ['위스콘신', 'Wisconsin'], WY: ['와이오밍', 'Wyoming'], PR: ['푸에르토리코', 'Puerto Rico'],
    // 캐나다
    BC: ['브리티시컬럼비아', 'British Columbia'], AB: ['앨버타', 'Alberta'], SK: ['서스캐처원', 'Saskatchewan'], MB: ['매니토바', 'Manitoba'],
    ON: ['온타리오', 'Ontario'], QC: ['퀘벡', 'Quebec'], NB: ['뉴브런즈윅', 'New Brunswick'], NS: ['노바스코샤', 'Nova Scotia'],
    PE: ['프린스에드워드아일랜드', 'Prince Edward Island'], NL: ['뉴펀들랜드 래브라도', 'Newfoundland and Labrador'],
    NT: ['노스웨스트 준주·누나부트', 'Northwest Territories / Nunavut'], YT: ['유콘', 'Yukon'],
  };
  // 미국 ZIP 앞 3자리 범위 → 주
  const ZIP3 = [
    [6, 9, 'PR'], [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'], [50, 59, 'VT'], [60, 69, 'CT'],
    [70, 89, 'NJ'], [5, 5, 'NY'], [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'], [200, 200, 'DC'], [201, 201, 'VA'],
    [202, 205, 'DC'], [206, 219, 'MD'], [220, 246, 'VA'], [247, 268, 'WV'], [270, 289, 'NC'], [290, 299, 'SC'],
    [300, 319, 'GA'], [398, 399, 'GA'], [320, 349, 'FL'], [350, 369, 'AL'], [370, 385, 'TN'], [386, 397, 'MS'],
    [400, 427, 'KY'], [430, 459, 'OH'], [460, 479, 'IN'], [480, 499, 'MI'], [500, 528, 'IA'], [530, 549, 'WI'],
    [550, 567, 'MN'], [569, 569, 'DC'], [570, 577, 'SD'], [580, 588, 'ND'], [590, 599, 'MT'], [600, 629, 'IL'],
    [630, 658, 'MO'], [660, 679, 'KS'], [680, 693, 'NE'], [700, 714, 'LA'], [716, 729, 'AR'], [733, 733, 'TX'],
    [730, 749, 'OK'], [750, 799, 'TX'], [885, 885, 'TX'], [800, 816, 'CO'], [820, 831, 'WY'], [832, 838, 'ID'],
    [840, 847, 'UT'], [850, 865, 'AZ'], [870, 884, 'NM'], [889, 898, 'NV'], [900, 961, 'CA'], [967, 968, 'HI'],
    [970, 979, 'OR'], [980, 994, 'WA'], [995, 999, 'AK'],
  ];
  const CA_POST = { A: 'NL', B: 'NS', C: 'PE', E: 'NB', G: 'QC', H: 'QC', J: 'QC', K: 'ON', L: 'ON', M: 'ON', N: 'ON',
    P: 'ON', R: 'MB', S: 'SK', T: 'AB', V: 'BC', X: 'NT', Y: 'YT' };

  /* 우편번호 → { code, country } 또는 null. 미국 5자리 ZIP, 캐나다 A1A(1A1) */
  function placeFromPostal(input) {
    const s = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
    if (/^\d{5}(-?\d{4})?$/.test(s)) {
      const z = parseInt(s.slice(0, 3), 10);
      const hit = ZIP3.find(r => z >= r[0] && z <= r[1]);
      return hit ? { code: hit[2], country: 'US', postal: s.slice(0, 5) } : null;
    }
    if (/^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(s) && CA_POST[s[0]]) return { code: CA_POST[s[0]], country: 'CA', postal: s.slice(0, 3) };
    return null;
  }
  const placeName = (place, lang) => (place && PLACES[place.code] ? PLACES[place.code][lang === 'en' ? 1 : 0] : '');

  /* 총기 구매 규정 (단순화, 2025년 기준 — 법이 자주 바뀌므로 README '확인 필요' 참고)
   * wait: 신원조회 후 대기 기간, permit: 구매 허가증 필요(발급까지 대략 며칠), none: 대기 없음, banned: 캐나다 권총 신규 구매 동결 */
  const GUN_LAWS = {
    CA: { kind: 'wait', days: 10 }, WA: { kind: 'wait', days: 14 }, IL: { kind: 'wait', days: 3 }, FL: { kind: 'wait', days: 3 },
    CO: { kind: 'wait', days: 3 }, VT: { kind: 'wait', days: 3 }, ME: { kind: 'wait', days: 3 }, NM: { kind: 'wait', days: 7 },
    RI: { kind: 'wait', days: 7 },
    HI: { kind: 'permit', days: 14 }, MN: { kind: 'permit', days: 30 }, NJ: { kind: 'permit', days: 30 }, MD: { kind: 'permit', days: 30 },
    DC: { kind: 'permit', days: 30 }, MA: { kind: 'permit', days: 60 }, CT: { kind: 'permit', days: 60 }, NY: { kind: 'permit', days: 90 },
  };
  function gunLaw(place) {
    if (!place) return { kind: 'wait', days: 10 };          // 우편번호를 건너뛰면 캘리포니아 기준
    if (place.country === 'CA') return { kind: 'banned', days: 0 };
    return GUN_LAWS[place.code] || { kind: 'none', days: 0 };
  }

  /* 그 지역에서 흔한 재난 (선택 화면의 "이 지역 주의" 표시) */
  const HAZARDS = {
    kr: ['typhoon', 'heatwave', 'quake'],
    CA: ['quake', 'wildfire', 'heatwave'], OR: ['quake', 'wildfire'], WA: ['quake', 'wildfire'], AK: ['quake', 'wildfire'],
    HI: ['typhoon', 'wildfire'], FL: ['typhoon', 'heatwave'], LA: ['typhoon', 'heatwave'], TX: ['typhoon', 'heatwave', 'blackout'],
    MS: ['typhoon', 'heatwave'], AL: ['typhoon', 'heatwave'], GA: ['typhoon', 'heatwave'], SC: ['typhoon', 'heatwave'],
    NC: ['typhoon', 'heatwave'], PR: ['typhoon', 'blackout'], AZ: ['heatwave', 'wildfire'], NV: ['heatwave', 'wildfire'],
    NM: ['heatwave', 'wildfire'], UT: ['heatwave', 'wildfire', 'quake'], CO: ['wildfire'], ID: ['wildfire'], MT: ['wildfire'],
    WY: ['wildfire'], NY: ['typhoon', 'blackout'], NJ: ['typhoon', 'blackout'], CT: ['typhoon', 'blackout'], MA: ['typhoon', 'blackout'],
    RI: ['typhoon', 'blackout'], MD: ['typhoon', 'heatwave'], VA: ['typhoon', 'heatwave'], DC: ['heatwave', 'blackout'],
    BC: ['quake', 'wildfire'], AB: ['wildfire'], SK: ['wildfire'], NS: ['typhoon'], NL: ['typhoon'],
  };
  function hazards(region, place) {
    if (region === 'kr') return HAZARDS.kr;
    return (place && HAZARDS[place.code]) || ['blackout', 'heatwave'];
  }

  const API = { REGIONS, TERMS, fmtMoney, localize, PLACES, placeFromPostal, placeName, gunLaw, hazards };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.D7_REGION = API;
})(typeof window !== 'undefined' ? window : globalThis);
