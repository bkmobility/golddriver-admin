(function () {
  'use strict';
  var CFG = window.GD_ADMIN_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  if (CFG.SUPABASE_URL.indexOf('YOUR_') >= 0) {
    document.body.innerHTML = '<div style="padding:30px;font:16px sans-serif">js/config.js 에 Supabase URL 과 anon 키를 입력해 주세요.</div>'; return;
  }
  var sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  var ST = { new: ['신규', 'y'], consult_wait: ['상담 대기', 'b'], consulting: ['상담 중', 'b'], license_check: ['면허 확인', 'o'], license_wait: ['면허 대기', 'o'], complete: ['가입 완료', 'g'], hold: ['가입 불가(보류)', 'r'], canceled: ['취소', ''] };
  var WT = { daeri: '대리', takso: '탁송', both: '대리+탁송' }, WM = { part: '부업', full: '전업' }, INS = { geon: '건당보험', month: '월보험' };
  var PAY = { none: '-', requested: '안내 요청', paid: '결제 완료' }, LIC = { none: '미제출', submitted: '제출됨', confirmed: '확인 완료' };
  var APPN = { logi: '로지', callmaner: '콜마너', aicon: '아이콘', tmap: '티맵대리', kakao: '카카오T대리', handle: '핸들포유', none: '처음입니다' };
  var CAR = { SKT: 'SK', KT: 'KT', LGU: 'U+', SKT_MVNO: 'SK알뜰폰', KT_MVNO: 'KT알뜰폰', LGU_MVNO: 'U+알뜰폰' }, OWN = { self: '본인 명의', other: '타인 명의' };
  var TABS = [['home', '오늘 할 일'], ['apps', '가입 신청'], ['drivers', '기사 가입 현황'], ['stats', '통계'], ['rates', '보험료 계산'], ['log', '처리 기록'], ['claim', '보험사 사고접수']];
  var BNAV = [['home', '오늘 할 일', '☑'], ['apps', '가입 신청', '📝'], ['drivers', '기사', '👤'], ['more', '더보기', '⋯']];
  var OWNER_EMAIL = 'bbw135@gmail.com';
  var histOn = false, curTab = 'home', fromPop = false, exitArm = false, skipPop = 0, popClosing = false, ovStack = [];
  var tab = 'home', apps = [], drivers = [], logs = [], adminName = '관리자', filter = 'all', q = '', uid = null;

  function toast(m, ms) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, ms || 3000); }
  function ymd(s) { if (!s) return '-'; var d = new Date(s); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function ymdhm(s) { var d = new Date(s); return ymd(s) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function fmtPhone(p) { p = String(p || ''); return p.length === 11 ? p.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : p.length === 10 ? p.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : p; }
  function age(b) { if (!b) return '-'; var d = new Date(b), n = new Date(), a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }
  function fno(n) { return n === 0 || n === '0' ? '0000' : n; }
  function pno(t) { var g = String(t).replace(/[^0-9]/g, ''); return g === '' ? null : parseInt(g, 10); }
  function n0(v) { return Number(v || 0).toLocaleString('ko-KR'); }
  function appsText(a) { var o = []; for (var k in (a.selected_apps || {})) o.push(APPN[k] + ' ' + a.selected_apps[k]); return o.join(', ') || '-'; }

  /* v2.9: 보증금 빠른 선택 버튼 + 번호 경고 */
  function depChips(id) { return '<div class="depch"><button type="button" class="chip dch" data-for="' + id + '" data-v="30,000">30,000</button><button type="button" class="chip dch" data-for="' + id + '" data-v="0">0</button></div>'; }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.dch'); if (!b) return; var i = document.getElementById(b.getAttribute('data-for')); if (i) { i.value = b.getAttribute('data-v'); i.dispatchEvent(new Event('input', { bubbles: true })); } });
  function phoneSus(p) {
    var t = String(p || '').replace(/[^0-9]/g, '').slice(-8); if (t.length < 8) return false;
    if (/^(\d)\1{7}$/.test(t)) return true;
    if ('01234567890123456789'.indexOf(t) >= 0 || '98765432109876543210'.indexOf(t) >= 0) return true;
    return t.slice(0, 4) === t.slice(4) || /^(\d\d)\1{3}$/.test(t);
  }
  function phoneDups(p, selfApp, selfDrv) {
    var dg = String(p || '').replace(/[^0-9]/g, ''), out = []; if (!dg) return out;
    apps.forEach(function (a) { if (a.id !== selfApp && String(a.phone || '').replace(/[^0-9]/g, '') === dg && !(selfDrv && a.driver_id === selfDrv)) out.push({ t: 'a', o: a }); });
    drivers.forEach(function (d) { if (d.id !== selfDrv && String(d.phone || '').replace(/[^0-9]/g, '') === dg && !(selfApp && d.application_id === selfApp)) out.push({ t: 'd', o: d }); });
    return out;
  }
  function phBadge(p, selfApp, selfDrv) {
    var h = '', du = phoneDups(p, selfApp, selfDrv);
    if (phoneSus(p)) h += ' <span class="pwb y" title="연속·반복 숫자 번호예요">⚠ 의심 번호</span>';
    if (du.length) h += ' <span class="pwb r" title="' + esc(du.map(function (x) { return x.t === 'a' ? (x.o.name + ' · 신청 ' + (x.o.receipt_no || '')) : (x.o.name + ' · 기사 ' + fno(x.o.emp_no)); }).join(' / ')) + '">⚠ 중복 ' + du.length + '건</span>';
    return h;
  }
  function phWarnBox(p, selfApp, selfDrv) {
    var du = phoneDups(p, selfApp, selfDrv), h = '';
    if (phoneSus(p)) h += '<div class="pwbox y">⚠ 연속·반복 숫자 번호예요. 실제 연락되는 번호인지 전화로 확인해 보세요.</div>';
    if (du.length) h += '<div class="pwbox r">⚠ 같은 번호가 ' + du.length + '건 더 있어요 (참고용)<br>' + du.map(function (x) { return x.t === 'a' ? '· <a href="#" class="pwgo" data-a="' + x.o.id + '">' + esc(x.o.name) + ' · 신청 ' + esc(x.o.receipt_no || '') + ' (' + ((ST[x.o.status] || [x.o.status])[0]) + ')</a>' : '· ' + esc(x.o.name) + ' · 기사 ' + fno(x.o.emp_no) + ' (' + esc(x.o.status || '가입') + ')'; }).join('<br>') + '</div>';
    return h;
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.pwgo'); if (!b) return; e.preventDefault(); openDrawer(b.getAttribute('data-a')); });
  function stTag(s) { var x = ST[s] || [s, '']; return '<span class="tag ' + x[1] + '">' + x[0] + '</span>'; }
  function tel(p) { return 'tel:' + p; }
  function sms(p, body) { return 'sms:' + p + '?body=' + encodeURIComponent(body || ''); }

  /* ---------- 로그인 ---------- */
  $('#lform').addEventListener('submit', function (e) {
    e.preventDefault(); $('#lerr').textContent = '';
    sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value }).then(function (r) {
      if (r.error) { $('#lerr').textContent = '이메일 또는 비밀번호를 확인해 주세요.'; return; }
      boot();
    });
  });
  $('#logout').addEventListener('click', function () { sb.auth.signOut().then(function () { location.reload(); }); });

  function boot() {
    sb.auth.getSession().then(function (r) {
      var s = r.data.session;
      if (!s) { $('#login').hidden = false; $('#main').hidden = true; return; }
      uid = s.user.id;
      sb.from('golddriver_admins').select('name').eq('user_id', uid).maybeSingle().then(function (a) {
        if (!a.data) {
          sb.auth.signOut(); $('#login').hidden = false; $('#main').hidden = true;
          $('#lerr').textContent = '관리자 권한이 없는 계정입니다.'; return;
        }
        adminName = (s.user.email || '').toLowerCase() === OWNER_EMAIL ? '관리자' : (s.user.email || a.data.name); $('#who').textContent = adminName;
        $('#login').hidden = true; $('#main').hidden = false;
        loadAll().then(function () { initHist(); render(); subscribe(); });
      });
    });
  }

  function loadAll() {
    return Promise.all([
      sb.from('golddriver_applications').select('*').order('created_at', { ascending: false }).limit(2000),
      sb.from('golddriver_drivers').select('*').order('emp_no', { ascending: true }).limit(5000),
      sb.from('golddriver_activity_log').select('*').order('created_at', { ascending: false }).limit(200)
    ]).then(function (r) {
      if (r[0].error) toast('불러오지 못했어요: ' + r[0].error.message);
      apps = r[0].data || []; drivers = r[1].data || []; logs = r[2].data || [];
    });
  }
  function subscribe() {
    sb.channel('gd-apps').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'golddriver_applications' }, function (p) {
      toast('🔔 새 가입 신청: ' + (p.new.name || '') + ' (' + (p.new.signup_type === 'consult' ? '상담 신청' : '바로 가입') + ')', 7000);
      document.title = '(새 신청) 골드대리운전 관리자';
      loadAll().then(render);
    }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'golddriver_applications' }, function () { loadAll().then(render); }).subscribe();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) document.title = '골드대리운전 관리자'; });
  }
  function logAct(text, appId) {
    return sb.from('golddriver_activity_log').insert({ admin_name: adminName, action: text, application_id: appId || null });
  }

  /* ---------- 공통 렌더 ---------- */
  function openApps() { return apps.filter(function (a) { return a.status !== 'complete' && a.status !== 'canceled' && a.status !== 'hold'; }); }
  function render() {
    var badge = apps.filter(function (a) { return a.status === 'new'; }).length;
    if (histOn && tab !== curTab) { if (!fromPop) history.pushState({ gd: 'tab', tab: tab }, ''); curTab = tab; } fromPop = false;
    $('#tabs').innerHTML = TABS.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + (t[0] === 'apps' && badge ? '<span class="dot">' + badge + '</span>' : '') + '</button>'; }).join('');
    $$('#tabs button').forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-t'); render(); }); });
    var v = $('#view'), bn = $('#bnav'), mm = isM();
    bn.innerHTML = BNAV.map(function (t) { var on = tab === t[0] || (t[0] === 'more' && (tab === 'stats' || tab === 'rates' || tab === 'log' || tab === 'claim')); return '<button data-b="' + t[0] + '" class="' + (on ? 'on' : '') + '"><i>' + t[2] + '</i>' + t[1] + (t[0] === 'apps' && badge ? '<span class="dot">' + badge + '</span>' : '') + '</button>'; }).join('');
    $$('#bnav button').forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-b'); window.scrollTo(0, 0); render(); }); });
    $('#main').classList.toggle('mfull', mm && (tab === 'drivers' || tab === 'stats' || tab === 'more')); $('#main').classList.toggle('wide', tab === 'drivers'); $('#main').classList.toggle('dfix', !mm && (tab === 'drivers' || tab === 'stats'));
    if (tab === 'more' && !mm) tab = 'home';
    ({ home: viewHome, apps: viewApps, drivers: mm ? viewDriversM : viewDrivers, stats: viewStats, rates: viewRates, more: viewMore, pay: viewPay, log: viewLog, claim: viewClaim })[tab](v);
  }

  /* ---------- v3.1 보험료 계산 ---------- */
  var RATE_KEY = 'rates';
  var RATE_DEF = {
    rentAdd: 400,
    msgM: '실제 보험료는 나이와 사고, 경력 등에 따라 달라질 수 있습니다. 정확한 금액은 사무실에 문의 바랍니다.',
    msgG: '실제 보험료는 나이와 사고, 경력 등에 따라 달라질 수 있습니다. 정확한 금액은 각 보험사에 문의 바랍니다.',
    msgNone: '현재 가입 가능한 보험 상품이 없습니다',
    monthly: [
      { from: 26, to: 29, kb: false, dDaily: 4700, dAuto: false, dLo: 78000, dHi: 89000, dSuf: ' 전후', tDaily: 6700, tAuto: false, tLo: 138000, tHi: 153000, tSuf: ' 전후', tTxt: '' },
      { from: 30, to: 50, kb: true, dDaily: 3700, dAuto: true, dSuf: ' (3,500원 가능)', tDaily: 5500, tAuto: true, tSuf: ' 전후', tTxt: '' },
      { from: 51, to: 56, kb: true, dDaily: 4500, dAuto: true, dSuf: ' 전후', tDaily: 7500, tAuto: true, tSuf: ' 전후', tTxt: '' },
      { from: 57, to: 66, kb: true, dDaily: 5100, dAuto: true, dSuf: ' 전후', tDaily: 9000, tAuto: true, tSuf: ' 전후', tTxt: '' },
      { from: 67, to: null, kb: true, dDaily: 5500, dAuto: false, dLo: null, dHi: null, dSuf: ' 전후', tDaily: 0, tAuto: false, tLo: null, tHi: null, tSuf: '', tTxt: '보험 진행 후 확인 가능 (약 10,000원 전후)' }
    ],
    logi: {
      dae: [['만 40세 이하', 821, 1026, 913, 1136], ['만 49세 이하', 821, 985, 876, 1095], ['만 58세 이하', 1083, 1321, 1175, 1431], ['만 59세 이상', 1627, 1871, 1665, 1981]],
      tak: [['만 40세 이하', 4218, 4259, 3788], ['만 49세 이하', 3278, 3393, 3016], ['만 58세 이하', 4560, 4606, 4095], ['만 59세 이상', 5019, 5170, 4596]]
    },
    col: [
      { name: 'KB 건당대리', title: 'KB 손해보험(대리보험) 안내', head: '완료 오더당 나이별 금액', dual: false, rows: [['28세 이하', 1849], ['29세 ~ 40세', 1150], ['41세 ~ 49세', 1369], ['50세 ~ 58세', 1463], ['59세 이상', 1991]],
        text: '* 사고 건수에 따라 보험료가 할증될 수 있습니다.\n2. 할증 보험료 문의처: 1877-3006\n3. 보험가입 신청 후 평일 최대 2일 소요\n- 심사결과 수신 후 24:00 보험적용\n- 토, 일요일 신청불가\n4. 사고 콜센터: 1544-0114\n5. 심사 거절 상담: 1877-3006\n6. 개인정보 제공지사\n- 상호: KB손해보험\n- 주소: 서울 강남구 테헤란로 117, KB손해보험빌딩' },
      { name: 'KB 건당대리 (렌터카 특약 포함)', title: 'KB 손해보험(대리보험-렌터카특약 포함) 안내', head: '완료 오더당 나이별 금액', dual: false, rows: [['28세 이하', 1959], ['29세 ~ 40세', 1260], ['41세 ~ 49세', 1479], ['50세 ~ 58세', 1573], ['59세 이상', 2101]],
        text: '* 사고 건수에 따라 보험료가 할증될 수 있습니다.\n2. 보장 범위\n- 지급 조건: 차량손해확장 특약으로 보험금이 지급되는 사고 발생 시에만 적용\n- 렌터카 대차 시: 동급 렌터카 요금 × 인정기간 지급\n- 렌터카 미대차 시: 동급 렌트비용의 30% 상당액 지급\n- 인정기간\n  · 수리 가능한 경우: 실 수리 기간 동안 인정. 단, 최대 30일까지 인정(외국산 자동차의 부품 조달 기간 및 합의 지연, 부당한 수리지연에 따른 연장 기간은 인정하지 않음)\n  · 수리가 불가능한 경우: 최대 10일까지 인정\n  · 도난의 경우: 경찰서 신고일로부터 30일까지 인정\n3. 대상 차량 (동급 렌터카 기준)\n- 대한민국에서 생산된 자동차\n- 피보험자동차와 연식·배기량 유사 차량\n- 여객자동차운수사업법 제29조 등록 렌터카 사업자 차량\n4. 할증 보험료 문의처: 1877-3006\n5. 보험가입 신청 후 평일 최대 2일 소요\n- 심사결과 수신 후 24:00 보험적용\n- 토, 일요일 신청불가\n6. 사고 콜센터: 1544-0114\n7. 심사 거절 상담: 1877-3006\n8. 개인정보 제공지사\n- 상호: KB손해보험\n- 주소: 서울 강남구 테헤란로 117, KB손해보험빌딩\n개인정보 제공 항목: 성명, 주민등록번호, 휴대폰번호' },
      { name: '메리츠 건당대리', title: '메리츠 손해보험(대리보험) 안내', head: '완료 오더당 나이별 금액', dual: true, rows: [['26세 ~ 29세', 1420, '26세 ~ 29세', 1300], ['30세 ~ 39세', 1160, '30세 ~ 39세', 880], ['40세 ~ 49세', 1000, '40세 ~ 49세', 960], ['50세 ~ 59세', 1480, '50세 ~ 59세', 1100], ['60세 ~ 63세', 1980, '60세 ~ 63세', 1740]],
        text: '*사고 건수에 따라 보험료가 할증될 수 있습니다.\n2. 할증 보험료 문의처: 1877-3006\n3. 보험가입 신청 후 평일 최대 2일 소요\n- 심사결과 수신 후 24:00 보험적용\n- 토, 일요일 신청불가\n4. 사고 콜센터: 1566-7711\n5. 심사 거절 상담: 1877-3006\n6. 개인정보 제공지사\n- 상호: 메리츠화재 해상 주식회사\n- 주소: 서울 강남구 강남대로382(역삼동) 메리츠타워\n개인정보 제공 항목: 성명, 주민등록번호, 휴대전화번호' },
      { name: 'KB 건당탁송', title: 'KB 손해보험(탁송보험) 안내', head: '탁송콜당 보험료', dual: false, rows: [['28세 이하', 5251], ['29세 ~ 40세', 4953], ['41세 ~ 49세', 4205], ['50세 ~ 58세', 5692], ['59세 이상', 7077]],
        text: '* 사고 건수에 따라 보험료가 할증될 수 있습니다.\n2. 차량운행 전 사진 촬영 필수\n- 차량운행 "운행 전", "완료 전" 사진을 찍어 전송해야 보상이 이루어집니다.\n3. 운행 가능 차량\n- 1종대형: 모든 승용차 / 1.4톤 이하 화물차 / 승차정원 16인승 이하\n- 1종보통: 모든 승용차 / 1.4톤 이하 화물차 / 승차정원 16인승 이하\n- 1종특수 & 2종보통 : 모든 승용차 / 1.4톤 이하 화물차 / 승차정원 10인승 이하\n※ 노란색 번호판이 부착된 영업용 차량 운행 불가\n4. 보장 범위\n- 담보 범위: 탁송 운전 중 발생한 사고 담보 (발렛 제외)\n- 보상 범위\n  · 대인배상책임: 무한 (고객 자동차 보험 대인1 초과 손해 보장)\n  · 대물배상책임 : 2억원 (고객의 자동차 이외 대물 손해 보장)\n  · 자기신체사고 : 5천만원 (대리운전 기사 상해, 후유장해 보장)\n  · 자차손해보장 : 8천만원 (고객 차량 손해 보장)\n  · Umbrella 보장 : 고객 자동차 자차 외 손해 보장\n5. 공제금액\n- 자차손해보장: 50만원\n- 고객 자동차 자차 외 손해: 50만원 (Umbrella)\n6. 면책 사항\n- 무면허, 음주운전\n- 경기용 차량\n- 여객운송, 화물운송 등\n- 가족 소유 차량\n- 수탁 차량 도난 손해\n7. 보험가입 신청 최대 평일 2일 소요\n- 심사결과 수신 후 24:00 보험적용\n- 토, 일요일 신청불가\n8. 사고 접수 및 상담\n- 사고 콜센터: 1544-0114\n- 보험 심사 거절 상담: 1877-3006\n9. 개인정보 제공 지사\n- 상호: KB손해보험\n- 주소: 서울 강남구 테헤란로 117, KB손해보험빌딩\n개인정보 제공 항목: 성명, 주민등록번호, 휴대폰번호' },
      { name: '메리츠 건당탁송', title: '메리츠 손해보험(탁송보험) 안내', head: '탁송콜당 보험료', dual: true, rows: [['26세 ~ 31세', 8400, '26세 ~ 31세', 5470], ['32세 ~ 39세', 6130, '32세 ~ 39세', 4000], ['40세 ~ 49세', 5890, '40세 ~ 49세', 4230], ['50세 ~ 59세', 5810, '50세 ~ 59세', 5970]],
        text: '2. 차량운행 전 사진 촬영 필수\n- 차량운행 "운행 전", "완료 전" 사진을 찍어 전송해야 보상이 이루어집니다.\n3. 운행 가능 차량\n- 1종대형: 모든 승용차 / 1.4톤 이하 화물차 / 승차정원 16인승 이하\n- 1종보통: 모든 승용차 / 1.4톤 이하 화물차 / 승차정원 16인승 이하\n- 1종특수 & 2종보통 : 모든 승용차 / 1.4톤 이하 화물차 / 승차정원 10인승 이하\n※ 노란색 번호판이 부착된 영업용 차량 운행 불가\n4. 보장 범위\n- 담보 범위: 탁송 운전 중 발생한 사고 담보 (발렛 제외)\n- 보상 범위\n  · 대인배상책임: 무한 (고객 자동차 보험 대인1 초과 손해 보장)\n  · 대물배상책임 : 2억원 (고객의 자동차 이외 대물 손해 보장)\n  · 자기신체사고 : 5천만원 (대리운전 기사 상해, 후유장해 보장)\n  · 자차손해보장 : 8천만원 (고객 차량 손해 보장)\n  · Umbrella 보장 : 고객 자동차 자차 외 손해 보장\n5. 공제금액\n- 자차손해보장: 50만원\n- 고객 자동차 자차 외 손해: 50만원 (Umbrella)\n6. 면책 사항\n- 무면허, 음주운전\n- 경기용 차량\n- 여객운송, 화물운송 등\n- 가족 소유 차량\n- 수탁 차량 도난 손해\n7. 사고 접수 및 상담\n- 사고 콜센터: 1566-4982\n- 보험 심사 거절 상담: 070-7841-5963\n- 문자 상담: 010-4819-0574\n8. 개인정보 제공 지사\n- 메리츠화재해상 주식회사\n- 서울 강남구 강남대로 382 (역삼동) 메리츠타워\n- 1566-7711\n개인정보 제공 항목: 성명, 주민등록번호, 휴대폰번호' }
    ]
  };
  var RATES = null, rs = { kind: '', by: '', bm: '', prog: '', sub: 0, edit: false, ed: null };
  function cp(o) { return JSON.parse(JSON.stringify(o)); }
  function loadRates() {
    if (RATES) return Promise.resolve(RATES);
    return sb.from('golddriver_settings').select('value').eq('key', RATE_KEY).maybeSingle().then(function (r) {
      var v = r && r.data && r.data.value, o = cp(RATE_DEF);
      if (v && typeof v === 'object') { for (var k in v) o[k] = v[k]; }
      RATES = o; return o;
    }, function () { RATES = cp(RATE_DEF); return RATES; });
  }
  function ageOf(y, m) { var t = new Date(), a = t.getFullYear() - y; if (t.getMonth() + 1 < m) a--; return a; }
  var DDI = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  function ddi(y) { return y + '년생 ' + DDI[(y - 4) % 12] + '띠'; }
  function won(x) { return n0(x) + '원'; }
  function rangeTxt(lo, hi) { return lo && hi && lo !== hi ? n0(lo) + ' ~ ' + n0(hi) : lo ? n0(lo) : ''; }
  function mBracket(R, age) { var i; for (i = 0; i < R.monthly.length; i++) { var b = R.monthly[i]; if (age >= b.from && (b.to == null || age <= b.to)) return b; } return null; }
  function bTitle(b) { return b.kb === false ? '만 ' + b.to + '세 이하는 KB 가입 불가' : b.to == null ? '만 ' + b.from + '세 이상 ~' : '만 ' + b.from + '세 이상 ~ 만 ' + b.to + '세 이하'; }
  function bYears(b) { var y = new Date().getFullYear(); return b.to == null ? '(' + ddi(y - b.from) + ' ~ )' : '(' + ddi(y - b.from) + ' ~ ' + ddi(y - b.to) + ')'; }
  function bCalc(b, R, rent) {
    var add = rent ? num(R.rentAdd) : 0, o = {};
    ['d', 't'].forEach(function (p) {
      var daily = num(b[p + 'Daily']), lo, hi;
      if (b[p + 'Auto']) { lo = hi = daily * 30; } else { lo = b[p + 'Lo'] || 0; hi = b[p + 'Hi'] || 0; }
      var show = !(p === 't' && b.tTxt);
      o[p] = { daily: daily ? daily + add : 0, lo: lo ? lo + add * 30 : 0, hi: hi ? hi + add * 30 : 0, show: show };
    });
    return o;
  }
  function mLines(b, R) {
    var d = bCalc(b, R, false), r = bCalc(b, R, true), L = [];
    if (b.kb === false) L.push('<b>DB손보(동부) 가입, 다율 개인보험 (만 ' + b.from + '세 ~ 만 ' + b.to + '세까지)</b>');
    var dm = rangeTxt(d.d.lo, d.d.hi), tm = rangeTxt(d.t.lo, d.t.hi);
    if (b.kb === false) { L.push('대리 보험료 ' + dm + ' / 일비 ' + won(d.d.daily) + esc(b.dSuf || '')); L.push('탁송 보험료 ' + tm + ' / 일비 ' + won(d.t.daily) + esc(b.tSuf || '')); }
    else { L.push('대리는 ' + won(d.d.daily) + esc(b.dSuf || '') + (dm ? ' / ' + dm + '원' : '')); L.push(b.tTxt ? '탁송은 ' + esc(b.tTxt) : '탁송은 ' + won(d.t.daily) + esc(b.tSuf || '') + (tm ? ' / ' + tm + '원' : '')); }
    return L;
  }
  function mCard(t, b, R, rent, kind) {
    var c = bCalc(b, R, rent)[kind], sfx = kind === 'd' ? b.dSuf : b.tSuf, m = rangeTxt(c.lo, c.hi); if (rent && sfx && sfx.indexOf('(') >= 0) sfx = '';
    var body = kind === 't' && b.tTxt ? esc(b.tTxt) + (rent ? '<br><span class="mut">렌터카 포함도 확인 후 안내</span>' : '') : '일비 ' + won(c.daily) + esc(sfx || '') + (m ? '<br><b class="rt">월 ' + m + '원</b>' : '');
    return '<div class="mini"><b>' + t + (rent ? ' <span class="pl">렌터카 포함</span>' : '') + '</b>' + body + '</div>';
  }
  function ptext(t) { return esc(t).split('\n').map(function (l) { return /^\d+\.\s/.test(l) ? '<div class="pt h">' + l + '</div>' : '<div class="pt">' + l.replace(/^ {2}/, '&nbsp;&nbsp;&nbsp;') + '</div>'; }).join(''); }
  function halfTbl(rows, P) {
    function side(cls, name, i) {
      var t = '<table>';
      rows.forEach(function (r, j) { var Q = P ? P + 'rows.' + j + '.' : ''; t += '<tr><td>' + (P ? rTx(Q + i, r[i], 110) : esc(r[i])) + '</td><td>' + (P ? rEd(Q + (i + 1), r[i + 1], 78) + ' 원' : won(r[i + 1])) + '</td></tr>'; });
      return '<div class="hb ' + cls + '"><div class="hh">' + name + '</div><div class="eh"><span>연령</span><span>금액' + (P ? ' (원)' : '') + '</span></div>' + t + '</table></div>';
    }
    return '<div class="half">' + side('a', '수도권', 0) + side('b', '지방권', 2) + '</div>';
  }
  function colCard(p) {
    var h = '<div class="cd"><h4>' + esc(p.title) + '</h4><div class="info" style="margin:0 0 6px">1. ' + esc(p.head) + '</div>';
    if (p.dual) h += halfTbl(p.rows, null);
    else { h += '<table class="sm"><tr><th>수도권/지방권</th><th></th></tr>'; p.rows.forEach(function (r) { h += '<tr><td>' + esc(r[0]) + '</td><td>' + won(r[1]) + '</td></tr>'; }); h += '</table>'; }
    return h + '<div class="ptx">' + ptext(p.text) + '</div></div>';
  }
  function logiCard(title, rows, withRent) {
    var h = '<div class="cd"><h4>' + title + '</h4><table class="sm"><tr><th>연령</th><th>기존</th><th>변경</th><th>무사고 경력자 최저</th>' + (withRent ? '<th>렌터카 특약 포함</th>' : '') + '</tr>';
    rows.forEach(function (r) { h += '<tr><td><b>' + esc(r[0]) + '</b></td><td><span class="old">' + n0(r[1]) + '</span></td><td>' + n0(r[2]) + '<span class="up">인상</span></td><td class="g">' + n0(r[3]) + '</td>' + (withRent ? '<td class="rt">' + n0(r[4]) + '</td>' : '') + '</tr>'; });
    return h + '</table></div>';
  }
  function rEd(path, val, w) { return '<input class="ri" data-p="' + path + '" value="' + (val == null ? '' : n0(val)) + '" inputmode="numeric" style="width:' + (w || 84) + 'px">'; }
  function rTx(path, val, w) { return '<input class="rt2" data-p="' + path + '" data-s="1" value="' + esc(val == null ? '' : val) + '" style="width:' + (w || 120) + 'px">'; }
  function rYear(y) { var o = '<option value="">년도 선택</option>', t = new Date().getFullYear(), i; for (i = t - 15; i >= t - 90; i--) o += '<option value="' + i + '"' + (String(y) === String(i) ? ' selected' : '') + '>' + i + '년</option>'; return o; }
  function rMon(m) { var o = '<option value="">월</option>', i; for (i = 1; i <= 12; i++) o += '<option value="' + i + '"' + (String(m) === String(i) ? ' selected' : '') + '>' + i + '월</option>'; return o; }
  function rView(R) {
    var h = '<div class="lbl">보험 종류</div><div class="seg"><span data-k="m" class="' + (rs.kind === 'm' ? 'on' : '') + '">월보험</span><span data-k="g" class="' + (rs.kind === 'g' ? 'on' : '') + '">건당보험</span></div>';
    if (rs.kind === 'm') {
      h += '<div class="lbl">생년월 선택</div><div class="rsel"><select id="r-by">' + rYear(rs.by) + '</select><select id="r-bm">' + rMon(rs.bm) + '</select>';
      if (rs.by && rs.bm) { var age = ageOf(+rs.by, +rs.bm); h += '<span class="age">만 ' + age + '세</span>'; }
      h += '</div>';
      if (rs.by && rs.bm) {
        var b = age >= 0 ? mBracket(R, age) : null;
        if (!b) h += '<div class="emp">' + esc(R.msgNone) + '</div>';
        else {
          h += '<div class="g4"><div class="bx hl"><span class="k"><u>' + bTitle(b) + '</u></span><br>&nbsp;&nbsp;' + bYears(b) + mLines(b, R).map(function (l) { return '<br>- ' + l; }).join('') + '</div><div class="g4">' + mCard('월보험 대리', b, R, false, 'd') + mCard('월보험 대리', b, R, true, 'd') + mCard('월보험 탁송', b, R, false, 't') + mCard('월보험 탁송', b, R, true, 't') + '</div></div>';
          h += '<div class="wn">※ ' + esc(R.msgM) + '</div><div><button class="btn line" id="r-all">' + (rs.all ? '▴ 전체 연령 구간 접기' : '▾ 전체 연령 구간 보기') + '</button></div>';
          if (rs.all) h += rAll(R);
        }
      } else h += '<div class="emp">생년월을 선택하면 만 나이와 월보험 안내가 표시돼요</div>';
    } else if (rs.kind === 'g') {
      h += '<div class="lbl">프로그램 선택</div>' + [['logi', '로지'], ['col', '콜마너'], ['icon', '아이콘']].map(function (x) { return '<span class="chip' + (rs.prog === x[0] ? ' on' : '') + '" data-pg="' + x[0] + '">' + x[1] + '</span>'; }).join('');
      if (rs.prog) {
        h += '<div class="wn" style="margin-top:12px">※ ' + esc(R.msgG) + '</div>';
        if (rs.prog === 'logi') { h += '<div class="info" style="margin:6px 0">연령별 보험료 변경 내역 (단위: 원)</div><div class="g2">' + logiCard('● 건당대리', R.logi.dae, true) + logiCard('● 건당탁송', R.logi.tak, false) + '</div>'; }
        else { h += '<div class="lbl">보험사 · 종류</div>' + R.col.map(function (p, i) { return '<span class="chip' + (rs.sub === i ? ' on' : '') + '" data-sb="' + i + '">' + esc(p.name) + '</span>'; }).join('') + colCard(R.col[rs.sub] || R.col[0]); }
      } else h += '<div class="emp" style="margin-top:12px">프로그램을 선택해 주세요</div>';
    } else h += '<div class="emp" style="margin-top:12px">보험 종류를 선택해 주세요</div>';
    return h;
  }
  function rAll(R) {
    return '<div class="g2" style="margin-top:12px">' + R.monthly.map(function (b, i) {
      var d = bCalc(b, R, false), r = bCalc(b, R, true), L = mLines(b, R), rl = [];
      if (b.kb === false) { rl.push('렌터카 포함 일비 ' + won(r.d.daily) + ' / 탁송 ' + won(r.t.daily)); }
      else { rl.push('대리 렌터카 포함 ' + won(r.d.daily) + (rangeTxt(r.d.lo, r.d.hi) ? ' / ' + rangeTxt(r.d.lo, r.d.hi) + '원' : '')); rl.push(b.tTxt ? '탁송 렌터카 포함은 확인 후 안내' : '탁송 렌터카 포함 ' + won(r.t.daily) + (rangeTxt(r.t.lo, r.t.hi) ? ' / ' + rangeTxt(r.t.lo, r.t.hi) + '원' : '')); }
      return '<div class="bx"><span class="k"><u>' + (i + 1) + ') ' + bTitle(b) + '</u></span><br>&nbsp;&nbsp;' + bYears(b) + L.map(function (l) { return '<br>- ' + l; }).join('') + rl.map(function (l) { return '<br><span class="rt">· ' + l + '</span>'; }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function rEdit(R) {
    var h = '<div class="seg"><span data-k="m" class="' + (rs.kind === 'm' ? 'on' : '') + '">월보험</span><span data-k="g" class="' + (rs.kind === 'g' ? 'on' : '') + '">건당보험</span><span data-k="t" class="' + (rs.kind === 't' ? 'on' : '') + '">안내 문구</span></div>';
    if (rs.kind === 'm') {
      h += '<div style="margin:12px 0">렌터카 포함 가산액 (일비 기준) ' + rEd('rentAdd', R.rentAdd, 70) + ' 원 <span class="mut">→ 월 금액은 가산액 × 30 (400원이면 월 +12,000원)</span></div><div class="tw"><table class="sm"><tr><th>나이(만) 부터~까지</th><th>대리 일비</th><th>대리 비고</th><th>대리 월 금액</th><th>대리 렌터카 일비</th><th>대리 렌터카 월</th><th>탁송 일비</th><th>탁송 월 금액</th><th>탁송 렌터카 일비</th><th>탁송 렌터카 월</th></tr>';
      R.monthly.forEach(function (b, i) {
        var d = bCalc(b, R, false), r = bCalc(b, R, true), P = 'monthly.' + i + '.';
        var dm = b.dAuto ? '<span class="ea">' + n0(d.d.lo) + '</span>' : rEd(P + 'dLo', b.dLo, 76) + '~' + rEd(P + 'dHi', b.dHi, 76);
        var tm = b.tTxt ? rTx(P + 'tTxt', b.tTxt, 150) : b.tAuto ? '<span class="ea">' + n0(d.t.lo) + '</span>' : rEd(P + 'tLo', b.tLo, 76) + '~' + rEd(P + 'tHi', b.tHi, 76);
        h += '<tr><td>' + rEd(P + 'from', b.from, 40) + '~' + (b.to == null ? '<span class="mut">이상</span>' : rEd(P + 'to', b.to, 40)) + '</td><td>' + rEd(P + 'dDaily', b.dDaily, 70) + '</td><td>' + rTx(P + 'dSuf', b.dSuf, 110) + '</td><td>' + dm + '</td><td><span class="ea">' + n0(r.d.daily) + '</span></td><td><span class="ea">' + rangeTxt(r.d.lo, r.d.hi) + '</span></td><td>' + (b.tTxt ? '<span class="mut">-</span>' : rEd(P + 'tDaily', b.tDaily, 70)) + '</td><td>' + tm + '</td><td><span class="ea">' + (b.tTxt ? '-' : n0(r.t.daily)) + '</span></td><td><span class="ea">' + (b.tTxt ? '-' : rangeTxt(r.t.lo, r.t.hi)) + '</span></td></tr>';
      });
      h += '</table></div><div class="info">※ 파란 칸만 입력하세요. 회색(자동) 칸은 저절로 계산돼요. 일비를 바꾸면 월 금액(일비×30)과 렌터카 포함 금액이 같이 바뀌어요. 만 29세 이하처럼 월 금액이 범위인 구간은 월 금액을 직접 입력하세요. 띠·출생연도 문구는 오늘 날짜로 자동 계산돼요.</div>';
    } else if (rs.kind === 'g') {
      h += '<div class="lbl">프로그램 선택</div>' + [['logi', '로지'], ['col', '콜마너'], ['icon', '아이콘']].map(function (x) { return '<span class="chip' + (rs.prog === x[0] ? ' on' : '') + '" data-pg="' + x[0] + '">' + x[1] + '</span>'; }).join('');
      if (rs.prog === 'logi') {
        h += '<div class="g2" style="margin-top:10px"><div class="cd"><h4>● 건당대리</h4><div class="tw"><table class="sm"><tr><th>연령</th><th>기존</th><th>변경</th><th>무사고 최저</th><th>렌터카 포함</th></tr>' + R.logi.dae.map(function (r, i) { var P = 'logi.dae.' + i + '.'; return '<tr><td>' + rTx(P + '0', r[0], 100) + '</td><td>' + rEd(P + '1', r[1], 64) + '</td><td>' + rEd(P + '2', r[2], 64) + '</td><td>' + rEd(P + '3', r[3], 64) + '</td><td>' + rEd(P + '4', r[4], 64) + '</td></tr>'; }).join('') + '</table></div></div><div class="cd"><h4>● 건당탁송</h4><div class="tw"><table class="sm"><tr><th>연령</th><th>기존</th><th>변경</th><th>무사고 최저</th></tr>' + R.logi.tak.map(function (r, i) { var P = 'logi.tak.' + i + '.'; return '<tr><td>' + rTx(P + '0', r[0], 100) + '</td><td>' + rEd(P + '1', r[1], 64) + '</td><td>' + rEd(P + '2', r[2], 64) + '</td><td>' + rEd(P + '3', r[3], 64) + '</td></tr>'; }).join('') + '</table></div></div></div>';
      } else if (rs.prog) {
        h += '<div class="info" style="margin:8px 0">' + (rs.prog === 'icon' ? '아이콘은 콜마너와 같은 금액·문구를 사용해요. 아래에서 수정하면 콜마너·아이콘 모두 바뀌어요.' : '') + '</div><div class="lbl">보험사 · 종류</div>' + R.col.map(function (p, i) { return '<span class="chip' + (rs.sub === i ? ' on' : '') + '" data-sb="' + i + '">' + esc(p.name) + '</span>'; }).join('');
        var p = R.col[rs.sub] || R.col[0], i2 = R.col.indexOf(p), P = 'col.' + i2 + '.';
        h += '<div class="cd"><h4>' + rTx(P + 'title', p.title, 360) + '</h4><div class="info">표 제목 ' + rTx(P + 'head', p.head, 200) + '</div>' + (p.dual ? halfTbl(p.rows, P) : '<div class="tw"><table class="sm"><tr><th>수도권/지방권</th><th>금액</th></tr>' + p.rows.map(function (r, j) { var Q = P + 'rows.' + j + '.'; return '<tr><td>' + rTx(Q + '0', r[0], 110) + '</td><td>' + rEd(Q + '1', r[1], 78) + ' 원</td></tr>'; }).join('') + '</table></div>') + '<div class="lbl">하단 안내 문구 (줄바꿈 그대로 표시)</div><textarea class="rta" data-p="' + P + 'text" data-s="1" rows="12">' + esc(p.text) + '</textarea></div>';
      } else h += '<div class="emp" style="margin-top:12px">수정할 프로그램을 선택해 주세요</div>';
    } else {
      h += '<div class="lbl">월보험 안내 문구 (맨 위)</div><textarea class="rta" data-p="msgM" data-s="1" rows="2">' + esc(R.msgM) + '</textarea><div class="lbl">건당보험 안내 문구 (로지 · 콜마너 · 아이콘 공통)</div><textarea class="rta" data-p="msgG" data-s="1" rows="2">' + esc(R.msgG) + '</textarea><div class="lbl">만 26세 미만 등 해당 구간이 없을 때 문구</div><textarea class="rta" data-p="msgNone" data-s="1" rows="2">' + esc(R.msgNone) + '</textarea>';
    }
    return h;
  }
  function rSet(o, path, val) { var k = path.split('.'), i; for (i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = val; }
  function rDiff(a, b) { var n = 0, k; if (a && typeof a === 'object') { for (k in a) n += rDiff(a[k], b ? b[k] : undefined); return n; } return a !== b ? 1 : 0; }
  function viewRates(v) {
    loadRates().then(function (R0) {
      var R = rs.edit ? rs.ed : R0;
      v.innerHTML = '<div class="rhead"><h2>보험료 계산' + (rs.edit ? ' · 금액 수정' : '') + '</h2><div class="acts" style="margin:0">' + (rs.edit ? '<button class="btn" id="r-save">저장</button><button class="btn line" id="r-cancel">취소</button><button class="btn red" id="r-reset">기본값으로 되돌리기</button>' : '<button class="btn line" id="r-edit">✎ 금액 수정</button>') + '</div></div><div class="panel rpanel">' + (rs.edit ? rEdit(R) : rView(R)) + '</div>';
      $$('.seg span', v).forEach(function (s) { s.addEventListener('click', function () { rs.kind = s.getAttribute('data-k'); rs.prog = ''; viewRates(v); }); });
      $$('[data-pg]', v).forEach(function (s) { s.addEventListener('click', function () { rs.prog = s.getAttribute('data-pg'); rs.sub = 0; viewRates(v); }); });
      $$('[data-sb]', v).forEach(function (s) { s.addEventListener('click', function () { rs.sub = +s.getAttribute('data-sb'); viewRates(v); }); });
      if (!rs.edit) {
        var by = $('#r-by', v), bm = $('#r-bm', v);
        if (by) { by.addEventListener('change', function () { rs.by = by.value; viewRates(v); }); bm.addEventListener('change', function () { rs.bm = bm.value; viewRates(v); }); }
        var al = $('#r-all', v); if (al) al.addEventListener('click', function () { rs.all = !rs.all; viewRates(v); });
        $('#r-edit', v).addEventListener('click', function () { rs.edit = true; rs.ed = cp(RATES); if (!rs.kind || rs.kind === '') rs.kind = 'm'; viewRates(v); });
      } else {
        $$('.ri', v).forEach(function (i) { i.addEventListener('input', function () { var d = i.value.replace(/[^0-9]/g, ''); i.value = d ? Number(d).toLocaleString('ko-KR') : ''; });
          i.addEventListener('change', function () { rSet(rs.ed, i.getAttribute('data-p'), i.value === '' ? null : num(i.value)); viewRates(v); }); });
        $$('[data-s]', v).forEach(function (i) { i.addEventListener('change', function () { rSet(rs.ed, i.getAttribute('data-p'), i.value); viewRates(v); }); });
        $('#r-cancel', v).addEventListener('click', function () { rs.edit = false; rs.ed = null; viewRates(v); });
        $('#r-reset', v).addEventListener('click', function () { var m = $('#modal'); m.innerHTML = '<div class="mbox"><h3>기본값으로 되돌릴까요?</h3><div class="mut">처음 금액(이미지 금액)으로 화면만 되돌려요. 「저장」을 눌러야 실제로 반영돼요.</div><div class="acts"><button class="btn" id="rr-ok">되돌리기</button><button class="btn line" id="rr-no">취소</button></div></div>'; m.hidden = false; $('#rr-no').addEventListener('click', function () { m.hidden = true; }); $('#rr-ok').addEventListener('click', function () { rs.ed = cp(RATE_DEF); m.hidden = true; viewRates(v); }); });
        $('#r-save', v).addEventListener('click', function () {
          var n = rDiff(rs.ed, RATES), m = $('#modal');
          if (!n) { toast('바뀐 내용이 없어요'); return; }
          m.innerHTML = '<div class="mbox"><h3>저장할까요?</h3><div class="mut">보험료 금액·문구 ' + n + '곳이 바뀌었어요. 저장하면 모든 관리자 화면에 바로 반영돼요.</div><div class="acts"><button class="btn" id="rs-ok">저장</button><button class="btn line" id="rs-no">계속 수정</button></div></div>'; m.hidden = false;
          $('#rs-no').addEventListener('click', function () { m.hidden = true; });
          $('#rs-ok').addEventListener('click', function () {
            this.disabled = true;
            sb.from('golddriver_settings').upsert({ key: RATE_KEY, value: rs.ed, updated_by: adminName, updated_at: new Date().toISOString() }).then(function (r) {
              if (r.error) { toast('저장 실패: ' + r.error.message + ' (SQL v3.1을 실행했는지 확인해 주세요)', 6000); $('#rs-ok').disabled = false; return; }
              RATES = cp(rs.ed); rs.edit = false; rs.ed = null; m.hidden = true; toast('저장했어요');
              logAct('보험료 수정 (' + n + '곳)').then(function () { loadAll().then(function () { viewRates(v); }); });
            });
          });
        });
      }
    });
  }

  /* ---------- 오늘 할 일 ---------- */
  function viewHome(v) {
    var today = ymd(new Date());
    var c = function (f) { return apps.filter(f).length; };
    var newc = c(function (a) { return a.status === 'new'; });
    var consult = c(function (a) { return a.signup_type === 'consult' && (a.status === 'new' || a.status === 'consult_wait' || a.status === 'consulting'); });
    var lic = c(function (a) { return a.license_status === 'submitted' && a.status !== 'complete' && a.status !== 'canceled' && a.status !== 'hold'; });
    var tdy = c(function (a) { return ymd(a.created_at) === today; });
    var todo = openApps().filter(function (a) { return a.status === 'new' || a.license_status === 'submitted'; }).slice(0, 30);
    v.innerHTML = '<h2>오늘 할 일</h2><div class="cards">' +
      stat('신규 신청', newc, 'new', newc > 0) + stat('상담 전화 필요', consult, 'consult', consult > 0) + stat('면허증 확인', lic, 'lic', lic > 0) +
      '<div class="stat"><b>' + tdy + '</b><span>오늘 접수</span></div><div class="stat" data-go="drivers"><b>' + drivers.length + '</b><span>가입 기사</span></div></div>' +
      '<div class="panel"><b>바로 처리할 신청</b>' + (todo.length ? todo.map(function (a) {
        return '<div class="todo clk" data-open="' + a.id + '"><div><b>' + esc(a.name) + '</b> ' + stTag(a.status) + '<div class="mut">' + fmtPhone(a.phone) + ' · ' + (a.signup_type === 'consult' ? '상담 ' + esc(a.call_time || '') : '바로 가입') + ' · 면허 ' + LIC[a.license_status] + '</div></div><div class="acts" style="margin:0"><button class="btn sm line" data-open="' + a.id + '">열기</button><a class="btn sm" href="' + tel(a.phone) + '">전화</a></div></div>';
      }).join('') : '<div class="mut" style="padding:14px 0">처리할 신청이 없어요 🎉</div>') + '</div>';
    $$('.stat[data-f]', v).forEach(function (s) { s.addEventListener('click', function () { filter = s.getAttribute('data-f'); tab = 'apps'; render(); }); });
    $$('.stat[data-go]', v).forEach(function (s) { s.addEventListener('click', function () { tab = s.getAttribute('data-go'); render(); }); });
    $$('.todo[data-open]', v).forEach(function (b) { b.addEventListener('click', function (e) { if (e.target.closest('a')) return; openDrawer(b.getAttribute('data-open')); }); });
  }
  function stat(l, n, f, hot) { return '<div class="stat ' + (hot ? 'hot' : '') + '" data-f="' + f + '"><b>' + n + '</b><span>' + l + '</span></div>'; }

  /* ---------- 가입 신청 ---------- */
  var FILTERS = [['all', '전체'], ['new', '신규'], ['consult', '상담 필요'], ['lic', '면허 확인'], ['complete', '가입 완료'], ['hold', '가입 불가(보류)'], ['canceled', '취소']];
  function matchF(a) {
    if (filter === 'all') return true;
    if (filter === 'new') return a.status === 'new';
    if (filter === 'consult') return a.signup_type === 'consult' && ['new', 'consult_wait', 'consulting'].indexOf(a.status) >= 0;
    if (filter === 'lic') return a.license_status === 'submitted' && a.status !== 'complete' && a.status !== 'canceled' && a.status !== 'hold';
    return a.status === filter;
  }
  var sel = {};
  function viewApps(v) {
    var rows = apps.filter(matchF).filter(function (a) { var t = (a.name + a.phone + (a.receipt_no || '') + (a.region || '')).toLowerCase(); return !q || t.indexOf(q.toLowerCase()) >= 0; });
    var selN = rows.filter(function (a) { return sel[a.id]; }).length, allOn = rows.length > 0 && selN === rows.length;
    v.innerHTML = '<h2>가입 신청 <span class="mut" style="font-size:14px">' + rows.length + '건</span></h2><div class="bar"><div class="chips">' +
      FILTERS.map(function (f) { return '<button class="chip ' + (filter === f[0] ? 'on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
      '</div><input type="search" id="q" placeholder="이름·전화·접수번호" value="' + esc(q) + '"><button class="btn sm line" id="csv">엑셀(CSV) 다운로드</button></div>' +
      '<div class="selbar"><label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="selall" style="width:18px;height:18px;padding:0"' + (allOn ? ' checked' : '') + '> 전체 선택</label><span class="mut">' + selN + '건 선택됨</span><button class="btn sm red" id="seldel"' + (selN ? '' : ' disabled') + '>선택 삭제</button></div>' +
      '<div class="tw"><table><thead><tr><th class="ck"></th><th>접수번호</th><th>접수일시</th><th>상태</th><th>이름</th><th>나이</th><th>전화번호</th><th>지역</th><th>통신사</th><th>명의</th><th>업무</th><th>방식</th><th>보험</th><th>유형</th><th>앱</th><th>운전면허증</th><th>거부 사유</th><th>담당자</th></tr></thead><tbody>' +
      rows.map(function (a) {
        return '<tr class="clk s-' + a.status + '" data-id="' + a.id + '"><td class="ck" data-nodrawer="1"><input type="checkbox" class="rk" data-id="' + a.id + '"' + (sel[a.id] ? ' checked' : '') + '></td><td data-l="접수번호">' + esc(a.receipt_no) + '</td><td data-l="접수">' + ymdhm(a.created_at) + '</td><td data-l="상태">' + stTag(a.status) + '</td><td data-l="이름"><b>' + esc(a.name) + '</b></td><td data-l="나이">' + age(a.birth_date) + '</td><td data-l="전화">' + fmtPhone(a.phone) + phBadge(a.phone, a.id, null) + '</td><td data-l="지역">' + esc(a.region) + '</td><td data-l="통신사">' + esc(CAR[a.carrier] || '-') + '</td><td data-l="명의">' + esc((OWN[a.phone_owner] || '-').replace(' 명의', '')) + '</td><td data-l="업무">' + (WT[a.work_type] || '-') + '</td><td data-l="방식">' + (WM[a.work_mode] || '-') + '</td><td data-l="보험">' + (INS[a.insurance] || '-') + '</td><td data-l="유형">' + (a.signup_type === 'consult' ? '상담' : '바로가입') + '</td><td data-l="앱">' + esc(appsText(a)) + '</td><td data-l="운전면허증">' + LIC[a.license_status] + '</td><td data-l="거부 사유">' + (a.status === 'hold' ? '<span class="rej">' + esc(a.reject_reason || '-') + '</span>' : '') + '</td><td data-l="담당자">' + esc(a.assignee || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (rows.length ? '' : '<div class="mut" style="padding:20px;text-align:center">해당하는 신청이 없어요</div>');
    $$('.chip', v).forEach(function (b) { b.addEventListener('click', function () { filter = b.getAttribute('data-f'); sel = {}; render(); }); });
    $('#q', v).addEventListener('change', function () { q = this.value; sel = {}; render(); });
    $$('tr.clk', v).forEach(function (r) { r.addEventListener('click', function (e) { if (e.target.closest('[data-nodrawer]')) return; openDrawer(r.getAttribute('data-id')); }); });
    $$('.rk', v).forEach(function (c) { c.addEventListener('change', function () { if (c.checked) sel[c.getAttribute('data-id')] = 1; else delete sel[c.getAttribute('data-id')]; viewApps(v); }); });
    $('#selall', v).addEventListener('change', function () { var on = this.checked; rows.forEach(function (a) { if (on) sel[a.id] = 1; else delete sel[a.id]; }); viewApps(v); });
    $('#seldel', v).addEventListener('click', function () { deleteApps(rows.filter(function (a) { return sel[a.id]; })); });
    $('#csv', v).addEventListener('click', function () {
      csv('가입신청_' + ymd(new Date()) + '.csv', ['접수번호', '접수일시', '상태', '이름', '생년월일', '전화번호', '지역', '통신사', '명의', '기종', '업무', '방식', '보험', '유형', '앱', '통화희망', '질문', '추천인', '운전면허증', '거부 사유', '담당자', '메모'],
        rows.map(function (a) { return [a.receipt_no, ymdhm(a.created_at), (ST[a.status] || [a.status])[0], a.name, a.birth_date, fmtPhone(a.phone), a.region, CAR[a.carrier] || '', OWN[a.phone_owner] || '', a.device_model, WT[a.work_type], WM[a.work_mode], INS[a.insurance], a.signup_type === 'consult' ? '상담' : '바로가입', appsText(a), a.call_time, a.question, a.referrer, LIC[a.license_status], a.reject_reason || '', a.assignee, a.memo]; }));
    });
  }
  function deleteApps(list) {
    if (!list.length) return;
    var reg = list.filter(function (a) { return a.driver_id; }).length;
    var m = $('#modal');
    m.innerHTML = '<div class="mbox"><h3>선택한 ' + list.length + '건을 삭제할까요?</h3><div class="mut">삭제하면 되돌릴 수 없어요. 운전면허증 사진도 함께 삭제됩니다. 필요하면 먼저 "처리 기록 → 백업"을 받아 두세요.' + (reg ? '<br><b style="color:#d93a3a">기사로 등록된 신청 ' + reg + '건이 포함되어 있어요. (기사 가입 현황의 기사 정보는 그대로 남습니다)</b>' : '') + '</div>' +
      '<div class="acts"><button class="btn red" id="x-ok">삭제</button><button class="btn line" id="x-no">취소</button></div></div>';
    m.hidden = false;
    $('#x-no').addEventListener('click', function () { m.hidden = true; });
    $('#x-ok').addEventListener('click', function () {
      this.disabled = true;
      var ids = list.map(function (a) { return a.id; }), paths = list.map(function (a) { return a.license_path; }).concat(list.map(function (a) { return a.selfie_path; })).filter(Boolean);
      (paths.length ? sb.storage.from('golddriver-licenses').remove(paths) : Promise.resolve()).then(function () {
        return sb.from('golddriver_applications').delete().in('id', ids);
      }).then(function (r) {
        if (r.error) { toast('삭제 실패: ' + r.error.message, 5000); $('#x-ok').disabled = false; return; }
        logAct('가입 신청 ' + ids.length + '건 삭제 (' + list.slice(0, 3).map(function (a) { return a.name; }).join(', ') + (list.length > 3 ? ' 외' : '') + ')', null);
        sel = {}; m.hidden = true; toast(ids.length + '건 삭제했어요'); loadAll().then(render);
      });
    });
  }

  /* ---------- 신청 내용 공유 (카카오톡 · 문자 등) ---------- */
  function shareLines(a) {
    return ['이름 : ' + a.name, '생년월일 : ' + a.birth_date + ' (만 ' + age(a.birth_date) + '세)', '전화번호 : ' + fmtPhone(a.phone), '지역 : ' + (a.region || '-'), '통신사 : ' + (CAR[a.carrier] || '-'), '휴대폰 명의 : ' + (OWN[a.phone_owner] || '-'), '휴대폰 기종 : ' + (a.device_model || '-'), '업무/방식 : ' + (WT[a.work_type] || '-') + ' / ' + (WM[a.work_mode] || '-'), '보험 : ' + (INS[a.insurance] || '-'),
      '사용 경험 앱 : ' + ((a.used_apps || []).map(function (x) { return APPN[x] || x; }).join(', ') || '-'),
      '신청 앱 : ' + (['logi', 'callmaner', 'aicon'].filter(function (k) { return (a.selected_apps || {})[k] > 0; }).map(function (k) { return APPN[k] + ' ' + a.selected_apps[k]; }).join(', ') || '-'), '메모 : ' + (a.memo || '')];
  }
  function shareText(a, extra) {
    var L = shareLines(a).concat(extra || []);
    return L.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n');
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-999px'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); ok ? res() : rej(); });
  }
  function shareSheet(a) {
    var photos = [];
    if (a.license_path) photos.push({ k: 'lic', label: '운전면허증 사진', line: '운전면허증 사진 첨부', path: a.license_path, file: '면허증' });
    if (a.selfie_path) photos.push({ k: 'self', label: '본인 셀프 사진', line: '본인 셀프 사진 첨부', path: a.selfie_path, file: '본인사진' });
    shareCore({ h: '신청 내용 공유', name: a.name, title: a.name + ' 신청 내용', text: shareText(a), photos: photos });
  }
  function numbered(L) { return L.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n'); }
  function driverLines(d) {
    return ['이름 : ' + d.name + ' (사번 ' + fno(d.emp_no) + ')', '가입일 : ' + (d.joined_at || '-') + (d.team ? ' · ' + d.team : ''), '주민번호 : ' + (d.ssn ? maskSsn(d.ssn) + ' (뒷자리 가림)' : '-'), '핸드폰 : ' + fmtPhone(d.phone), '통신사 / 명의 : ' + (d.carrier || '-') + ' / ' + (d.phone_owner || '-'), '설치 프로그램 : ' + (d.programs || '-'), '보험 : ' + (d.insurance || '-') + (d.ins_company ? ' (보험회사 ' + d.ins_company + ')' : ''), '입금 그룹명 : ' + (d.deposit_group || '-'), '보증금 : ' + n0(d.deposit_amount) + '원', '일비 : ' + n0(d.daily_fee) + '원 · 월 합산 비용 : ' + n0(d.total_cost) + '원', '유입 경로 : ' + (d.source || '-'), '비고 : ' + (d.note || '')];
  }
  function driverShare(list) {
    if (!list || !list.length) { toast('공유할 기사를 먼저 체크해 주세요'); return; }
    if (list.length > 1) { shareCore({ h: '기사 ' + list.length + '명 정보 공유', name: '기사', title: '기사 정보', text: list.map(function (d) { return '▶ ' + d.name + ' (' + fno(d.emp_no) + ')\n' + numbered(driverLines(d)); }).join('\n\n'), photos: [] }); return; }
    var d = list[0], photos = [], lp = licPathOf(d), sp = selfPathOf(d);
    if (lp) photos.push({ k: 'lic', label: '운전면허증 사진', line: '운전면허증 사진 첨부', path: lp, file: '면허증' });
    if (sp) photos.push({ k: 'self', label: '본인 셀프 사진', line: '본인 셀프 사진 첨부', path: sp, file: '본인사진' });
    shareCore({ h: '기사 정보 공유', name: d.name, title: d.name + ' 기사 정보', text: numbered(driverLines(d)), photos: photos });
  }
  function shareCore(o) {
    var m = $('#modal'), photos = o.photos, isPC = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    var tailRe = /\n?\d+\. (운전면허증|본인 셀프) 사진 첨부/g;
    if (isPC) {
      m.innerHTML = '<div class="mbox"><h3>' + o.h + '</h3><div class="mut" style="margin-bottom:8px">카카오톡 PC 대화창에서 ① 글 붙여넣기 → ② 사진 붙여넣기(Ctrl+V) 순서로 보내세요.</div><textarea id="sh-t" rows="12" style="width:100%;font-size:14px;line-height:1.55"></textarea>' +
        '<div class="acts"><button class="btn" id="sh-cp">① 글 복사</button></div>' +
        photos.map(function (ph) { return '<div class="shrow"><img class="shth" data-t="' + ph.k + '" alt=""><b>' + ph.label + '</b><button class="btn dark sm" data-cp="' + ph.k + '">② 사진 복사</button><button class="btn line sm" data-dl="' + ph.k + '">저장</button></div>'; }).join('') +
        '<div id="sh-ok" class="shok"></div><div class="acts"><button class="btn line" id="sh-x">닫기</button></div></div>';
    } else {
      m.innerHTML = '<div class="mbox"><h3>' + o.h + '</h3><div class="mut" style="margin-bottom:8px">카카오톡 · 문자 등으로 보낼 내용이에요. 보내기 전에 글을 고칠 수 있어요.</div><textarea id="sh-t" rows="14" style="width:100%;font-size:14px;line-height:1.55"></textarea>' +
        photos.map(function (ph) { return '<label class="shchk"><input type="checkbox" data-p="' + ph.k + '" checked> <span>' + ph.label + '도 함께 보내기</span><img class="shth" data-t="' + ph.k + '" alt=""></label>'; }).join('') +
        '<div class="acts"><button class="btn" id="sh-go">카카오톡 · 문자로 공유</button><button class="btn line" id="sh-cp">글만 복사</button><button class="btn line" id="sh-x">닫기</button></div><div class="mut" style="font-size:12px;margin-top:8px">「공유」를 누르면 휴대폰 공유 창이 열려요. 거기서 카카오톡이나 문자를 고르세요.</div></div>';
    }
    m.hidden = false;
    var ta = $('#sh-t', m), files = {}, blobP = {};
    function checked(k) { var c = $('input[data-p="' + k + '"]', m); return !!(c && c.checked); }
    function setText() {
      var cur = ta.value.replace(tailRe, '').replace(/\s+$/, '');
      var extra = photos.filter(function (ph) { return isPC || checked(ph.k); }).map(function (ph) { return ph.line; });
      var base = cur ? cur : o.text;
      var n = base.split('\n').filter(function (x) { return /^\d+\. /.test(x); }).length;
      ta.value = base + extra.map(function (x, i) { return '\n' + (n + i + 1) + '. ' + x; }).join('');
    }
    ta.value = o.text; setText();
    $$('input[data-p]', m).forEach(function (c) { c.addEventListener('change', setText); });
    photos.forEach(function (ph) {
      blobP[ph.k] = sb.storage.from('golddriver-licenses').createSignedUrl(ph.path, 300).then(function (r) {
        if (!r.data) throw new Error('sign');
        var im = $('img[data-t="' + ph.k + '"]', m); if (im) im.src = r.data.signedUrl;
        return fetch(r.data.signedUrl).then(function (x) { return x.blob(); });
      });
      blobP[ph.k].then(function (b) { files[ph.k] = new File([b], o.name + '_' + ph.file + '.jpg', { type: b.type || 'image/jpeg' }); }).catch(function () {});
    });
    $('#sh-x', m).addEventListener('click', function () { m.hidden = true; });
    $('#sh-cp', m).addEventListener('click', function () { copyText(ta.value).then(function () { toast(isPC ? '글을 복사했어요. 카카오톡 입력창에서 Ctrl+V' : '글을 복사했어요. 카카오톡이나 문자에 붙여넣기 하세요'); }, function () { toast('복사하지 못했어요. 글을 드래그해서 복사해 주세요'); }); });
    if (isPC) {
      var toPng = function (b) { return createImageBitmap(b).then(function (bm) { var cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height; cv.getContext('2d').drawImage(bm, 0, 0); return new Promise(function (res, rej) { cv.toBlob(function (x) { x ? res(x) : rej(); }, 'image/png'); }); }); };
      $$('[data-cp]', m).forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-cp');
          if (!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem)) { toast('이 브라우저는 사진 복사를 지원하지 않아요. 「저장」 후 카톡 창에 끌어다 놓으세요'); return; }
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP[k].then(toPng) })]).then(function () { $('#sh-ok', m).textContent = '✓ 복사됨 — 카톡 입력창에서 Ctrl+V'; }, function () { toast('사진을 복사하지 못했어요. 「저장」을 이용해 주세요'); });
        });
      });
      $$('[data-dl]', m).forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-dl'); if (!files[k]) { toast('사진을 아직 불러오는 중이에요. 잠시 후 다시 눌러 주세요'); return; }
          var l = document.createElement('a'); l.href = URL.createObjectURL(files[k]); l.download = files[k].name; document.body.appendChild(l); l.click(); l.remove();
        });
      });
      return;
    }
    $('#sh-go', m).addEventListener('click', function () {
      var fl = photos.filter(function (ph) { return checked(ph.k) && files[ph.k]; }).map(function (ph) { return files[ph.k]; });
      var want = photos.filter(function (ph) { return checked(ph.k); }).length;
      var data = { text: ta.value, title: o.title };
      if (fl.length) data.files = fl;
      if (!navigator.share) { copyText(ta.value).then(function () { toast('이 화면에서는 바로 공유가 안 돼요. 글을 복사했어요'); }, function () { toast('공유를 지원하지 않는 화면이에요'); }); return; }
      if (fl.length && !(navigator.canShare && navigator.canShare({ files: fl }))) { delete data.files; toast('사진은 이 화면에서 공유할 수 없어 글만 보내요'); }
      else if (want && !fl.length) { toast('사진을 아직 불러오는 중이에요. 잠시 후 다시 눌러 주세요'); return; }
      navigator.share(data).catch(function (e) { if (e && e.name !== 'AbortError') toast('공유하지 못했어요. 글만 복사해 보세요'); });
    });
  }
  function holdModal(a) {
    var m = $('#modal');
    m.innerHTML = '<div class="mbox"><h3>가입 불가(보류) 처리</h3><div class="mut" style="margin-bottom:8px">' + esc(a.name) + '님을 가입 불가(보류)로 바꿔요. 사유는 목록의 「거부 사유」에 표시돼요.</div><div class="f"><label>거부 사유 (필수)</label><textarea id="h-r" rows="4" placeholder="예) 전동휠 분납 및 신규 구매 불가"></textarea></div><div class="mut" style="font-size:12px">나중에 상태를 다시 「신규」 등으로 바꾸면 보류가 풀려요.</div><div class="acts"><button class="btn red" id="h-ok">가입 불가(보류) 저장</button><button class="btn line" id="h-x">취소</button></div></div>';
    m.hidden = false;
    $('#h-x', m).addEventListener('click', function () { m.hidden = true; });
    $('#h-ok', m).addEventListener('click', function () {
      var r = $('#h-r', m).value.trim();
      if (!r) { toast('거부 사유를 입력해 주세요'); return; }
      sb.from('golddriver_applications').update({ status: 'hold', reject_reason: r }).eq('id', a.id).then(function (x) {
        if (x.error) { toast('저장 실패: ' + x.error.message); return; }
        logAct(a.name + ' · 가입 불가(보류) · ' + r, a.id);
        toast('가입 불가(보류)로 저장했어요'); m.hidden = true; $('#drawer').hidden = true; filter = 'hold'; tab = 'apps'; loadAll().then(render);
      });
    });
  }
  /* ---------- 상세 서랍 ---------- */
  function openDrawer(id) {
    var a = apps.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    var d = $('#drawer');
    var sOpts = Object.keys(ST).filter(function (k) { return k !== 'hold' || a.status === 'hold'; }).map(function (k) { return '<option value="' + k + '"' + (a.status === k ? ' selected' : '') + '>' + ST[k][0] + '</option>'; }).join('');
    d.innerHTML = '<div class="dbox"><div style="display:flex;justify-content:space-between"><h3>' + esc(a.name) + ' ' + stTag(a.status) + '</h3><button class="btn sm line" id="dx">닫기</button></div><div class="mut">' + esc(a.receipt_no) + ' · ' + ymdhm(a.created_at) + '</div>' + phWarnBox(a.phone, a.id, a.driver_id || null) +
      '<div class="acts"><a class="btn" href="' + tel(a.phone) + '">전화 걸기</a><a class="btn line" href="' + sms(a.phone, a.name + '님, 골드대리운전입니다.') + '">문자 보내기</a><button class="btn line" id="dshare">공유</button>' +
      (a.payment_status === 'requested' ? '<a class="btn dark" href="' + sms(a.phone, a.name + '님, 골드대리운전 첫 달 이용료 안내드립니다. 예상 금액 ' + n0(a.payment_amount) + '원. 입금 계좌는 [여기에 계좌 입력]') + '">결제 안내 문자</a>' : '') + '</div>' +
      '<dl class="kv"><dt>생년월일</dt><dd>' + esc(a.birth_date) + ' (만 ' + age(a.birth_date) + '세)</dd><dt>전화번호</dt><dd>' + fmtPhone(a.phone) + '</dd><dt>지역</dt><dd>' + esc(a.region || '-') + '</dd><dt>통신사</dt><dd>' + esc(CAR[a.carrier] || '-') + '</dd><dt>휴대폰 명의</dt><dd>' + esc(OWN[a.phone_owner] || '-') + '</dd><dt>휴대폰 기종</dt><dd>' + esc(a.device_model || '-') + '</dd><dt>업무/방식</dt><dd>' + (WT[a.work_type] || '-') + ' / ' + (WM[a.work_mode] || '-') + '</dd><dt>보험</dt><dd>' + (INS[a.insurance] || '-') + '</dd><dt>사용 경험 앱</dt><dd>' + esc((a.used_apps || []).map(function (x) { return APPN[x] || x; }).join(', ') || '-') + '</dd><dt>신청 앱</dt><dd>' + esc(appsText(a)) + '</dd><dt>예상 금액</dt><dd>' + n0(a.payment_amount) + '원</dd><dt>유형</dt><dd>' + (a.signup_type === 'consult' ? '상담부터 · ' + esc(a.call_time || '') : '상담 없이 바로 가입') + '</dd><dt>궁금한 점</dt><dd>' + esc(a.question || '-') + '</dd><dt>추천인</dt><dd>' + esc(a.referrer || '-') + '</dd><dt>마케팅 동의</dt><dd>' + (a.consent_marketing ? '동의' : '미동의') + '</dd><dt>운전면허증</dt><dd>' + LIC[a.license_status] + '</dd><dt>결제</dt><dd>' + PAY[a.payment_status] + '</dd></dl>' +
      (a.status === 'hold' ? '<div class="rejbox"><b>거부 사유</b><div>' + esc(a.reject_reason || '-') + '</div></div>' : '') + '<div id="licarea"></div><div id="selfarea"></div>' +
      '<div class="grid2"><div class="f"><label>상태</label><select id="d-st">' + sOpts + '</select></div><div class="f"><label>담당자</label><input id="d-as" value="' + esc(a.assignee || '') + '"></div></div>' +
      '<div class="f"><label>메모</label><textarea id="d-memo">' + esc(a.memo || '') + '</textarea></div>' +
      '<div class="acts"><button class="btn" id="d-save">저장</button>' + (a.driver_id ? '<span class="tag g big">기사 등록됨</span>' : '<button class="btn dark" id="d-reg">가입 완료</button>' + (a.status === 'hold' ? '' : '<button class="btn red" id="d-hold">가입 불가(보류)</button>')) + '</div></div>';
    d.hidden = false;
    d.addEventListener('click', function h(e) { if (e.target === d) { d.hidden = true; d.removeEventListener('click', h); } });
    $('#dx').addEventListener('click', function () { d.hidden = true; });
    $('#dshare').addEventListener('click', function () { shareSheet(a); });
    if (a.selfie_path) {
      sb.storage.from('golddriver-licenses').createSignedUrl(a.selfie_path, 600).then(function (r) {
        $('#selfarea').innerHTML = r.data ? '<b>본인 셀프 사진</b><a href="' + r.data.signedUrl + '" target="_blank"><img class="lic" src="' + r.data.signedUrl + '"></a>' : '<div class="err">본인 사진을 불러오지 못했어요</div>';
      });
    }
    if (a.license_path) {
      sb.storage.from('golddriver-licenses').createSignedUrl(a.license_path, 600).then(function (r) {
        $('#licarea').innerHTML = r.data ? '<b>운전면허증</b><a href="' + r.data.signedUrl + '" target="_blank"><img class="lic" src="' + r.data.signedUrl + '"></a><div class="mut" style="font-size:12px">보안을 위해 이 사진 링크는 10분 후 만료돼요 (창을 닫았다 다시 열면 새로 만들어져요)</div>' : '<div class="err">면허증을 불러오지 못했어요</div>';
      });
    }
    $('#d-save').addEventListener('click', function () {
      var upd = { status: $('#d-st').value, assignee: $('#d-as').value.trim() || null, memo: $('#d-memo').value.trim() || null };
      var diff = [];
      if (upd.status !== a.status) diff.push('상태 ' + ST[a.status][0] + '→' + ST[upd.status][0]);
      if ((upd.assignee || '') !== (a.assignee || '')) diff.push('담당자 ' + (upd.assignee || '없음'));
      if ((upd.memo || '') !== (a.memo || '')) diff.push('메모 수정');
      if (a.status === 'hold' || upd.status === 'hold') upd.reject_reason = upd.status === 'hold' ? (a.reject_reason || null) : null;
      sb.from('golddriver_applications').update(upd).eq('id', a.id).then(function (r) {
        if (r.error) { toast('저장 실패: ' + r.error.message); return; }
        if (diff.length) logAct(a.name + ' · ' + diff.join(', '), a.id);
        toast('저장했어요'); d.hidden = true; loadAll().then(render);
      });
    });
    var reg = $('#d-reg'); if (reg) reg.addEventListener('click', function () { registerModal(a); });
    var hb = $('#d-hold'); if (hb) hb.addEventListener('click', function () { holdModal(a); });
  }

  /* ---------- 계산 규칙: 월 합산 비용 = 일비 × 30 − 1,000 / 순 마진 = 월 합산 비용 ÷ 2 ---------- */
  function num(x) { return parseInt(String(x == null ? '' : x).replace(/[^0-9\-]/g, ''), 10) || 0; }
  function money(ids) { ids.forEach(function (q) { var el = $(q); if (!el) return; el.type = 'text'; el.setAttribute('inputmode', 'numeric'); if (el.value !== '') el.value = n0(num(el.value));
    el.addEventListener('input', function () { var neg = el.value.trim().charAt(0) === '-', d = el.value.replace(/[^0-9]/g, ''); el.value = (neg ? '-' : '') + (d ? Number(d).toLocaleString('ko-KR') : ''); }); }); }
  function calcTotal(daily) { return num(daily) * 30; }
  function calcMargin(total, chang, real, cm) { var g = num; return Math.round((g(total) - g(chang) - g(real) + g(cm)) / 2); }
  function fmtSsn(s) { var d = String(s || '').replace(/[^0-9]/g, ''); return d.length === 13 ? d.slice(0, 6) + '-' + d.slice(6) : String(s || ''); }
  function maskSsn(s) { var d = String(s || '').replace(/[^0-9]/g, ''); return d.length === 13 ? d.slice(0, 6) + '-' + d.slice(6, 7) + '******' : String(s || ''); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  /* ---------- 운전면허증 사진에서 주민번호 자동 인식 (브라우저에서 무료 OCR, 서버로 사진을 보내지 않음) ---------- */
  var ocrLib = null, OCR_LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int';
  function loadOcr() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (ocrLib) return ocrLib;
    ocrLib = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload = function () { res(window.Tesseract); }; s.onerror = function () { ocrLib = null; rej(new Error('ocr_lib')); }; document.head.appendChild(s);
    });
    return ocrLib;
  }
  function prepImage(blob) {
    return new Promise(function (res) {
      var img = new Image(); img.onload = function () {
        var w = Math.min(2400, Math.max(1600, img.width)), k = w / img.width, cv = document.createElement('canvas'); cv.width = w; cv.height = Math.round(img.height * k);
        var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
        var d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data, i, g;
        for (i = 0; i < p.length; i += 4) { g = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]; g = (g - 128) * 1.5 + 128; g = g < 0 ? 0 : g > 255 ? 255 : g; p[i] = p[i + 1] = p[i + 2] = g; }
        cx.putImageData(d, 0, 0); cv.toBlob(function (b) { res(b); }, 'image/png');
      }; img.src = URL.createObjectURL(blob);
    });
  }
  function findSsn(text) {
    var t = String(text || '').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1'), m, best = null, re = /(\d{6})\s*[-–—~‐]?\s*([1-4]\d{6})/g;
    while ((m = re.exec(t))) {
      var mm = +m[1].slice(2, 4), dd = +m[1].slice(4, 6);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) { best = m[1] + '-' + m[2]; break; }
    }
    return best;
  }
  function ocrSsn(path, onState) {
    onState('인식 중… (처음엔 20~30초 걸릴 수 있어요)', '');
    return sb.storage.from('golddriver-licenses').download(path).then(function (r) {
      if (r.error || !r.data) throw new Error('download');
      return Promise.all([prepImage(r.data), loadOcr()]);
    }).then(function (x) {
      return x[1].createWorker('eng', 1, { langPath: OCR_LANG }).then(function (w) {
        return w.setParameters({ tessedit_char_whitelist: '0123456789-' }).then(function () { return w.recognize(x[0]); }).then(function (r) { return w.terminate().then(function () { return r; }); });
      });
    }).then(function (r) {
      var s = findSsn(r.data && r.data.text);
      if (s) onState('운전면허증에서 읽었어요. 사진과 꼭 맞는지 확인해 주세요.', 'ok');
      else onState('자동 인식에 실패했어요. 직접 입력해 주세요.', 'bad');
      return s;
    }).catch(function () { onState('자동 인식을 쓸 수 없어요(인터넷 확인). 직접 입력해 주세요.', 'bad'); return null; });
  }

  function registerModal(a) {
    sb.rpc('golddriver_next_emp_no').then(function (r) {
      var m = $('#modal');
      var ins = a.insurance === 'month' ? '월보험' : '건당보험';
      m.innerHTML = '<div class="mbox wide"><h3>가입 완료</h3><div class="mut">' + esc(a.name) + ' 님을 기사 가입 현황에 등록합니다. 신청 상태는 "가입 완료"로 바뀝니다. 모든 칸은 나중에도 수정할 수 있어요.</div>' +
        '<div class="grid3"><div class="f"><label>가입일</label><input id="r-date" type="date" value="' + todayStr() + '"></div><div class="f"><label>사번</label><input id="r-emp" type="number" value="' + (r.data || '') + '"></div><div class="f"><label>소속</label><input id="r-team" value="골드 2팀"></div>' +
        '<div class="f"><label>성명</label><input id="r-name" value="' + esc(a.name) + '"></div><div class="f"><label>주민번호</label><input id="r-ssn" placeholder="000000-0000000" maxlength="14" autocomplete="off"><div class="ocr" id="r-ocr"></div></div><div class="f"><label>핸드폰 번호</label><input id="r-phone" value="' + esc(fmtPhone(a.phone)) + '"></div>' +
        '<div class="f"><label>통신사 <small class="auto">신청서</small></label><input id="r-car" value="' + esc(CAR[a.carrier] || '') + '"></div><div class="f"><label>명의 <small class="auto">신청서</small></label><input id="r-own" value="' + (a.phone_owner === 'other' ? '타인' : a.phone_owner === 'self' ? '본인' : '') + '"></div><div class="f"><label>설치 프로그램 <small class="auto">신청서</small></label><input id="r-prog" value="' + esc(Object.keys(a.selected_apps || {}).filter(function (k) { return a.selected_apps[k] > 0 && /^(logi|callmaner|aicon)$/.test(k); }).map(function (k) { return APPN[k] + ' ' + a.selected_apps[k]; }).join(', ')) + '"></div>' +
        '<div class="f"><label>보험 회사명</label><input id="r-co"></div><div class="f"><label>보험 종류</label><input id="r-ins" value="' + ins + '"></div><div class="f"><label>입금 그룹명</label><input id="r-dep" placeholder="월보험 · 건당보험1000 …"></div>' +
        '<div class="f"><label>보증금</label><input id="r-dep2" value="0">' + depChips('r-dep2') + '</div><div class="f"><label>일비</label><input id="r-daily" type="number" inputmode="numeric" value=""></div><div class="f"><label>실보험료</label><input id="r-real" type="number" inputmode="numeric" value="0"></div><div class="f"><label>창 비용</label><input id="r-chang" type="number" inputmode="numeric" value="17000"></div>' +
        '<div class="f"><label>콜마너 비용</label><input id="r-cm" type="number" inputmode="numeric" value="0"></div><div class="f"><label>월 합산 비용 (일비×30)</label><input id="r-tot" type="number" value="0"></div><div class="f"><label>순 마진 ((월합산−창비용−실보험료+콜마너)÷2)</label><input id="r-mar" type="number" value="0"></div></div>' +
        '<div class="f"><label>유입 경로</label><input id="r-src" list="srcl" placeholder="블로그 · 유튜브 · 소개 …"></div><div class="f"><label>비고</label><input id="r-note"></div>' +
        '<div class="acts"><button class="btn" id="r-ok">등록</button><button class="btn line" id="r-no">취소</button></div></div>';
      m.hidden = false;
      $('#r-ssn').addEventListener('input', function () { var d = this.value.replace(/[^0-9]/g, '').slice(0, 13); this.value = d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d; });
      money(['#r-dep2', '#r-daily', '#r-real', '#r-chang', '#r-cm', '#r-tot', '#r-mar']);
      var rmar = function () { $('#r-mar').value = n0(calcMargin($('#r-tot').value, $('#r-chang').value, $('#r-real').value, $('#r-cm').value)); };
      $('#r-daily').addEventListener('input', function () { $('#r-tot').value = n0(calcTotal(this.value)); rmar(); });
      ['#r-tot', '#r-chang', '#r-real', '#r-cm'].forEach(function (q) { $(q).addEventListener('input', rmar); });
      rmar();
      $('#r-no').addEventListener('click', function () { m.hidden = true; });
      if (a.license_path) {
        ocrSsn(a.license_path, function (msg, cls) { var o = $('#r-ocr'); if (o) { o.className = 'ocr ' + cls; o.textContent = msg; } }).then(function (s) { var el = $('#r-ssn'); if (s && el && !el.value) el.value = s; });
      } else { $('#r-ocr').textContent = '운전면허증이 아직 없어요. 받으면 직접 입력하거나 나중에 표에서 입력하세요.'; }
      $('#r-ok').addEventListener('click', function () {
        var n = function (id) { return $(id).value.replace(/,/g, '').trim(); };
        var p = { joined_at: n('#r-date'), emp_no: n('#r-emp'), team: n('#r-team'), name: n('#r-name'), ssn: n('#r-ssn'), phone: n('#r-phone'), carrier: n('#r-car'), phone_owner: n('#r-own'), programs: $('#r-prog').value.trim(), ins_company: n('#r-co'), insurance: n('#r-ins'), deposit_group: n('#r-dep'),
          deposit_amount: n('#r-dep2'), daily_fee: n('#r-daily'), insurance_cost: n('#r-real'), chang_fee: n('#r-chang'), status: '가입', callmaner_cost: n('#r-cm'), total_cost: n('#r-tot'), margin: n('#r-mar'), source: n('#r-src'), note: n('#r-note') };
        if (p.ssn && p.ssn.replace(/[^0-9]/g, '').length !== 13) { toast('주민번호는 13자리로 입력해 주세요'); return; }
        this.disabled = true;
        sb.rpc('golddriver_register_driver', { p_application_id: a.id, p: p }).then(function (x) {
          if (x.error) { toast('등록 실패: ' + (/duplicate/.test(x.error.message) ? '이미 사용 중인 사번이에요' : x.error.message), 5000); $('#r-ok').disabled = false; return; }
          if (p.source) sb.from('golddriver_drivers').update({ source: p.source }).eq('id', x.data.driver_id).then(function () { });
          m.hidden = true; $('#drawer').hidden = true; toast('사번 ' + x.data.emp_no + ' 번으로 등록 완료!'); tab = 'drivers'; loadAll().then(render);
        });
      });
    });
  }

  /* ---------- 기사 가입 현황 ---------- */
  var DCOL = [['joined_at', '가입일', 'd'], ['status', '상태', 't'], ['emp_no', '사번', 'n'], ['team', '소속'], ['name', '성명'], ['ssn', '주민번호', 's'], ['phone', '핸드폰 번호'], ['carrier', '통신사'], ['phone_owner', '명의'], ['programs', '설치 프로그램'], ['ins_company', '보험 회사명'], ['insurance', '보험 종류'], ['deposit_group', '입금 그룹명'],
    ['callmaner_cost', '콜마너 비용', 'n'], ['deposit_amount', '보증금', 'n'], ['daily_fee', '일비', 'n'], ['insurance_cost', '실보험료', 'n'], ['chang_fee', '창 비용', 'n'], ['total_cost', '월 합산 비용', 'n'], ['margin', '순 마진', 'n'], ['source', '유입 경로'], ['note', '비고', 'm']];
  var SRC = ['블로그', '유튜브', '소개', '타타타', 'BK오더방', '이실장', '오우달', '새달사', '현근 영업', '지인'];
  var SRX = { '블로그': /블로그/g, '유튜브': /유튜브/g, '소개': /소개/g, '타타타': /타타타/g, 'BK오더방': /BK\s*오더방|오더방/g, '이실장': /이실장/g, '오우달': /오우달/g, '새달사': /새달사\s*쪽지|새달사/g, '현근 영업': /현근\s*영업|현근/g, '지인': /지인/g };
  function stripSrc(t, src) { var x = String(t || ''); if (src && SRX[src]) x = x.replace(SRX[src], ' '); x = x.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim(); var m = /^\((.*)\)$/.exec(x); if (m) x = m[1].trim(); x = x.replace(/^[\s,·\/\-:]+|[\s,·\/\-:]+$/g, '').trim(); return x; }
  function detectSrc(t) { t = String(t || ''); var order = [['블로그', '블로그'], ['유튜브', '유튜브'], ['소개', '소개'], ['타타타', '타타타'], ['오더방', 'BK오더방'], ['이실장', '이실장'], ['오우달', '오우달'], ['새달사', '새달사'], ['현근', '현근 영업'], ['지인', '지인']]; for (var i = 0; i < order.length; i++) if (t.indexOf(order[i][0]) >= 0) return order[i][1]; return null; }
  var DWP = { joined_at: 84, status: 60, emp_no: 52, team: 70, name: 90, ssn: 112, phone: 150, carrier: 82, phone_owner: 66, programs: 124, ins_company: 92, insurance: 96, deposit_group: 118, callmaner_cost: 88, deposit_amount: 72, daily_fee: 70, insurance_cost: 80, chang_fee: 76, total_cost: 96, margin: 76, source: 82, note: 84, license: 92, selfie: 92 };
  var DDEF = ['joined_at', 'status', 'emp_no', 'name', 'ssn', 'phone', 'ins_company', 'insurance', 'deposit_group', 'callmaner_cost', 'deposit_amount', 'daily_fee', 'insurance_cost', 'chang_fee', 'total_cost', 'source', 'license', 'selfie'];
  var DEXPD = ['joined_at', 'status', 'emp_no', 'name', 'ssn', 'phone', 'ins_company', 'insurance', 'deposit_group', 'callmaner_cost', 'deposit_amount', 'daily_fee', 'insurance_cost', 'chang_fee', 'total_cost'];
  function allKeys() { return DCOL.map(function (c) { return c[0]; }).concat(['license', 'selfie']); }
  var dvis = (function () { try { var a = JSON.parse(localStorage.getItem('gd_dvis29') || 'null'); if (Array.isArray(a)) { a = a.filter(function (k) { return allKeys().indexOf(k) >= 0; }); if (a.length) return a; } } catch (e) {} return DDEF.slice(); })();
  function saveVis() { try { localStorage.setItem('gd_dvis29', JSON.stringify(dvis)); } catch (e) {} }
  function visCols() { return DCOL.filter(function (c) { return dvis.indexOf(c[0]) >= 0; }); }
  function isDefVis() { return dvis.length === DDEF.length && DDEF.every(function (k) { return dvis.indexOf(k) >= 0; }); }
  function setOvf() { $$('.dtw').forEach(function (w) { var t = $('table.dt', w); if (!t) return; w.classList.remove('ovf'); if (t.scrollWidth > w.clientWidth + 1) w.classList.add('ovf'); }); }
  window.addEventListener('resize', function () { setOvf(); });
  var dsort = { k: null, dir: 1 };
  function dcmp(a, b) {
    var k = dsort.k;
    if (!k) { var da = a.joined_at || '', db = b.joined_at || ''; if (da !== db) return !da ? -1 : !db ? 1 : (da < db ? -1 : 1); return a.emp_no - b.emp_no; }
    var x = a[k], y = b[k], ex = x == null || x === '', ey = y == null || y === '';
    if (ex !== ey) return ex ? 1 : -1;
    if (ex && ey) return a.emp_no - b.emp_no;
    var c = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'ko');
    return c ? c * dsort.dir : a.emp_no - b.emp_no;
  }
  var dfv = {}, dfm = false, dpage = 1, dsize = 50, dmore = 50, dstatAll = false, smon = '', STS = ['가입', '퇴사', '미납'];
  var dsel = {};
  var DALIAS = { 가입일: 'joined_at', 사번: 'emp_no', 소속: 'team', 성명: 'name', 이름: 'name', 주민번호: 'ssn', 주민등록번호: 'ssn', 핸드폰번호: 'phone', 휴대폰번호: 'phone', 전화번호: 'phone', 핸드폰: 'phone', 통신사: 'carrier', 통신사정보: 'carrier', 명의: 'phone_owner', 설치프로그램: 'programs', 설치: 'programs', 보험회사명: 'ins_company', 보험회사: 'ins_company',
    보험종류: 'insurance', 보증금: 'deposit_amount', 보험: 'insurance', 입금그룹명: 'deposit_group', 일비: 'daily_fee', 일관리비: 'daily_fee', 창비: 'chang_fee', 창비용: 'chang_fee', 상태: 'status', 유입경로: 'source', 천안콜마너비용: 'callmaner_cost', 실보험료: 'insurance_cost', 월보험비용: 'insurance_cost', 월합산비용: 'total_cost', 순마진: 'margin', 월마진: 'margin', 콜마너비용: 'callmaner_cost', 비고: 'note' };
  var dq = '';
  function dval(d, c) { var v = d[c[0]]; if (v == null) return ''; if (c[0] === 'emp_no') return fno(v); if (c[0] === 'phone') return fmtPhone(v); if (c[2] === 'n' && c[0] !== 'emp_no') return n0(v); return v; }
  function viewDrivers(v) {
    var rows = dRows();
    var sum = function (k) { return rows.reduce(function (s, d) { return s + (d[k] || 0); }, 0); };
    var dfN = dfCount(), fcnt = dfN + (dsort.k ? 1 : 0), VC = visCols(), showLic = dvis.indexOf('license') >= 0, showSelf = dvis.indexOf('selfie') >= 0, PX = 32 + (showLic ? DWP.license : 0) + (showSelf ? DWP.selfie : 0) + VC.reduce(function (s, c) { return s + DWP[c[0]]; }, 0);
    var cntS = function (x) { return drivers.filter(function (d) { return (d.status || '가입') === x; }).length; };
    var per = dsize || rows.length || 1, pages = Math.max(1, Math.ceil(rows.length / per)); if (dpage > pages) dpage = pages;
    var vstart = dsize ? (dpage - 1) * per : 0, view = dsize ? rows.slice(vstart, vstart + per) : rows;
    var pagerHtml = pagerH(rows.length, pages, vstart, view.length), chipsHtml = chipsH();
    var selN = rows.filter(function (d) { return dsel[d.id]; }).length, allOn = rows.length > 0 && selN === rows.length;
    v.innerHTML = '<div class="dtop"><h2>기사 가입 현황 <span class="mut" style="font-size:14px">' + rows.length + '명</span></h2><div class="bar"><input type="search" id="dq" placeholder="이름·전화·사번·소속·보험사" value="' + esc(dq) + '"><button class="btn sm" id="dadd">+ 추가</button><button class="btn sm line" id="dxl">엑셀 다운로드</button><button class="btn sm line" id="dup">엑셀 업로드</button><input type="file" id="dfile" class="hid" accept=".xlsx,.xls,.csv"><span class="mut">셀을 눌러 바로 수정(전화번호는 누르면 전화, 길게 누르면 수정) · 제목을 누르면 정렬 </span></div>' +
      '<div class="sumrow"><div class="sc kw' + (!dfv.status ? ' on' : '') + '" data-st=""><span>총 인원</span><b>' + drivers.length + '명</b></div><div class="sc kg' + (dfv.status && dfv.status[0]==='가입' ? ' on' : '') + '" data-st="가입"><span>가입</span><b>' + cntS('가입') + '명</b></div><div class="sc ky' + (dfv.status && dfv.status[0]==='퇴사' ? ' on' : '') + '" data-st="퇴사"><span>퇴사</span><b>' + cntS('퇴사') + '명</b></div><div class="sc kr' + (dfv.status && dfv.status[0]==='미납' ? ' on' : '') + '" data-st="미납"><span>미납</span><b>' + cntS('미납') + '명</b></div><div class="sc main"><span>순 마진 합계' + (dfN || dq ? ' (필터 결과)' : '') + '</span><b>' + n0(sum('margin')) + '원</b></div><div class="sc"><span>월 합산 비용 합계</span><b>' + n0(sum('total_cost')) + '원</b></div></div>' +
      '<div class="selbar"><label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="dselall" style="width:18px;height:18px;padding:0"' + (allOn ? ' checked' : '') + '> 전체 선택</label><span class="mut">' + selN + '명 선택됨</span><button class="btn sm red" id="dseldel"' + (selN ? '' : ' disabled') + '>선택 삭제</button><button class="btn sm" id="dshare"' + (selN ? '' : ' disabled') + '>공유</button><button class="btn sm red" id="dalldel"' + (drivers.length ? '' : ' disabled') + '>전체 삭제</button>' + '<button class="btn sm dark" id="dfm">▾ 필터 · 정렬' + (fcnt ? ' (' + fcnt + ')' : '') + '</button><button class="btn sm dark" id="dcols">▦ 열 선택 (' + dvis.length + '/' + (DCOL.length + 2) + ')</button></div>' + chipsHtml + '</div>' +
      '<datalist id="srcl">' + SRC.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist><div class="tw dtw"><table class="dt' + (dfm ? ' fm' : '') + '" style="min-width:' + PX + 'px;width:100%"><colgroup><col style="width:32px">' + VC.map(function (c) { return '<col style="width:' + DWP[c[0]] + 'px">'; }).join('') + (showLic ? '<col style="width:' + DWP.license + 'px">' : '') + (showSelf ? '<col style="width:' + DWP.selfie + 'px">' : '') + '</colgroup><thead><tr><th class="ck"></th>' + VC.map(function (c) { var on = dsort.k === c[0]; return '<th class="sk' + (c[0] === 'name' ? ' nm' : '') + '" data-sk="' + c[0] + '">' + c[1] + (dfm && FILT_OK(c[0]) ? '<i class="fb' + (dfv[c[0]] ? ' on' : '') + '" data-fb="' + c[0] + '">▾</i>' : '') + '<i class="ar' + (on ? ' on' : '') + '">' + (on ? (dsort.dir > 0 ? '▲' : '▼') : '↕') + '</i></th>'; }).join('') + (showLic ? '<th class="lh">면허증' + (dfm ? '<i class="fb' + (dfv.license ? ' on' : '') + '" data-fb="license">▾</i>' : '') + '</th>' : '') + (showSelf ? '<th class="lh">셀프 사진' + (dfm ? '<i class="fb' + (dfv.selfie ? ' on' : '') + '" data-fb="selfie">▾</i>' : '') + '</th>' : '') + '</tr></thead><tbody>' +
      view.map(function (d) {
        return '<tr><td class="ck"><input type="checkbox" class="dk" data-id="' + d.id + '"' + (dsel[d.id] ? ' checked' : '') + '></td>' + VC.map(function (c) {
          var val = dval(d, c), k = c[0], t = c[2];
          var cls = 'cell' + (t === 'n' ? ' num' : '');
          if (k === 'status') return '<td data-l="상태"><select class="cell st st-' + esc(d.status || '가입') + '" data-id="' + d.id + '" data-k="status">' + STS.map(function (x) { return '<option' + ((d.status || '가입') === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td>';
          if (k === 'source') return '<td data-l="유입 경로"><input class="cell" list="srcl" data-id="' + d.id + '" data-k="source" value="' + esc(d.source || '') + '"></td>';
          if (k === 'note') return '<td data-l="비고" class="nt"><div class="note" data-id="' + d.id + '" title="' + esc(d.note || '') + '">' + (d.note ? esc(d.note) : '<span class="mut">+ 메모</span>') + '</div></td>';
          if (k === 'phone') return '<td data-l="' + c[1] + '"><input class="cell" data-id="' + d.id + '" data-k="phone" value="' + esc(val) + '" readonly title="누르면 전화 · 길게 누르거나 더블클릭하면 수정">' + phBadge(d.phone, d.application_id || null, d.id) + '</td>';
          if (k === 'name') return '<td class="nm" data-l="성명"><b><input class="cell" data-id="' + d.id + '" data-k="name" value="' + esc(val) + '"></b></td>';
          if (k === 'ssn') return '<td data-l="주민번호"><input class="cell ssn" data-id="' + d.id + '" data-k="ssn" data-full="' + esc(fmtSsn(d.ssn)) + '" value="' + esc(maskSsn(d.ssn)) + '" maxlength="14" autocomplete="off" placeholder="000000-0000000"></td>';
          if (t === 'd') return '<td data-l="가입일"><input class="cell" type="text" inputmode="numeric" maxlength="10" data-id="' + d.id + '" data-k="' + k + '" data-n="d" placeholder="날짜 입력" value="' + esc(val) + '"></td>';
          return '<td data-l="' + c[1] + '"><input class="' + cls + '" data-id="' + d.id + '" data-k="' + k + '" data-n="' + (t || '') + '" value="' + esc(val) + '"' + '' + '></td>';
        }).join('') + (showLic ? licTd(d) : '') + (showSelf ? selTd(d) : '') + '</tr>';
      }).join('') + '</tbody><tfoot><tr class="tf"><td class="ck"></td>' + VC.map(function (c) { var k = c[0]; if (k === 'name') return '<td class="nm"><b>합계</b></td>'; if (k === 'joined_at') return '<td><b>합계</b></td>'; if (['callmaner_cost', 'deposit_amount', 'daily_fee', 'insurance_cost', 'chang_fee', 'total_cost', 'margin'].indexOf(k) >= 0) return '<td><b>' + n0(sum(k)) + '</b></td>'; return '<td></td>'; }).join('') + (showLic ? '<td></td>' : '') + (showSelf ? '<td></td>' : '') + '</tr></tfoot></table></div>' + pagerHtml + (rows.length ? '' : '<div class="mut" style="padding:20px;text-align:center">아직 기사가 없어요. 가입 신청에서 "가입 완료 처리"를 하면 아래에 순서대로 추가돼요.</div>');
    $$('.dk', v).forEach(function (c) { c.addEventListener('change', function () { if (c.checked) dsel[c.getAttribute('data-id')] = 1; else delete dsel[c.getAttribute('data-id')]; viewDrivers(v); }); });
    $('#dselall', v).addEventListener('change', function () { var on = this.checked; rows.forEach(function (d) { if (on) dsel[d.id] = 1; else delete dsel[d.id]; }); viewDrivers(v); });
    $('#dseldel', v).addEventListener('click', function () { deleteDrivers(rows.filter(function (d) { return dsel[d.id]; }), false); });
    $('#dalldel', v).addEventListener('click', function () { deleteDrivers(drivers.slice(), true); });
    (function () { var el = $('#dq', v), tm = null, comp = false;
      var go = function () { dq = el.value; dpage = 1; dsel = {}; var p = el.selectionStart; viewDrivers(v); var e2 = $('#dq', v); e2.focus(); try { e2.setSelectionRange(p, p); } catch (x) { } };
      el.addEventListener('compositionstart', function () { comp = true; }); el.addEventListener('compositionend', function () { comp = false; clearTimeout(tm); tm = setTimeout(go, 250); });
      el.addEventListener('input', function () { if (comp) return; clearTimeout(tm); tm = setTimeout(go, 250); }); })();
    $$('input.ssn', v).forEach(function (i) {
      i.addEventListener('focus', function () { i.value = i.getAttribute('data-full') || ''; });
      i.addEventListener('input', function () { var d = i.value.replace(/[^0-9]/g, '').slice(0, 13); i.value = d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d; });
      i.addEventListener('blur', function () { i.value = maskSsn(i.value); });
    });
    $$('input.cell[data-k="phone"]', v).forEach(function (i) {
      var tm = null;
      function edit() { i.readOnly = false; i.classList.add('ed'); i.focus(); i.select(); }
      i.addEventListener('click', function () { if (!i.readOnly) return; var dg = i.value.replace(/[^0-9]/g, ''); if (dg) location.href = 'tel:' + dg; });
      i.addEventListener('dblclick', edit);
      i.addEventListener('touchstart', function () { tm = setTimeout(function () { tm = null; edit(); }, 600); }, { passive: true });
      ['touchend', 'touchmove', 'touchcancel'].forEach(function (e) { i.addEventListener(e, function () { if (tm) { clearTimeout(tm); tm = null; } }, { passive: true }); });
      i.addEventListener('contextmenu', function (e) { if (i.readOnly) e.preventDefault(); });
      i.addEventListener('blur', function () { i.readOnly = true; i.classList.remove('ed'); });
    });
    $$('th.sk', v).forEach(function (th) { th.addEventListener('click', function (e) {
      if (e.target.closest('.fb')) return;
      var k = th.getAttribute('data-sk');
      if (dsort.k !== k) { dsort.k = k; dsort.dir = 1; } else if (dsort.dir === 1) dsort.dir = -1; else { dsort.k = null; dsort.dir = 1; }
      viewDrivers(v); }); });
    $('#dcols', v).addEventListener('click', function (e) { e.stopPropagation(); colPicker(this, v); });
    $('#dfm', v).addEventListener('click', function () { dfm = !dfm; closePop(); viewDrivers(v); });
    $$('.fb', v).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); var th = b.closest('th'); if ($('#dpop') && $('#dpop').getAttribute('data-k') === b.getAttribute('data-fb')) { closePop(); return; } openFPop(b.getAttribute('data-fb'), th, v); }); });
    $$('.sc[data-st]', v).forEach(function (b) { b.addEventListener('click', function () { var t = b.getAttribute('data-st'); if (t) dfv.status = [t]; else delete dfv.status; dpage = 1; dsel = {}; viewDrivers(v); }); });
    $$('.fchip[data-x]', v).forEach(function (c) { c.addEventListener('click', function () { var k = c.getAttribute('data-x'); if (k === '_sort') dsort = { k: null, dir: 1 }; else delete dfv[k]; dpage = 1; dsel = {}; viewDrivers(v); }); });
    var fc = $('#dfclr', v); if (fc) fc.addEventListener('click', function () { dfv = {}; dsort = { k: null, dir: 1 }; dpage = 1; dsel = {}; viewDrivers(v); });
    $$('[data-pg]', v).forEach(function (b) { b.addEventListener('click', function () { dpage = parseInt(b.getAttribute('data-pg'), 10); viewDrivers(v); }); });
    var dz = $('#dsz', v); if (dz) dz.addEventListener('change', function () { dsize = parseInt(this.value, 10); dpage = 1; viewDrivers(v); });
    $$('.note', v).forEach(function (n) { n.addEventListener('click', function () { noteModal(drivers.filter(function (x) { return x.id === n.getAttribute('data-id'); })[0], v); }); });
    $$('input.cell, select.cell', v).forEach(function (i) {
      i.addEventListener('change', function () {
        var k = i.getAttribute('data-k'), val = i.value.trim(), id = i.getAttribute('data-id'), upd = {};
        var d = drivers.filter(function (x) { return x.id === id; })[0];
        if (k === 'ssn') { var dg = val.replace(/[^0-9]/g, ''); if (dg && dg.length !== 13) { toast('주민번호는 13자리로 입력해 주세요'); i.value = maskSsn(d.ssn); return; } val = dg ? fmtSsn(dg) : null; }
        else if (k === 'emp_no') { var en = pno(val); if (en == null) { toast('사번은 숫자로 입력해 주세요'); i.value = fno(d.emp_no); return; } if (en === 0 && (d.status || '가입') !== '퇴사') { toast('0000 사번은 퇴사자만 쓸 수 있어요'); i.value = fno(d.emp_no); return; } if (en !== 0 && drivers.some(function (x) { return x.id !== id && x.emp_no === en; })) { toast('이미 사용 중인 사번이에요'); i.value = fno(d.emp_no); return; } val = en; }
        else if (i.getAttribute('data-n') === 'n') { val = val === '' ? 0 : parseInt(val.replace(/[^0-9\-]/g, ''), 10); if (isNaN(val)) { toast('숫자만 입력해 주세요'); return; } }
        else if (k === 'phone') val = val.replace(/[^0-9]/g, '');
        else if (k === 'joined_at') { var dd = val === '' ? '' : toDate(val); if (dd == null) { toast('가입일은 2026-10-28 형식으로 입력해 주세요'); i.value = d.joined_at || ''; return; } val = dd || null; i.value = dd || ''; }
        else if (k !== 'name') val = val || null;
        upd[k] = val;
        if (k === 'daily_fee') upd.total_cost = calcTotal(val);
        if (['daily_fee', 'total_cost', 'chang_fee', 'insurance_cost', 'callmaner_cost'].indexOf(k) >= 0) { var nd = {}, q; for (q in d) nd[q] = d[q]; for (q in upd) nd[q] = upd[q]; upd.margin = calcMargin(nd.total_cost, nd.chang_fee, nd.insurance_cost, nd.callmaner_cost); }
        sb.from('golddriver_drivers').update(upd).eq('id', id).then(function (r) {
          if (r.error) { toast('저장 실패: ' + (/duplicate/.test(r.error.message) ? '이미 사용 중인 사번이에요' : r.error.message)); if (k === 'emp_no') i.value = fno(d.emp_no); return; }
          for (var x in upd) d[x] = upd[x];
          if (k === 'emp_no') { viewDrivers(v); return; }
          if (i.getAttribute('data-n') === 'n' && k !== 'emp_no') i.value = n0(d[k]);
          if (k === 'ssn') { i.setAttribute('data-full', fmtSsn(val)); i.value = maskSsn(val); }
          if (upd.total_cost !== undefined || upd.margin !== undefined) { viewDrivers(v); } else { i.style.background = '#e8f7ee'; setTimeout(function () { i.style.background = ''; }, 700); }
          logAct((d.name || '') + ' 기사 ' + (DCOL.filter(function (c) { return c[0] === k; })[0][1]) + ' 수정', d.application_id);
        });
      });
    });
    var vi = function (k) { var i = VC.map(function (c) { return c[0]; }).indexOf(k); return i < 0 ? -1 : i + 1; }, mgi = vi('margin');
    $$('table.dt tr', v).forEach(function (tr) { if (mgi > 0 && tr.children[mgi]) tr.children[mgi].classList.add('mg'); });
    var ams = ['callmaner_cost', 'daily_fee', 'insurance_cost', 'chang_fee', 'total_cost', 'margin'].map(function (k) { return vi(k); });
    $$('table.dt tr', v).forEach(function (tr) { ams.forEach(function (i) { if (i > 0 && tr.children[i]) tr.children[i].classList.add('am'); }); });
    setOvf();
    $('#dadd', v).addEventListener('click', function (e) { e.stopPropagation(); toggleAddMenu($('#dadd', v)); });
    $$('.lcb', v).forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-lic') || b.getAttribute('data-self'), d = drivers.filter(function (x) { return x.id === id; })[0]; if (d) licModal(d, function () { viewDrivers(v); }, b.getAttribute('data-self') ? 'self' : 'lic'); }); });
    $('#dshare', v).addEventListener('click', function () { driverShare(rows.filter(function (d) { return dsel[d.id]; })); });
    $('#dxl', v).addEventListener('click', function () { exportDriversXlsx(rows); });
    $('#dup', v).addEventListener('click', function () { $('#dfile', v).click(); });
    $('#dfile', v).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) importDrivers(f); });
  }
  /* ---------- v2.0 공통: 필터 · 정렬 · 페이지 ---------- */
  function FILT_OK(k) { return k !== 'ssn' && k !== 'note'; }
  function dcol(k) { return DCOL.filter(function (x) { return x[0] === k; })[0] || (k === 'selfie' ? ['selfie', '셀프 사진'] : ['license', '면허증']); }
  function cstr(d, c) { var k = c[0]; if (k === 'license') return licPathOf(d) ? '등록됨' : '없음'; if (k === 'selfie') return selfPathOf(d) ? '등록됨' : '없음'; if (k === 'status') return d.status || '가입'; var x = d[k]; if (x == null || x === '') return ''; if (k === 'emp_no') return String(fno(x)); if (k === 'phone') return fmtPhone(x); if (c[2] === 'n' && k !== 'emp_no') return n0(x); return String(x); }
  function dfCount() { return Object.keys(dfv).filter(function (k) { return dfv[k]; }).length; }
  function dRows() {
    var ks = Object.keys(dfv).filter(function (k) { return dfv[k]; }), ql = dq.toLowerCase();
    return drivers.filter(function (d) {
      if (ql && (d.name + d.phone + d.emp_no + fno(d.emp_no) + (d.team || '') + (d.deposit_group || '') + (d.ins_company || '')).toLowerCase().indexOf(ql) < 0) return false;
      return ks.every(function (k) { return dfv[k].indexOf(cstr(d, dcol(k))) >= 0; });
    }).sort(dcmp);
  }
  function chipsH() {
    var ks = Object.keys(dfv).filter(function (k) { return dfv[k]; }), o = '';
    ks.forEach(function (k) { var vs = dfv[k].map(function (x) { return x === '' ? '(빈 값)' : x; }); o += '<button class="fchip" data-x="' + k + '">' + esc(dcol(k)[1]) + ': ' + esc(vs.slice(0, 2).join(', ') + (vs.length > 2 ? ' 외 ' + (vs.length - 2) : '')) + ' ✕</button>'; });
    if (dsort.k) o += '<button class="fchip" data-x="_sort">정렬: ' + esc(dcol(dsort.k)[1]) + (dsort.dir > 0 ? ' ▲' : ' ▼') + ' ✕</button>';
    return o ? '<div class="fchips">' + o + '<button class="btn sm line" id="dfclr">모두 해제</button></div>' : '';
  }
  function pagerH(total, pages, start, n) {
    if (!total) return '';
    var o = '<div class="pager"><span class="mut">' + (start + 1) + '–' + (start + n) + ' / ' + total + '명</span>';
    if (dsize && pages > 1) {
      var nums = [], i; for (i = 1; i <= pages; i++) if (pages <= 7 || i === 1 || i === pages || Math.abs(i - dpage) <= 1) nums.push(i);
      o += '<button class="pg" data-pg="' + Math.max(1, dpage - 1) + '"' + (dpage === 1 ? ' disabled' : '') + '>◀</button>';
      var last = 0; nums.forEach(function (i) { if (last && i - last > 1) o += '<span class="mut">…</span>'; o += '<button class="pg' + (i === dpage ? ' on' : '') + '" data-pg="' + i + '">' + i + '</button>'; last = i; });
      o += '<button class="pg" data-pg="' + Math.min(pages, dpage + 1) + '"' + (dpage === pages ? ' disabled' : '') + '>▶</button>';
    }
    return o + '<select id="dsz"><option value="50"' + (dsize === 50 ? ' selected' : '') + '>50명씩</option><option value="100"' + (dsize === 100 ? ' selected' : '') + '>100명씩</option><option value="0"' + (dsize === 0 ? ' selected' : '') + '>전체 보기 (' + total + '명)</option></select></div>';
  }
  function colPicker(btn, v) {
    var old = $('#dpop'); if (old && old.getAttribute('data-k') === '_cols') { closePop(); return; }
    closePop();
    var pp = document.createElement('div'); pp.className = 'dpop cpick'; pp.id = 'dpop'; pp.setAttribute('data-k', '_cols');
    var r = btn.getBoundingClientRect(); pp.style.top = (r.bottom + 4) + 'px'; pp.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 480)) + 'px';
    var names = DCOL.map(function (c) { return [c[0], c[1]]; }).concat([['license', '면허증'], ['selfie', '셀프 사진']]);
    pp.innerHTML = '<div class="cph">표시할 열 <small>체크한 열만 보여요</small></div><div class="cpg">' + names.map(function (n) { return '<label><input type="checkbox" data-c="' + n[0] + '"' + (dvis.indexOf(n[0]) >= 0 ? ' checked' : '') + '> ' + n[1] + '</label>'; }).join('') + '</div><div class="pa"><button class="btn sm" data-def>기본값</button><button class="btn sm line" data-allc>모두 선택</button><button class="btn sm line" data-noc>모두 해제</button></div><div class="mut" style="font-size:12px;margin-top:6px">「성명」은 고정 열이라 모두 해제해도 남아요</div>';
    document.body.appendChild(pp);
    var apply = function () { closePop(); saveVis(); viewDrivers(v); var b2 = $('#dcols', v); if (b2) colPicker(b2, v); };
    pp.addEventListener('change', function (e) { var t = e.target, k = t.getAttribute('data-c'); if (!k) return; var set = DCOL.map(function (c) { return c[0]; }).concat(['license', 'selfie']).filter(function (x) { return x === k ? t.checked : dvis.indexOf(x) >= 0; }); if (!set.length) { toast('하나 이상 선택해 주세요'); t.checked = true; return; } dvis = set; apply(); });
    $('[data-def]', pp).addEventListener('click', function () { dvis = DDEF.slice(); apply(); });
    $('[data-allc]', pp).addEventListener('click', function () { dvis = allKeys(); apply(); });
    $('[data-noc]', pp).addEventListener('click', function () { dvis = ['name']; apply(); });
    setTimeout(function () { var h = function (e) { var q = $('#dpop'); if (!q || q.contains(e.target) || e.target.closest('#dcols')) { if (!q) document.removeEventListener('mousedown', h); return; } closePop(); document.removeEventListener('mousedown', h); }; document.addEventListener('mousedown', h); }, 0);
  }
  function closePop() { var p = $('#dpop'); if (p) p.remove(); }
  document.addEventListener('mousedown', function (e) { var p = $('#dpop'); if (p && !p.contains(e.target) && !e.target.closest('.fb')) p.remove(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
  function openFPop(k, anchor, v) {
    closePop();
    var c = dcol(k), seen = {}, vals = [];
    drivers.forEach(function (d) { var x = cstr(d, c); if (!seen[x]) { seen[x] = 1; vals.push(x); } });
    vals.sort(function (a, b) { if (a === '') return 1; if (b === '') return -1; if (c[2] === 'n' || k === 'status') return c[2] === 'n' ? num(a) - num(b) : a.localeCompare(b, 'ko'); return a.localeCompare(b, 'ko'); });
    var sel = {}; (dfv[k] || vals).forEach(function (x) { sel[x] = 1; });
    var p = document.createElement('div'); p.className = 'dpop'; p.id = 'dpop'; p.setAttribute('data-k', k);
    var r = anchor.getBoundingClientRect(); p.style.top = (r.bottom + 4) + 'px'; p.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 268)) + 'px';
    p.innerHTML = '<button class="pi" data-s="1">↑ 오름차순 정렬</button><button class="pi" data-s="-1">↓ 내림차순 정렬</button><hr><input class="ps" placeholder="' + esc(c[1]) + ' 검색" autocomplete="off"><div class="pl"></div><div class="pa"><button class="btn sm" data-ok>적용</button><button class="btn sm line" data-clr>이 열 해제</button></div>';
    document.body.appendChild(p);
    var q = '', vis = [];
    function list(reset) {
      vis = vals.filter(function (x) { return !q || (x === '' ? '(빈 값)' : x).toLowerCase().indexOf(q) >= 0; });
      if (reset) { sel = {}; vis.forEach(function (x) { sel[x] = 1; }); }
      var all = vis.length > 0 && vis.every(function (x) { return sel[x]; });
      $('.pl', p).innerHTML = '<label><input type="checkbox" data-all' + (all ? ' checked' : '') + '> (전체 선택)</label>' + vis.map(function (x, i) { return '<label><input type="checkbox" data-i="' + i + '"' + (sel[x] ? ' checked' : '') + '> ' + esc(x === '' ? '(빈 값)' : x) + '</label>'; }).join('');
    }
    list(false);
    $('.ps', p).addEventListener('input', function () { q = this.value.trim().toLowerCase(); list(!!q); });
    p.addEventListener('change', function (e) { var t = e.target; if (t.hasAttribute('data-all')) { vis.forEach(function (x) { if (t.checked) sel[x] = 1; else delete sel[x]; }); list(false); } else if (t.hasAttribute('data-i')) { var x = vis[parseInt(t.getAttribute('data-i'), 10)]; if (t.checked) sel[x] = 1; else delete sel[x]; var al = $('input[data-all]', p); if (al) al.checked = vis.every(function (y) { return sel[y]; }); } });
    $$('.pi', p).forEach(function (b) { b.addEventListener('click', function () { dsort.k = k; dsort.dir = parseInt(b.getAttribute('data-s'), 10); closePop(); viewDrivers(v); }); });
    $('[data-ok]', p).addEventListener('click', function () {
      var chosen = vals.filter(function (x) { return sel[x]; });
      if (!chosen.length) { toast('하나 이상 선택해 주세요'); return; }
      if (chosen.length === vals.length) delete dfv[k]; else dfv[k] = chosen;
      dpage = 1; dsel = {}; closePop(); viewDrivers(v);
    });
    $('[data-clr]', p).addEventListener('click', function () { delete dfv[k]; dpage = 1; dsel = {}; closePop(); viewDrivers(v); });
    $('.ps', p).focus();
  }

  /* ---------- v2.0 모바일 ---------- */
  var MQ = window.matchMedia('(max-width:760px)');
  function isM() { return MQ.matches; }
  var MSORT = [['def', '기본 (가입일·사번순)', null, 1], ['emp_desc', '사번 큰 순', 'emp_no', -1], ['emp_asc', '사번 작은 순', 'emp_no', 1], ['mgn', '순 마진 높은 순', 'margin', -1], ['joined', '최근 가입순', 'joined_at', -1], ['name', '이름 가나다순', 'name', 1]];
  function mTiles(all) {
    var cs = function (x) { return drivers.filter(function (d) { return (d.status || '가입') === x; }).length; }, cur = dfv.status && dfv.status.length === 1 ? dfv.status[0] : '';
    return '<div class="mtiles"><div class="mt tw" data-st="">총 인원<b>' + drivers.length + '</b></div><div class="mt tg" data-st="가입">가입<b>' + cs('가입') + '</b></div><div class="mt ty" data-st="퇴사">퇴사<b>' + cs('퇴사') + '</b></div><div class="mt tr" data-st="미납">미납<b>' + cs('미납') + '</b></div></div>';
  }
  function mHdr(title, extra) { return '<div class="mhdr"><div class="mtop"><div class="lg"><img src="img/logo.png" alt=""><b>' + title + '</b></div><span>총 ' + drivers.length + '명</span></div>' + (extra || '') + '</div>'; }
  function setStatus(st, v, fn) { if (st) dfv.status = [st]; else delete dfv.status; dmore = 50; fn(v); }
  function viewDriversM(v) {
    var rows = dRows(), cur = dfv.status && dfv.status.length === 1 ? dfv.status[0] : '', shown = rows.slice(0, dmore);
    var msum = rows.reduce(function (s2, d) { return s2 + (d.margin || 0); }, 0), sv = 'def';
    MSORT.forEach(function (m) { if (m[2] && dsort.k === m[2] && dsort.dir === m[3]) sv = m[0]; });
    var other = dfCount() - (dfv.status ? 1 : 0);
    v.innerHTML = mHdr('기사 가입 현황', '<input class="msr" id="dq" type="search" placeholder="🔍 이름 · 전화번호 · 사번 검색" value="' + esc(dq) + '" autocomplete="off">' + mTiles()) +
      '<div class="mchips">' + [['', '전체'], ['가입', '가입'], ['퇴사', '퇴사'], ['미납', '미납']].map(function (c) { return '<button class="mc2' + (cur === c[0] ? ' on' : '') + '" data-st="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '<button class="mc2' + (other ? ' on' : '') + '" id="mfl">▾ 필터' + (other ? ' (' + other + ')' : '') + '</button></div>' +
      '<div class="mmeta"><span>전체 <b>' + rows.length + '명</b> · <span class="mpill">순 마진 ' + n0(msum) + '원</span></span><select id="msort">' + MSORT.map(function (m) { return '<option value="' + m[0] + '"' + (sv === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="mlist">' + shown.map(function (d) {
        var ph = String(d.phone || '').replace(/[^0-9]/g, '');
        return '<div class="mcard" data-id="' + d.id + '"><div class="r1"><div class="av">' + esc((d.name || '?').charAt(0)) + '</div><div class="mnm"><div class="nm">' + esc(d.name) + ' <span class="pill st-' + esc(d.status || '가입') + '">' + esc(d.status || '가입') + '</span>' + (licPathOf(d) ? '' : '<span class="pill nolic">면허증 없음</span>') + '</div><div class="sub">사번 ' + fno(d.emp_no) + (d.source ? ' <span class="pill src">' + esc(d.source) + '</span>' : '') + '</div></div><div class="mgn"><span>순 마진</span><b>' + n0(d.margin) + '</b></div></div>' +
          '<div class="mcall">' + (ph ? '<a class="callb" href="tel:' + ph + '">📞 ' + fmtPhone(ph) + '</a>' : '<span class="callb off">전화번호 없음</span>') + '<button class="edb" data-id="' + d.id + '">✎</button></div></div>';
      }).join('') + (rows.length ? '' : '<div class="mut" style="padding:24px;text-align:center">조건에 맞는 기사가 없어요</div>') +
      (rows.length > dmore ? '<button class="btn dark mmore" id="mmore">더 보기 (남은 ' + (rows.length - dmore) + '명)</button>' : '') + '</div><button class="mfab" id="madd">＋</button>';
    (function () { var el = $('#dq', v), tm = null, comp = false;
      var go = function () { dq = el.value; dmore = 50; var p = el.selectionStart; viewDriversM(v); var e2 = $('#dq', v); e2.focus(); try { e2.setSelectionRange(p, p); } catch (x) { } };
      el.addEventListener('compositionstart', function () { comp = true; }); el.addEventListener('compositionend', function () { comp = false; clearTimeout(tm); tm = setTimeout(go, 250); });
      el.addEventListener('input', function () { if (comp) return; clearTimeout(tm); tm = setTimeout(go, 250); }); })();
    $$('[data-st]', v).forEach(function (b) { b.addEventListener('click', function () { setStatus(b.getAttribute('data-st'), v, viewDriversM); }); });
    $('#msort', v).addEventListener('change', function () { var m = MSORT.filter(function (x) { return x[0] === this.value; }, this)[0]; dsort = { k: m[2], dir: m[3] }; dmore = 50; viewDriversM(v); });
    var mm = $('#mmore', v); if (mm) mm.addEventListener('click', function () { dmore += 50; viewDriversM(v); });
    $('#madd', v).addEventListener('click', function () { mSpeedDial(); });
    $('#mfl', v).addEventListener('click', function () { mFilterSheet(v); });
    $$('.mcard', v).forEach(function (c) { c.addEventListener('click', function (e) { if (e.target.closest('a')) return; mEdit(c.getAttribute('data-id'), v); }); });
  }
  function mFilterSheet(v) {
    var m = $('#modal'), groups = [['source', '유입 경로'], ['insurance', '보험 종류']], tmp = {};
    groups.forEach(function (g) { tmp[g[0]] = (dfv[g[0]] || []).slice(); });
    function draw() {
      m.innerHTML = '<div class="sheet"><h3>필터</h3>' + groups.map(function (g) {
        var seen = {}, vals = []; drivers.forEach(function (d) { var x = cstr(d, dcol(g[0])); if (x && !seen[x]) { seen[x] = 1; vals.push(x); } }); vals.sort(function (a, b) { return a.localeCompare(b, 'ko'); });
        return '<div class="sg"><b>' + g[1] + '</b><div class="sgc">' + vals.map(function (x) { return '<button class="mc2' + (tmp[g[0]].indexOf(x) >= 0 ? ' on' : '') + '" data-g="' + g[0] + '" data-v="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></div>';
      }).join('') + '<div class="acts"><button class="btn" id="sf-ok">적용</button><button class="btn line" id="sf-clr">초기화</button><button class="btn line" id="sf-no">닫기</button></div></div>';
      $$('[data-g]', m).forEach(function (b) { b.addEventListener('click', function () { var g = b.getAttribute('data-g'), x = b.getAttribute('data-v'), i = tmp[g].indexOf(x); if (i >= 0) tmp[g].splice(i, 1); else tmp[g].push(x); draw(); }); });
      $('#sf-no', m).addEventListener('click', function () { m.hidden = true; });
      $('#sf-clr', m).addEventListener('click', function () { groups.forEach(function (g) { tmp[g[0]] = []; }); draw(); });
      $('#sf-ok', m).addEventListener('click', function () { groups.forEach(function (g) { if (tmp[g[0]].length) dfv[g[0]] = tmp[g[0]]; else delete dfv[g[0]]; }); dmore = 50; m.hidden = true; viewDriversM(v); });
    }
    draw(); m.hidden = false;
  }
  function mEdit(id, v) {
    var d = drivers.filter(function (x) { return x.id === id; })[0]; if (!d) return;
    var el = $('#medit'), F2 = [['status', '상태', 'sel'], ['joined_at', '가입일', 't'], ['emp_no', '사번', 'i'], ['team', '소속'], ['name', '성명'], ['ssn', '주민번호', 'ssn'], ['phone', '핸드폰', 'tel'], ['carrier', '통신사'], ['phone_owner', '명의'], ['programs', '설치 프로그램'], ['ins_company', '보험 회사명'], ['insurance', '보험 종류'], ['deposit_group', '입금 그룹명'], ['deposit_amount', '보증금', 'dep'], ['daily_fee', '일비', 'n'], ['insurance_cost', '실보험료', 'n'], ['chang_fee', '창 비용', 'n'], ['callmaner_cost', '콜마너 비용', 'n'], ['total_cost', '월 합산 비용', 'ro'], ['margin', '순 마진', 'mg'], ['source', '유입 경로', 'src'], ['note', '비고', 'ta']];
    var ph = String(d.phone || '').replace(/[^0-9]/g, '');
    el.innerHTML = '<div class="me"><div class="meh"><button id="me-back">‹</button><b>' + esc(d.name) + ' (' + fno(d.emp_no) + ')</b><span class="pill st-' + esc(d.status || '가입') + '">' + esc(d.status || '가입') + '</span></div><div class="meb"><div class="liccard"><div><b>운전면허증</b><span id="me-licst">' + (licPathOf(d) ? '등록됨' : '아직 등록되지 않았어요') + '</span></div><button class="btn sm" id="me-lic">' + (licPathOf(d) ? '보기 · 교체' : '＋ 등록') + '</button></div><div class="liccard"><div><b>본인 셀프 사진</b><span id="me-selst">' + (selfPathOf(d) ? '등록됨' : '아직 등록되지 않았어요') + '</span></div><button class="btn sm" id="me-self">' + (selfPathOf(d) ? '보기 · 교체' : '＋ 등록') + '</button></div><div class="liccard"><div><b>기사 정보 공유</b><span>글 · 사진을 카카오톡 · 문자로</span></div><button class="btn sm" id="me-sh">공유</button></div>' + F2.map(function (f) {
      var k = f[0], val = d[k], t = f[2] || '', inp;
      if (t === 'sel') inp = '<select id="me-' + k + '">' + STS.map(function (x) { return '<option' + ((d.status || '가입') === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>';
      else if (t === 'ta') inp = '<textarea id="me-' + k + '" rows="4">' + esc(val || '') + '</textarea>';
      else if (t === 'ro' || t === 'mg') inp = '<input id="me-' + k + '" value="' + n0(val) + '" readonly>';
      else if (t === 'dep') inp = '<input id="me-' + k + '" inputmode="numeric" value="' + n0(val) + '">' + depChips('me-' + k);
      else if (t === 'n') inp = '<input id="me-' + k + '" inputmode="numeric" value="' + n0(val) + '">';
      else if (t === 'ssn') inp = '<input id="me-' + k + '" value="' + esc(maskSsn(d.ssn)) + '" data-full="' + esc(fmtSsn(d.ssn)) + '" maxlength="14" autocomplete="off" placeholder="000000-0000000">';
      else if (t === 'tel') inp = '<input id="me-' + k + '" inputmode="tel" value="' + esc(fmtPhone(d.phone)) + '">';
      else if (t === 'i') inp = '<input id="me-' + k + '" inputmode="numeric" value="' + esc(val == null ? '' : (k === 'emp_no' ? fno(val) : val)) + '">';
      else if (t === 't') inp = '<input id="me-' + k + '" inputmode="numeric" maxlength="10" placeholder="2026-10-28" value="' + esc(val || '') + '">';
      else inp = '<input id="me-' + k + '"' + (t === 'src' ? ' list="srcl"' : '') + ' value="' + esc(val == null ? '' : val) + '">';
      return '<div class="kvm' + (t === 'mg' ? ' mgrow' : '') + (t === 'ta' ? ' ta' : '') + '"><span>' + f[1] + '</span>' + inp + '</div>';
    }).join('') + '<datalist id="srcl">' + SRC.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist></div>' +
      '<div class="mef">' + (ph ? '<a class="callb" href="tel:' + ph + '">📞 전화</a>' : '<span class="callb off">전화 없음</span>') + '<button class="btn" id="me-save">저장</button><button class="btn red" id="me-del">삭제</button></div></div>';
    el.hidden = false; document.body.classList.add('noscroll');
    var close = function () { el.hidden = true; document.body.classList.remove('noscroll'); };
    money(['#me-deposit_amount', '#me-daily_fee', '#me-insurance_cost', '#me-chang_fee', '#me-callmaner_cost']);
    var ssn = $('#me-ssn'); ssn.addEventListener('focus', function () { ssn.value = ssn.getAttribute('data-full') || ''; });
    ssn.addEventListener('input', function () { var x = ssn.value.replace(/[^0-9]/g, '').slice(0, 13); ssn.value = x.length > 6 ? x.slice(0, 6) + '-' + x.slice(6) : x; });
    ssn.addEventListener('blur', function () { ssn.setAttribute('data-full', ssn.value); ssn.value = maskSsn(ssn.value); });
    var tot = function () { return $('#me-daily_fee').value !== n0(d.daily_fee) ? calcTotal($('#me-daily_fee').value) : (d.total_cost || 0); };
    var recalc = function () { var t2 = tot(); $('#me-total_cost').value = n0(t2); $('#me-margin').value = n0(calcMargin(t2, $('#me-chang_fee').value, $('#me-insurance_cost').value, $('#me-callmaner_cost').value)); };
    ['daily_fee', 'insurance_cost', 'chang_fee', 'callmaner_cost'].forEach(function (k) { $('#me-' + k).addEventListener('input', recalc); });
    $('#me-back').addEventListener('click', close);
    $('#me-lic').addEventListener('click', function () { licModal(d, function () { $('#me-licst').textContent = licPathOf(d) ? '등록됨' : '아직 등록되지 않았어요'; $('#me-lic').textContent = licPathOf(d) ? '보기 · 교체' : '＋ 등록'; }); });
    $('#me-self').addEventListener('click', function () { licModal(d, function () { $('#me-selst').textContent = selfPathOf(d) ? '등록됨' : '아직 등록되지 않았어요'; $('#me-self').textContent = selfPathOf(d) ? '보기 · 교체' : '＋ 등록'; }, 'self'); });
    $('#me-sh').addEventListener('click', function () { driverShare([d]); });
    $('#me-del').addEventListener('click', function () { close(); deleteDrivers([d], false); });
    $('#me-save').addEventListener('click', function () {
      var g = function (k) { return $('#me-' + k).value.trim(); }, btn = this, upd = {};
      var nm = g('name'); if (!nm) { toast('성명을 입력해 주세요'); return; }
      var en = pno(g('emp_no')); if (en == null) { toast('사번은 숫자로 입력해 주세요'); return; }
      if (en === 0 && g('status') !== '퇴사') { toast('0000 사번은 퇴사자만 쓸 수 있어요'); return; }
      if (en !== 0 && drivers.some(function (x) { return x.id !== d.id && x.emp_no === en; })) { toast('이미 사용 중인 사번이에요'); return; }
      var sd = ssn.value.replace(/[^0-9]/g, ''); if (document.activeElement !== ssn && ssn.getAttribute('data-full') != null && ssn.value.indexOf('*') >= 0) sd = ssn.getAttribute('data-full').replace(/[^0-9]/g, '');
      if (sd && sd.length !== 13) { toast('주민번호는 13자리로 입력해 주세요'); return; }
      var jd = g('joined_at'), jv = jd === '' ? null : toDate(jd); if (jd !== '' && jv == null) { toast('가입일은 2026-10-28 형식으로 입력해 주세요'); return; }
      var total = tot(), cmp = {
        status: g('status'), joined_at: jv, emp_no: en, team: g('team') || null, name: nm, ssn: sd ? fmtSsn(sd) : null, phone: g('phone').replace(/[^0-9]/g, '') || null, ins_company: g('ins_company') || null, insurance: g('insurance') || null, deposit_group: g('deposit_group') || null, carrier: g('carrier') || null, phone_owner: g('phone_owner') || null, programs: g('programs') || null,
        deposit_amount: num(g('deposit_amount')), daily_fee: num(g('daily_fee')), insurance_cost: num(g('insurance_cost')), chang_fee: num(g('chang_fee')), callmaner_cost: num(g('callmaner_cost')), total_cost: total, margin: calcMargin(total, g('chang_fee'), g('insurance_cost'), g('callmaner_cost')), source: g('source') || null, note: g('note') || null };
      for (var k in cmp) if ((cmp[k] == null ? '' : cmp[k]) !== (d[k] == null ? '' : d[k])) upd[k] = cmp[k];
      if (!Object.keys(upd).length) { close(); return; }
      btn.disabled = true;
      sb.from('golddriver_drivers').update(upd).eq('id', d.id).then(function (r) {
        if (r.error) { btn.disabled = false; toast('저장 실패: ' + (/duplicate/.test(r.error.message) ? '이미 사용 중인 사번이에요' : r.error.message), 5000); return; }
        for (var x in upd) d[x] = upd[x];
        logAct(nm + ' 기사 정보 수정 (' + Object.keys(upd).map(function (k) { return dcol(k)[1]; }).join(', ') + ')', d.application_id);
        close(); toast('저장했어요'); render();
      });
    });
  }

  /* ---------- v2.0 통계 · 더보기 ---------- */
  function viewStats(v) {
    var m = isM(), base = dstatAll ? drivers : drivers.filter(function (d) { return (d.status || '가입') === '가입'; }), now = new Date();
    var mk = function (dt) { return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2); };
    var cnt = {}; base.forEach(function (d) { if (d.joined_at) { var k = String(d.joined_at).slice(0, 7); cnt[k] = (cnt[k] || 0) + 1; } });
    var months = [], i; for (i = 5; i >= 0; i--) { var dt = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push([mk(dt), (dt.getMonth() + 1) + '월']); }
    var thisM = cnt[months[5][0]] || 0, lastM = cnt[months[4][0]] || 0, mx = Math.max.apply(null, months.map(function (x) { return cnt[x[0]] || 0; }).concat([1]));
    var msum = base.reduce(function (s2, d) { return s2 + (d.margin || 0); }, 0);
    var grp = function (k) { var o = {}; base.forEach(function (d) { var x = d[k] == null || d[k] === '' ? '(미입력)' : d[k]; if (!o[x]) o[x] = [0, 0]; o[x][0]++; o[x][1] += d.margin || 0; }); return Object.keys(o).map(function (x) { return [x, o[x][0], o[x][1]]; }).sort(function (a, b) { return b[1] - a[1]; }); };
    var bars = function (arr, field, withM) { var top = arr.slice(0, 8), rest = arr.slice(8), max = Math.max.apply(null, top.map(function (x) { return x[1]; }).concat([1]));
      return top.map(function (x) { return '<div class="sbar" data-f="' + field + '" data-v="' + esc(x[0] === '(미입력)' ? '' : x[0]) + '"><span class="l">' + esc(x[0]) + '</span><span class="b"><i style="width:' + Math.round(x[1] * 100 / max) + '%"></i></span><span class="n">' + x[1] + '명' + (withM ? ' · ' + n0(x[2]) : '') + '</span></div>'; }).join('') +
        (rest.length ? '<div class="sbar"><span class="l">기타 ' + rest.length + '종</span><span class="b"></span><span class="n">' + rest.reduce(function (a, x) { return a + x[1]; }, 0) + '명</span></div>' : ''); };
    if (!smon) smon = mk(now);
    var sy = +smon.slice(0, 4), sm = +smon.slice(5, 7), sc = cnt[smon] || 0, diff = sc - (cnt[mk(new Date(sy, sm - 2, 1))] || 0);
    var slist = base.filter(function (d) { return d.joined_at && String(d.joined_at).slice(0, 7) === smon; }).sort(function (x, y) { return String(x.joined_at) < String(y.joined_at) ? -1 : String(x.joined_at) > String(y.joined_at) ? 1 : (x.emp_no || 0) - (y.emp_no || 0); });
    var mgrid = '<div class="mgrid">' + [1,2,3,4,5,6,7,8,9,10,11,12].map(function (n) { var k = sy + '-' + ('0' + n).slice(-2), c = cnt[k] || 0; return '<button data-sm="' + k + '" class="' + (k === smon ? 'on' : '') + (c ? '' : ' z') + '">' + n + '월<small>' + (c ? c + '명' : '-') + '</small></button>'; }).join('') + '</div>';
    var body = '<div class="seg"><button data-sa="0" class="' + (dstatAll ? '' : 'on') + '">가입 기사만</button><button data-sa="1" class="' + (dstatAll ? 'on' : '') + '">전체</button></div>' +
      '<div class="spanel mgc"><h5>순 마진 합계 <span>' + (dstatAll ? '전체' : '가입 기사') + ' 기준</span></h5><b>' + n0(msum) + '원</b></div><!--SPLIT-->' +
      '<div class="spanel"><div class="mnav"><button class="btn sm line" id="sm-p">◀</button><b id="sm-l">' + sy + '년 ' + sm + '월</b><button class="btn sm line" id="sm-n">▶</button><button class="btn sm line" id="sm-t">이번 달</button></div><div class="mhead"><span class="mut">월별 신규 가입 · 가입일 기준</span><div class="big">' + sc + '명 <small class="' + (diff >= 0 ? 'up' : 'dn') + '">' + (diff >= 0 ? '▲' : '▼') + ' 지난달보다 ' + (diff >= 0 ? '+' : '') + diff + '</small></div></div>' + mgrid + '</div>' +
      '<div class="spanel"><h5>' + sy + '년 ' + sm + '월 가입 기사 (' + sc + '명) <span>이름을 누르면 내용 확인</span></h5>' + (slist.length ? '<div class="slist">' + slist.map(function (d) { return '<div class="sdr" data-did="' + d.id + '"><b>' + esc(d.name) + '</b><span>' + esc(String(d.joined_at)) + '</span><span>' + esc(d.insurance || '-') + '</span><span>' + esc(d.team || '') + '</span></div>'; }).join('') + '</div>' : '<div class="mut" style="padding:8px 0">이 달에 가입한 기사가 없어요</div>') + '</div>' +
      '<div class="spanel"><h5>월별 가입 추이 <span>최근 6개월</span></h5><div class="mbars">' + months.map(function (x, idx) { var c = cnt[x[0]] || 0; return '<div><b>' + c + '</b><i class="' + (idx === 5 ? 'cur' : '') + '" style="height:' + Math.max(3, Math.round(c * 70 / mx)) + 'px"></i><span>' + x[1] + '</span></div>'; }).join('') + '</div>' + (Object.keys(cnt).length ? '' : '<div class="mut" style="font-size:12px;margin-top:6px">가입일이 입력된 기사가 아직 없어요. 가입일을 입력하면 여기에 쌓여요.</div>') + '</div>' +
      '<div class="spanel"><h5>보험 종류별 <span>인원 · 순 마진 (누르면 목록)</span></h5>' + bars(grp('insurance'), 'insurance', true) + '</div>' +
      '<div class="spanel"><h5>유입 경로별 <span>인원 (누르면 목록)</span></h5>' + bars(grp('source'), 'source', false) + '</div>';
    var sp = body.split('<!--SPLIT-->');
    v.innerHTML = (m ? mHdr('통계', mTiles()) + '<div class="mbody">' + sp.join('') + '</div>' : '<div class="dtop"><h2>통계</h2><div class="sbody">' + sp[0] + '</div></div><div class="sscroll"><div class="sbody">' + sp[1] + '</div></div>');
    var shiftM = function (n) { var dt = new Date(sy, sm - 1 + n, 1); smon = mk(dt); viewStats(v); };
    $('#sm-p', v).addEventListener('click', function () { shiftM(-1); });
    $('#sm-n', v).addEventListener('click', function () { shiftM(1); });
    $('#sm-t', v).addEventListener('click', function () { smon = mk(new Date()); viewStats(v); });
    $$('[data-sm]', v).forEach(function (b) { b.addEventListener('click', function () { smon = b.getAttribute('data-sm'); viewStats(v); }); });
    $$('.sdr[data-did]', v).forEach(function (b) { b.addEventListener('click', function () { driverBrief(drivers.filter(function (x) { return x.id === b.getAttribute('data-did'); })[0]); }); });
    $$('[data-sa]', v).forEach(function (b) { b.addEventListener('click', function () { dstatAll = b.getAttribute('data-sa') === '1'; viewStats(v); }); });
    $$('.mt[data-st]', v).forEach(function (b) { b.addEventListener('click', function () { dfv = {}; if (b.getAttribute('data-st')) dfv.status = [b.getAttribute('data-st')]; tab = 'drivers'; render(); }); });
    $$('.sbar[data-f]', v).forEach(function (b) { b.addEventListener('click', function () { dfv = {}; if (!dstatAll) dfv.status = ['가입']; if (b.getAttribute('data-v')) dfv[b.getAttribute('data-f')] = [b.getAttribute('data-v')]; dq = ''; dmore = 50; dpage = 1; tab = 'drivers'; render(); }); });
  }
  function driverBrief(d) {
    if (!d) return;
    var m = $('#modal'), row = function (l, x) { return '<dt>' + l + '</dt><dd>' + esc(x == null || x === '' ? '-' : String(x)) + '</dd>'; };
    m.innerHTML = '<div class="mbox"><h3>' + esc(d.name) + ' <span class="tag g">' + esc(d.status || '가입') + '</span></h3><dl class="kv">' + row('사번', d.emp_no) + row('가입일', d.joined_at) + row('핸드폰', fmtPhone(d.phone)) + row('통신사', d.carrier) + row('명의', d.phone_owner) + row('설치 프로그램', d.programs) + row('보험 회사', d.ins_company) + row('보험 종류', d.insurance) + row('보증금', n0(d.deposit_amount) + '원') + row('일비', n0(d.daily_fee) + '원') + row('월 합산 비용', n0(d.total_cost) + '원') + '</dl><div class="acts"><button class="btn" id="db-go">기사 가입 현황에서 보기</button><button class="btn line" id="db-x">닫기</button></div></div>';
    m.hidden = false;
    $('#db-x', m).addEventListener('click', function () { m.hidden = true; });
    $('#db-go', m).addEventListener('click', function () { m.hidden = true; dfv = {}; dq = d.name; dmore = 50; dpage = 1; tab = 'drivers'; render(); });
  }
  function viewMore(v) {
    var it = [['stats', '📊', '통계', '보험 종류별 · 유입 경로별 · 월별 가입'], ['rates', '🧮', '보험료 계산', '월보험 · 건당보험 안내 · 금액 수정'], ['log', '🗂', '처리 기록', '누가 무엇을 했는지'], ['claim', '☎', '보험사 사고접수', '보험사 번호 · 누르면 전화']];
    var it2 = [['xd', '⬇', '엑셀 다운로드', '현재 목록을 .xlsx 로 저장'], ['xu', '⬆', '엑셀 업로드', '사번이 같으면 건너뜀'], ['bk', '💾', '백업 · 복원', '가입 현황 + 신청 전체']];
    var row = function (x, red) { return '<div class="mi' + (red ? ' red' : '') + '" data-m="' + x[0] + '"><i>' + x[1] + '</i><div><b>' + x[2] + '</b><span>' + x[3] + '</span></div></div>'; };
    v.innerHTML = mHdr('더보기') + '<div class="mbody"><div class="menu">' + it.map(function (x) { return row(x); }).join('') + '</div><div class="menu">' + it2.map(function (x) { return row(x); }).join('') + '</div><div class="menu">' + row(['da', '🗑', '기사 전체 삭제', '삭제 전 경고창이 나와요'], true) + '</div><div class="menu">' + row(['lo', '⎋', '로그아웃', adminName]) + '</div><input type="file" id="mfile" class="hid" accept=".xlsx,.xls,.csv"><input type="file" id="mrsf" class="hid" accept=".json,application/json"></div>';
    $$('.mi', v).forEach(function (b) { b.addEventListener('click', function () {
      var a = b.getAttribute('data-m');
      if (a === 'stats' || a === 'rates' || a === 'log' || a === 'claim') { tab = a; render(); }
      else if (a === 'xd') exportDriversXlsx(drivers.slice().sort(dcmp));
      else if (a === 'xu') $('#mfile', v).click();
      else if (a === 'bk') mBackup();
      else if (a === 'da') deleteDrivers(drivers.slice(), true);
      else if (a === 'lo') $('#logout').click();
    }); });
    $('#mfile', v).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) importDrivers(f); });
    $('#mrsf', v).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) restoreFile(f); });
  }
  function mBackup() {
    var m = $('#modal');
    m.innerHTML = '<div class="mbox"><h3>백업 · 복원</h3><div class="mut">무료 플랜은 자동 백업이 없어요. 주 1회 이상 백업을 받아 보관해 주세요.</div><div class="acts"><button class="btn" id="mb-bk">전체 백업 받기</button><button class="btn line" id="mb-rs">복원 (백업 파일 선택)</button><button class="btn line" id="mb-no">닫기</button></div></div>';
    m.hidden = false;
    $('#mb-no').addEventListener('click', function () { m.hidden = true; });
    $('#mb-bk').addEventListener('click', function () { backupAll(); m.hidden = true; });
    $('#mb-rs').addEventListener('click', function () { m.hidden = true; $('#mrsf').click(); });
  }

  /* ---------- v2.2 면허증 · 붙여넣기 추가 ---------- */
  function licPathOf(d) { if (d.license_path) return d.license_path; var a = apps.filter(function (x) { return x.id === d.application_id; })[0]; return a && a.license_path ? a.license_path : null; }
  function selfPathOf(d) { if (d.selfie_path) return d.selfie_path; var a = apps.filter(function (x) { return x.id === d.application_id; })[0]; return a && a.selfie_path ? a.selfie_path : null; }
  function selTd(d) { var p = selfPathOf(d); return '<td class="lc" data-l="셀프 사진"><button class="lcb ' + (p ? 'ok' : 'no') + '" data-self="' + d.id + '">' + (p ? '📷 등록됨' : '없음 ＋등록') + '</button></td>'; }
  function oneKey(k, v) { var o = {}; o[k] = v; return o; }
  function licTd(d) { var p = licPathOf(d); return '<td class="lc" data-l="면허증"><button class="lcb ' + (p ? 'ok' : 'no') + '" data-lic="' + d.id + '">' + (p ? '📷 등록됨' : '없음 ＋등록') + '</button></td>'; }
  function compressImg(file, rot) {
    rot = ((rot || 0) % 360 + 360) % 360;
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { var k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas'), w = Math.round(img.width * k), h = Math.round(img.height * k), sw = rot === 90 || rot === 270; cv.width = sw ? h : w; cv.height = sw ? w : h; var cx = cv.getContext('2d'); cx.translate(cv.width / 2, cv.height / 2); cx.rotate(rot * Math.PI / 180); cx.drawImage(img, -w / 2, -h / 2, w, h); URL.revokeObjectURL(url); cv.toBlob(function (b) { b ? res(b) : rej(new Error('img')); }, 'image/jpeg', 0.82); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('img')); }; img.src = url;
    });
  }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; }
  function uploadLic(d, blob) {
    var path = 'drivers/' + d.id + '/' + Date.now() + '.jpg';
    return sb.storage.from('golddriver-licenses').upload(path, blob, { contentType: 'image/jpeg', upsert: false }).then(function (r) { if (r.error) throw new Error(r.error.message); return path; });
  }
  function licModal(d, done, kind) {
    kind = kind === 'self' ? 'self' : 'lic';
    var K = kind === 'self' ? { f: 'selfie_path', t: '본인 셀프 사진', lg: '셀프 사진', pf: selfPathOf } : { f: 'license_path', t: '운전면허증', lg: '면허증', pf: licPathOf };
    var m = $('#modal'), p = K.pf(d), own = !!d[K.f], rot = 0, pend = null, pendUrl = null, viewUrl = null;
    m.innerHTML = '<div class="mbox wide"><h3>' + esc(d.name) + ' (' + fno(d.emp_no) + ')</h3><div class="tabs2"><button class="tb' + (kind === 'lic' ? ' on' : '') + '" id="lm-t1">운전면허증</button><button class="tb' + (kind === 'self' ? ' on' : '') + '" id="lm-t2">본인 셀프 사진</button></div><div id="lm-body" class="mut">' + (p ? '불러오는 중…' : '') + '</div>' +
      '<div class="rb" id="lm-rot" hidden><button class="btn sm line" id="lm-rl">↺ 왼쪽으로 회전</button><button class="btn sm line" id="lm-rr">↻ 오른쪽으로 회전</button></div><div class="mut" id="lm-rh" style="font-size:12px" hidden></div>' +
      (p ? '' : '<div class="drop" id="lm-drop"><div style="font-size:28px">🪪</div><b>사진을 끌어다 놓거나 선택</b><span>없으면 나중에 등록해도 돼요</span></div>') +
      '<div class="acts" id="lm-acts"><button class="btn sm" id="lm-save" hidden>저장</button><button class="btn sm line" id="lm-pick">' + (p ? '🔄 교체' : '🖼 사진 선택') + '</button><button class="btn sm line mcam" id="lm-cam">📷 촬영</button>' +
      (p ? '<a class="btn sm line" id="lm-dl" target="_blank" style="text-decoration:none" hidden>⬇ 열기/내려받기</a>' : '') + (own ? '<button class="btn sm red" id="lm-del">삭제</button>' : '') + '<button class="btn sm line" id="lm-sh">공유</button><button class="btn sm line" id="lm-no">닫기</button></div><div class="mut" id="lm-st"></div>' +
      '<input type="file" id="lm-f" class="hid" accept="image/*"><input type="file" id="lm-fc" class="hid" accept="image/*" capture="environment"></div>';
    m.hidden = false;
    var st = function (t) { $('#lm-st').textContent = t; };
    if (p) sb.storage.from('golddriver-licenses').createSignedUrl(p, 600).then(function (r) {
      var b = $('#lm-body'); if (!b) return;
      if (r.data && r.data.signedUrl) { b.innerHTML = '<div class="rbox"><img class="lic" id="lm-img" src="' + r.data.signedUrl + '"></div><div class="mut" style="font-size:12px">보안을 위해 이 사진 링크는 10분 후 만료돼요.</div>'; viewUrl = r.data.signedUrl; $('#lm-rot').hidden = false; $('#lm-rh').hidden = false; $('#lm-rh').textContent = '돌린 뒤 「회전 저장」을 눌러야 바뀐 모습으로 저장돼요.'; var dl = $('#lm-dl'); if (dl) { dl.href = r.data.signedUrl; dl.hidden = false; } }
      else b.textContent = '사진을 불러오지 못했어요';
    });
    function applyRot() {
      var im = $('#lm-img'); if (!im) return; var q = rot % 180 !== 0;
      im.style.transform = 'rotate(' + rot + 'deg)'; im.style.maxWidth = q ? '280px' : '100%'; im.style.maxHeight = q ? 'none' : '280px';
      $('#lm-save').hidden = !(pend || rot); $('#lm-save').textContent = pend ? '저장' : '회전 저장';
    }
    function turn(dg) { rot = ((rot + dg) % 360 + 360) % 360; applyRot(); }
    function pick(file) {
      if (!file) return; if (pendUrl) URL.revokeObjectURL(pendUrl);
      pend = file; rot = 0; pendUrl = URL.createObjectURL(file); st('');
      $('#lm-body').innerHTML = '<span class="tag">저장 전 · 미리보기</span><div class="rbox"><img class="lic" id="lm-img" src="' + pendUrl + '"></div>';
      var dz0 = $('#lm-drop'); if (dz0) dz0.hidden = true; $('#lm-rot').hidden = false; $('#lm-rh').hidden = false; $('#lm-rh').textContent = '누를 때마다 90°씩 돌아가요. 지금 모습 그대로 저장돼요.'; applyRot(); $('#lm-save').hidden = false; $('#lm-save').textContent = '저장';
    }
    function save() {
      var btn = $('#lm-save'); btn.disabled = true; st('사진 줄이는 중…');
      var srcP = pend ? Promise.resolve(pend) : fetch(viewUrl).then(function (r) { if (!r.ok) throw new Error('사진을 불러오지 못했어요'); return r.blob(); });
      srcP.then(function (src) { return compressImg(src, rot); }).then(function (blob) { st('올리는 중…'); return uploadLic(d, blob).then(function (path) {
        return sb.from('golddriver_drivers').update(oneKey(K.f, path)).eq('id', d.id).then(function (r) {
          if (r.error) throw new Error(r.error.message);
          var old = d[K.f]; d[K.f] = path;
          if (old) sb.storage.from('golddriver-licenses').remove([old]);
          logAct((d.name || '') + ' 기사 ' + K.t + ' ' + (p ? (pend ? '교체' : '회전') : '등록'), d.application_id); toast(K.lg + '을(를) 저장했어요'); m.hidden = true; if (done) done();
        }); }); }).catch(function (e) { btn.disabled = false; st('실패: ' + (e && e.message === 'img' ? '이 사진 형식은 열 수 없어요(JPG·PNG 사용)' : (e && e.message) || '다시 시도해 주세요')); });
    }
    $('#lm-rl').addEventListener('click', function () { turn(-90); });
    $('#lm-rr').addEventListener('click', function () { turn(90); });
    $('#lm-save').addEventListener('click', save);
    $('#lm-pick').addEventListener('click', function () { $('#lm-f').click(); });
    $('#lm-cam').addEventListener('click', function () { $('#lm-fc').click(); });
    $('#lm-f').addEventListener('change', function () { pick(this.files[0]); this.value = ''; });
    $('#lm-fc').addEventListener('change', function () { pick(this.files[0]); this.value = ''; });
    var dz = $('#lm-drop'); if (dz) { dz.addEventListener('click', function () { $('#lm-f').click(); }); dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('on'); }); dz.addEventListener('dragleave', function () { dz.classList.remove('on'); }); dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('on'); pick(e.dataTransfer.files[0]); }); }
    $('#lm-no').addEventListener('click', function () { m.hidden = true; });
    $('#lm-t1').addEventListener('click', function () { if (kind !== 'lic') licModal(d, done, 'lic'); });
    $('#lm-t2').addEventListener('click', function () { if (kind !== 'self') licModal(d, done, 'self'); });
    $('#lm-sh').addEventListener('click', function () { driverShare([d]); });
    var dl2 = $('#lm-del'); if (dl2) dl2.addEventListener('click', function () {
      if (!confirm('이 기사의 ' + K.t + ' 사진을 삭제할까요?')) return;
      sb.from('golddriver_drivers').update(oneKey(K.f, null)).eq('id', d.id).then(function (r) { if (r.error) { st('실패: ' + r.error.message); return; } sb.storage.from('golddriver-licenses').remove([d[K.f]]); d[K.f] = null; logAct((d.name || '') + ' 기사 ' + K.t + ' 삭제', d.application_id); toast('삭제했어요'); m.hidden = true; if (done) done(); });
    });
  }

  function toggleAddMenu(btn) {
    var old = $('#addmenu'); if (old) { old.remove(); return; }
    var mm = document.createElement('div'); mm.id = 'addmenu'; mm.className = 'addmenu'; var r = btn.getBoundingClientRect(); mm.style.top = (r.bottom + 6) + 'px'; mm.style.left = Math.max(8, r.left) + 'px';
    mm.innerHTML = '<button data-a="paste"><i>📋</i><span>붙여넣기로 추가<small>문자·메신저 내용을 붙여넣어 한 번에</small></span></button><button data-a="direct"><i>✎</i><span>직접 입력<small>항목별로 입력</small></span></button>';
    document.body.appendChild(mm);
    $$('button', mm).forEach(function (b) { b.addEventListener('click', function () { mm.remove(); if (b.getAttribute('data-a') === 'paste') pasteModal(); else addDriverModal(); }); });
    setTimeout(function () { document.addEventListener('click', function h() { var x = $('#addmenu'); if (x) x.remove(); document.removeEventListener('click', h); }); }, 0);
  }
  function mSpeedDial() {
    var el = document.createElement('div'); el.className = 'msd'; el.id = 'msd';
    el.innerHTML = '<div class="sdi" style="bottom:160px" data-a="paste"><span class="lb">붙여넣기로 추가</span><span class="ci">📋</span></div><div class="sdi" style="bottom:92px" data-a="direct"><span class="lb">직접 입력</span><span class="ci">✎</span></div><button class="mfab x">✕</button>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) { var a = e.target.closest('[data-a]'); el.remove(); if (a) { if (a.getAttribute('data-a') === 'paste') pasteModal(); else addDriverModal(); } });
  }

  function money9(t) { var x = String(t || '').replace(/,/g, ''), m = /(\d+(?:\.\d+)?)\s*(만|천)?/.exec(x); if (!m) return 0; var n = parseFloat(m[1]); if (m[2] === '만') n *= 10000; else if (m[2] === '천') n *= 1000; return Math.round(n); }
  function pDate(t) { var m = /(\d{2,4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(t || ''); if (!m) return null; var y = +m[1]; if (y < 100) y += 2000; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2); }
  function parsePaste(text) {
    var o = { team: null, joined_at: null, insurance: null, name: null, phone: null, daily: 0, source: null, extra: [], note: [] }, inNote = false;
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (ln) {
      if (/^\s*#+\s*내용\s*#+\s*$/.test(ln)) { return; }
      var tm = /^\s*[■□●◆▶▷◇]\s*(.+?)\s*$/.exec(ln); if (tm && !inNote) { o.team = tm[1]; return; }
      var km = /^\s*(\d+)\s*[.)]\s*([^:：]{1,30}?)\s*[:：]\s*(.*)$/.exec(ln);
      if (!km && !inNote) km = /^\s*()(가입일|종목|이름|성명|핸드폰\s*번호|휴대폰|통신사[^:：]*|본인[^:：]*|명의[^:：]*|설치[^:：]*|일비|가입\s*경로|유입\s*경로|비고[^:：]*)\s*[:：]\s*(.*)$/.exec(ln);
      if (km) {
        inNote = false;
        var key = km[2].replace(/\s+/g, '').replace(/\(.*?\)/g, ''), val = km[3].trim();
        if (key.indexOf('가입일') === 0) o.joined_at = pDate(val);
        else if (key.indexOf('종목') === 0 || key.indexOf('보험종류') === 0) { var pm = /^(.*?)\s*[(（](.*)[)）]\s*$/.exec(val); if (pm) { o.insurance = pm[1].trim(); o.extra.push('종목: ' + pm[2].trim()); } else o.insurance = val || null; }
        else if (key.indexOf('이름') === 0 || key.indexOf('성명') === 0) o.name = val;
        else if (key.indexOf('핸드폰') === 0 || key.indexOf('휴대폰') === 0 || key.indexOf('전화') === 0) o.phone = val.replace(/[^0-9]/g, '') || null;
        else if (key.indexOf('통신사') === 0) { if (val) o.carrier = val; }
        else if (key.indexOf('본인') === 0 || key.indexOf('명의') === 0) { if (val) o.phone_owner = /타인/.test(val) && !/본인/.test(val) ? '타인' : (/본인/.test(val) && !/타인/.test(val) ? '본인' : val); }
        else if (key.indexOf('설치') === 0) { if (val) o.programs = val; }
        else if (key.indexOf('일비') === 0) { o.daily = money9(val); if (val && !/^[\d,\s]+원?$/.test(val)) o.extra.push('일비: ' + val); }
        else if (key.indexOf('가입경로') === 0 || key.indexOf('유입경로') === 0) o.source = val ? (detectSrc(val) || val) : null;
        else if (key.indexOf('비고') === 0) { inNote = true; if (val) o.note.push(val); }
        return;
      }
      if (inNote && ln.trim()) o.note.push(ln.replace(/\s+$/, ''));
    });
    var all = o.extra.concat(o.note); o.noteText = all.length ? all.join('\n') : null; return o;
  }
  function pasteModal() {
    var m = $('#modal'), file = null, thumbUrl = null, srcF = null, prot = 0;
    m.innerHTML = '<div class="mbox xwide"><h3>붙여넣기로 추가 <button class="x2" id="pp-x">✕</button></h3><div class="pcols">' +
      '<div><div class="lab">붙여넣기 <span>(한 명씩)</span></div><textarea id="pp-t" rows="12" placeholder="여기에 붙여넣기&#10;&#10;■ 골드2팀&#10;1. 가입일 : 26-10-28&#10;2. 종목 : 월보험 탁송&#10;3. 이름 : 홍길동&#10;4. 핸드폰 번호 : 010-0000-0000 …"></textarea><div class="acts"><button class="btn sm line" id="pp-clip">📋 클립보드에서 붙여넣기</button><button class="btn sm line" id="pp-clr">지우기</button></div></div>' +
      '<div><div class="lab">이렇게 인식했어요</div><div class="res" id="pp-res"><span class="mut">붙여넣으면 여기에 항목별로 보여드려요</span></div></div>' +
      '<div><div class="lab">운전면허증 등록 <span>(선택)</span></div><div class="drop" id="pp-drop"><div style="font-size:26px">🪪</div><b>사진을 끌어다 놓거나 선택</b><span>없으면 비워 두고 나중에 등록해도 돼요</span></div><div id="pp-thumb"></div><div class="acts"><button class="btn sm line" id="pp-pick">🖼 사진 선택</button><button class="btn sm line mcam" id="pp-cam">📷 촬영</button></div>' +
      '<input type="file" id="pp-f" class="hid" accept="image/*"><input type="file" id="pp-fc" class="hid" accept="image/*" capture="environment"></div></div>' +
      '<div class="acts" style="justify-content:flex-end"><button class="btn line" id="pp-no">취소</button><button class="btn" id="pp-ok" disabled>추가</button></div><div class="mut" id="pp-st"></div></div>';
    m.hidden = false; $('#pp-t').focus();
    var cur = null;
    function row(l, v, e) { return '<div class="row"><span>' + l + '</span><b' + (e ? ' class="e"' : '') + '>' + (e ? '빈칸' : esc(v)) + '</b></div>'; }
    function refresh() {
      var t = $('#pp-t').value; cur = parsePaste(t); var o = cur, ok = !!(t.trim() && o.name);
      $('#pp-res').innerHTML = t.trim() ? ('<h5>' + (o.name ? '✓ 추가 전에 확인하세요' : '⚠ 이름을 찾지 못했어요') + '</h5>' +
        row('가입일', o.joined_at, !o.joined_at) + row('상태 · 소속', '가입 · ' + (o.team || '골드2팀')) + row('성명', o.name, !o.name) + row('핸드폰', o.phone ? fmtPhone(o.phone) : '', !o.phone) + row('통신사', o.carrier, !o.carrier) + row('명의', o.phone_owner, !o.phone_owner) + row('설치 프로그램', o.programs, !o.programs) + row('보험 종류', o.insurance, !o.insurance) + row('일비', n0(o.daily), !o.daily) + row('유입 경로', o.source, !o.source) + row('사번', '자동 부여') + row('보험사·입금그룹·주민번호', '', true) + row('비고', (o.noteText || '').replace(/\n/g, ' · '), !o.noteText)) : '<span class="mut">붙여넣으면 여기에 항목별로 보여드려요</span>';
      $('#pp-ok').disabled = !ok; $('#pp-ok').textContent = ok ? '추가 (' + o.name + ')' : '추가';
    }
    $('#pp-t').addEventListener('input', refresh);
    $('#pp-clr').addEventListener('click', function () { $('#pp-t').value = ''; refresh(); });
    $('#pp-clip').addEventListener('click', function () { if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (x) { $('#pp-t').value = x; refresh(); }).catch(function () { toast('붙여넣기 칸을 길게 눌러 직접 붙여넣어 주세요'); }); else toast('붙여넣기 칸을 길게 눌러 직접 붙여넣어 주세요'); });
    function setFile(f) {
      if (!f) return; $('#pp-st').textContent = '사진 줄이는 중…';
      compressImg(f).then(function (b) { file = b; srcF = f; prot = 0; if (thumbUrl) URL.revokeObjectURL(thumbUrl); thumbUrl = URL.createObjectURL(b); $('#pp-st').textContent = ''; $('#pp-thumb').innerHTML = '<div class="thumb"><img id="pp-img" src="' + thumbUrl + '"><div><b>' + esc(f.name || '면허증') + '</b><span>' + fmtSize(b.size) + ' · 올렸어요</span></div><button class="lk" id="pp-rm">삭제</button></div><div class="rb"><button class="btn sm line" id="pp-rl" type="button">↺ 왼쪽으로 회전</button><button class="btn sm line" id="pp-rr" type="button">↻ 오른쪽으로 회전</button></div><div class="mut" style="font-size:12px">누를 때마다 90°씩 돌아가요. 지금 모습 그대로 등록돼요.</div>'; $('#pp-rm').addEventListener('click', function () { file = null; srcF = null; prot = 0; $('#pp-thumb').innerHTML = ''; }); var tn = function (dg) { prot = ((prot + dg) % 360 + 360) % 360; $('#pp-img').style.transform = 'rotate(' + prot + 'deg)'; }; $('#pp-rl').addEventListener('click', function () { tn(-90); }); $('#pp-rr').addEventListener('click', function () { tn(90); }); })
        .catch(function () { $('#pp-st').textContent = '이 사진 형식은 열 수 없어요(JPG·PNG 사용)'; });
    }
    $('#pp-pick').addEventListener('click', function () { $('#pp-f').click(); });
    $('#pp-cam').addEventListener('click', function () { $('#pp-fc').click(); });
    $('#pp-f').addEventListener('change', function () { setFile(this.files[0]); this.value = ''; });
    $('#pp-fc').addEventListener('change', function () { setFile(this.files[0]); this.value = ''; });
    var dz = $('#pp-drop'); dz.addEventListener('click', function () { $('#pp-f').click(); }); dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('on'); }); dz.addEventListener('dragleave', function () { dz.classList.remove('on'); }); dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('on'); setFile(e.dataTransfer.files[0]); });
    $('#pp-no').addEventListener('click', function () { m.hidden = true; }); $('#pp-x').addEventListener('click', function () { m.hidden = true; });
    $('#pp-ok').addEventListener('click', function () {
      var o = cur, btn = this; if (!o || !o.name) return; btn.disabled = true; $('#pp-st').textContent = '등록 중…';
      sb.rpc('golddriver_next_emp_no').then(function (r) {
        var no = parseInt(r.data, 10) || (drivers.reduce(function (mx, d) { return Math.max(mx, d.emp_no); }, 5000) + 1);
        while (drivers.some(function (d) { return d.emp_no === no; })) no++;
        var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r2 = Math.random() * 16 | 0; return (c === 'x' ? r2 : (r2 & 3 | 8)).toString(16); });
        var tot = calcTotal(o.daily), rec = { id: id, emp_no: no, team: o.team || '골드2팀', name: o.name, ssn: null, phone: o.phone, ins_company: null, insurance: o.insurance, deposit_group: null, status: '가입', joined_at: o.joined_at, daily_fee: o.daily, insurance_cost: 0, chang_fee: 17000, callmaner_cost: 0, total_cost: tot, margin: calcMargin(tot, 17000, 0, 0), source: o.source, note: o.noteText }; if (o.carrier) rec.carrier = o.carrier; if (o.phone_owner) rec.phone_owner = o.phone_owner; if (o.programs) rec.programs = o.programs;
        return sb.from('golddriver_drivers').insert(rec).then(function (x) {
          if (x.error) { toast('추가 실패: ' + x.error.message, 5000); btn.disabled = false; $('#pp-st').textContent = ''; return; }
          logAct(o.name + ' 기사 붙여넣기 추가 (사번 ' + no + ')', null);
          var fin = function (msg) { m.hidden = true; toast(msg, 4500); loadAll().then(render); };
          if (!file) { fin(o.name + ' 님을 추가했어요 (사번 ' + no + ') · 면허증은 나중에 등록할 수 있어요'); return; }
          $('#pp-st').textContent = '면허증 올리는 중…';
          (prot ? compressImg(srcF, prot) : Promise.resolve(file)).then(function (fb) { return uploadLic(rec, fb); }).then(function (path) { return sb.from('golddriver_drivers').update({ license_path: path }).eq('id', id).then(function (u) { if (u.error) throw new Error(u.error.message); fin(o.name + ' 님과 면허증을 추가했어요 (사번 ' + no + ')'); }); })
            .catch(function () { fin(o.name + ' 님은 추가했지만 면허증 올리기는 실패했어요. 표에서 다시 등록해 주세요'); });
        });
      });
    });
  }

  function addDriverModal() {
    sb.rpc('golddriver_next_emp_no').then(function (r) {
      var m = $('#modal');
      m.innerHTML = '<div class="mbox wide"><h3>기사 추가</h3><div class="mut">한 명씩 직접 입력해서 추가해요. 성명만 필수이고, 나머지는 나중에 표에서 고칠 수 있어요.</div>' +
        '<div class="grid3"><div class="f"><label>가입일</label><input id="a-date" type="date" value="' + todayStr() + '"></div><div class="f"><label>상태</label><select id="a-st"><option>가입</option><option>퇴사</option><option>미납</option></select></div><div class="f"><label>사번</label><input id="a-emp" type="number" value="' + (r.data || '') + '"></div>' +
        '<div class="f"><label>소속</label><input id="a-team" value="골드 2팀"></div><div class="f"><label>성명 *</label><input id="a-name"></div><div class="f"><label>주민번호</label><input id="a-ssn" placeholder="000000-0000000" maxlength="14" autocomplete="off"></div>' +
        '<div class="f"><label>핸드폰 번호</label><input id="a-phone" inputmode="numeric" placeholder="010-0000-0000"></div><div class="f"><label>보험 회사명</label><input id="a-co"></div><div class="f"><label>보험 종류</label><input id="a-ins"></div>' +
        '<div class="f"><label>입금 그룹명</label><input id="a-dep"></div><div class="f"><label>일비</label><input id="a-daily" type="number" inputmode="numeric"></div><div class="f"><label>실보험료</label><input id="a-real" type="number" inputmode="numeric" value="0"></div>' +
        '<div class="f"><label>창 비용</label><input id="a-chang" type="number" inputmode="numeric" value="17000"></div><div class="f"><label>콜마너 비용</label><input id="a-cm" type="number" inputmode="numeric" value="0"></div><div class="f"><label>월 합산 비용 (일비×30)</label><input id="a-tot" type="number" value="0"></div>' +
        '<div class="f"><label>순 마진 ((월합산−창비용−실보험료+콜마너)÷2)</label><input id="a-mar" type="number" value="0"></div></div>' +
        '<div class="f"><label>유입 경로</label><input id="a-src" list="srcl" placeholder="블로그 · 유튜브 · 소개 …"></div><div class="f"><label>비고</label><textarea id="a-note" rows="3" style="width:100%"></textarea></div>' +
        '<div class="acts"><button class="btn" id="a-ok">추가</button><button class="btn line" id="a-no">취소</button></div></div>';
      m.hidden = false; $('#a-name').focus();
      money(['#a-daily', '#a-real', '#a-chang', '#a-cm', '#a-tot', '#a-mar']);
      var amar = function () { $('#a-mar').value = n0(calcMargin($('#a-tot').value, $('#a-chang').value, $('#a-real').value, $('#a-cm').value)); };
      $('#a-daily').addEventListener('input', function () { $('#a-tot').value = n0(calcTotal(this.value)); amar(); });
      ['#a-tot', '#a-chang', '#a-real', '#a-cm'].forEach(function (q) { $(q).addEventListener('input', amar); });
      amar();
      $('#a-ssn').addEventListener('input', function () { var d = this.value.replace(/[^0-9]/g, '').slice(0, 13); this.value = d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d; });
      $('#a-no').addEventListener('click', function () { m.hidden = true; });
      $('#a-ok').addEventListener('click', function () {
        var g = function (id) { return $(id).value.trim(); }, nm = g('#a-name');
        if (!nm) { toast('성명을 입력해 주세요'); return; }
        var ssn = g('#a-ssn').replace(/[^0-9]/g, ''); if (ssn && ssn.length !== 13) { toast('주민번호는 13자리로 입력해 주세요'); return; }
        var no = parseInt(g('#a-emp'), 10); if (isNaN(no)) { toast('사번을 입력해 주세요'); return; }
        if (drivers.some(function (d) { return d.emp_no === no; })) { toast('이미 사용 중인 사번이에요'); return; }
        var n = function (id) { return num(g(id)); };
        var rec = { emp_no: no, team: g('#a-team') || '골드 2팀', name: nm, ssn: ssn ? fmtSsn(ssn) : null, phone: g('#a-phone').replace(/[^0-9]/g, '') || null, ins_company: g('#a-co') || null, insurance: g('#a-ins') || null, deposit_group: g('#a-dep') || null,
          status: g('#a-st'), joined_at: toDate(g('#a-date')), daily_fee: n('#a-daily'), insurance_cost: n('#a-real'), chang_fee: n('#a-chang'), callmaner_cost: n('#a-cm'), total_cost: n('#a-tot'), margin: n('#a-mar'), source: g('#a-src') || null, note: g('#a-note') || null };
        this.disabled = true;
        sb.from('golddriver_drivers').insert(rec).then(function (x) {
          if (x.error) { toast('추가 실패: ' + (/duplicate/.test(x.error.message) ? '이미 사용 중인 사번이에요' : x.error.message), 5000); $('#a-ok').disabled = false; return; }
          logAct(nm + ' 기사 수동 추가 (사번 ' + no + ')', null); m.hidden = true; toast(nm + ' 님을 추가했어요'); loadAll().then(render);
        });
      });
    });
  }
  function noteModal(d, v) {
    if (!d) return;
    var m = $('#modal');
    m.innerHTML = '<div class="mbox wide"><h3>' + esc(d.name) + ' 비고</h3><div class="f"><textarea id="n-t" rows="9" style="width:100%">' + esc(d.note || '') + '</textarea></div><div class="acts"><button class="btn" id="n-ok">저장</button><button class="btn line" id="n-no">닫기</button></div></div>';
    m.hidden = false; $('#n-t').focus();
    $('#n-no').addEventListener('click', function () { m.hidden = true; });
    $('#n-ok').addEventListener('click', function () {
      var t = $('#n-t').value.trim() || null; this.disabled = true;
      sb.from('golddriver_drivers').update({ note: t }).eq('id', d.id).then(function (r) {
        if (r.error) { toast('저장 실패: ' + r.error.message, 5000); $('#n-ok').disabled = false; return; }
        d.note = t; logAct((d.name || '') + ' 기사 비고 수정', d.application_id); m.hidden = true; viewDrivers(v);
      });
    });
  }
  function deleteDrivers(list, all) {
    if (!list.length) return;
    var m = $('#modal'), names = list.slice(0, 5).map(function (d) { return esc(d.name); }).join(', ') + (list.length > 5 ? ' 외 ' + (list.length - 5) + '명' : '');
    m.innerHTML = '<div class="mbox"><h3 style="color:#d93a3a">⚠ ' + (all ? '기사 가입 현황 전체(' + list.length + '명)를 삭제할까요?' : '선택한 ' + list.length + '명을 삭제할까요?') + '</h3>' +
      '<div style="line-height:1.7"><b>삭제하면 되돌릴 수 없습니다.</b><br><span class="mut">' + names + '</span><br><span class="mut">해당 기사들의 가입 신청 기록은 남고, "기사 등록됨" 표시만 해제돼요.</span></div>' +
      '<div class="acts"><button class="btn sm line" id="x-bk">삭제 전에 백업 받기</button></div>' +
      (all ? '<div class="f"><label>계속하려면 <b>전체삭제</b> 라고 입력하세요</label><input id="x-conf" autocomplete="off"></div>' : '') +
      '<div class="acts"><button class="btn red" id="x-ok"' + (all ? ' disabled' : '') + '>삭제</button><button class="btn line" id="x-no">취소</button></div></div>';
    m.hidden = false;
    $('#x-no').addEventListener('click', function () { m.hidden = true; });
    $('#x-bk').addEventListener('click', backupAll);
    if (all) $('#x-conf').addEventListener('input', function () { $('#x-ok').disabled = this.value.trim() !== '전체삭제'; });
    $('#x-ok').addEventListener('click', function () {
      this.disabled = true;
      var ids = list.map(function (d) { return d.id; }), groups = chunk(ids, 100);
      groups.reduce(function (p, c) { return p.then(function () { return sb.from('golddriver_drivers').delete().in('id', c).then(chk); }).then(function () { return sb.from('golddriver_applications').update({ driver_id: null }).in('driver_id', c).then(chk); }); }, Promise.resolve())
        .then(function () { logAct('기사 가입 현황 ' + (all ? '전체 ' : '') + ids.length + '명 삭제 (' + list.slice(0, 3).map(function (d) { return d.name; }).join(', ') + (list.length > 3 ? ' 외' : '') + ')', null); dsel = {}; m.hidden = true; toast(ids.length + '명 삭제했어요'); return loadAll().then(render); })
        .catch(function (e) { toast('삭제 실패: ' + e.message, 6000); var b = $('#x-ok'); if (b) b.disabled = false; });
    });
  }
  function exportDriversXlsx(rows) {
    var keys = isDefVis() ? DEXPD : dvis, EC = DCOL.filter(function (c) { return keys.indexOf(c[0]) >= 0; }), wl = keys.indexOf('license') >= 0, ws2 = keys.indexOf('selfie') >= 0;
    var head = EC.map(function (c) { return c[1]; }).concat(wl ? ['면허증'] : []).concat(ws2 ? ['셀프 사진'] : []);
    var data = [head].concat(rows.map(function (d) { return EC.map(function (c) { var x = c[0] === 'ssn' ? fmtSsn(d.ssn) : (c[2] === 'n' ? (d[c[0]] == null ? '' : d[c[0]]) : dval(d, c)); return x; }).concat(wl ? [licPathOf(d) ? '등록됨' : '없음'] : []).concat(ws2 ? [selfPathOf(d) ? '등록됨' : '없음'] : []); }));
    var ws = XLSX.utils.aoa_to_sheet(data); ws['!cols'] = EC.concat(wl ? [['license', '면허증']] : []).concat(ws2 ? [['selfie', '셀프 사진']] : []).map(function (c) { return { wch: Math.max(10, c[1].length * 2 + 2) }; });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '기사 가입 현황');
    XLSX.writeFile(wb, '기사가입현황_' + ymd(new Date()) + '.xlsx');
  }
  function toDate(x) {
    if (x == null || x === '') return null;
    if (typeof x === 'number') { if (x < 20000 || x > 80000) return null; return new Date(Date.UTC(1899, 11, 30) + Math.round(x) * 86400000).toISOString().slice(0, 10); }
    var m = /^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(String(x).trim()); if (!m) return null;
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }
  function toInt(x) { if (x == null || x === '') return null; var n = parseInt(String(x).replace(/[^0-9\-]/g, ''), 10); return isNaN(n) ? null : n; }
  function parseDriverSheet(buf) {
    var wb = XLSX.read(buf, { type: 'array', cellStyles: true });
    var sn = wb.SheetNames.indexOf('명단') >= 0 ? '명단' : wb.SheetNames[0], ws = wb.Sheets[sn];
    var raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    if (!raw.length) return { rows: [], bad: 0, sheet: sn };
    var rng = XLSX.utils.decode_range(ws['!ref'] || 'A1'), r0 = rng.s.r, c0 = rng.s.c;
    var nk = function (h) { return String(h).replace(/\s+/g, ''); };
    var hi = -1, best = 0;
    for (var i = 0; i < Math.min(raw.length, 20); i++) { var n = raw[i].filter(function (h) { return DALIAS[nk(h)]; }).length; if (n >= 4 && n > best) { best = n; hi = i; if (n >= 6) break; } }
    if (hi < 0) return { rows: [], bad: 0, sheet: sn, hasHead: false };
    var hdr = raw[hi], head = hdr.map(function (h) { return DALIAS[nk(h)] || null; });
    var legacy = hdr.some(function (h) { return /^(월보험비용|일관리비|창비|천안콜마너비용)$/.test(nk(h)); });
    var cell = function (ri, ci) { return ws[XLSX.utils.encode_cell({ r: ri + r0, c: ci + c0 })]; };
    var yellow = function (c) { return c && c.s && c.s.patternType === 'solid' && c.s.fgColor && /^(FF)?FFFF00$/i.test(c.s.fgColor.rgb || ''); };
    var rows = [], bad = 0;
    for (var ri = hi + 1; ri < raw.length; ri++) {
      var r = raw[ri], o = {}, any = false, memos = [], yel = false;
      head.forEach(function (k, ci) {
        var x = r[ci], cl = cell(ri, ci);
        if (cl && cl.c && cl.c.length) cl.c.forEach(function (cm) {
          var t = String(cm.t || '').replace(/\r\n?/g, '\n').replace(/^\s*[^\n:]{1,20}:\s*\n+/, '').trim();
          if (t) memos.push(k === 'note' ? t : '[' + String(hdr[ci]).replace(/\s+/g, ' ').trim() + '] ' + t.replace(/\n+/g, ' '));
        });
        if (k === 'phone' && yellow(cl)) yel = true;
        if (!k || x === '' || x == null) return; any = true; o[k] = x;
      });
      if (!any) continue;
      if (!o.name) { if (o.phone || o.ssn) bad++; continue; }
      if (typeof o.emp_no === 'string' && /\D/.test(o.emp_no.trim())) { var m1 = /\d+/.exec(o.emp_no); var rawNo = o.emp_no.trim(); o.emp_no = m1 ? m1[0] : null; if (m1) o.note = ('사번 ' + rawNo + (o.note ? '\n' + o.note : '')); }
      if (legacy) { o.source = detectSrc(o.note); if (o.source) { o.note = stripSrc(o.note, o.source); if (!o.note) delete o.note; } }
      if (memos.length) o.note = [o.note ? String(o.note).trim() : ''].concat(memos).filter(Boolean).join('\n');
      if (legacy) {
        var st = toInt(o.status), mg = toInt(o.margin);
        o.status = st === 1 ? '가입' : yel ? '미납' : (mg ? '가입' : '퇴사'); delete o.margin;
      } else if (o.status != null) { o.status = String(o.status).trim(); if (['가입', '퇴사', '미납'].indexOf(o.status) < 0) delete o.status; }
      rows.push(o);
    }
    return { rows: rows, bad: bad, hasHead: true, sheet: sn, legacy: legacy };
  }
  function importDrivers(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var P; try { P = parseDriverSheet(new Uint8Array(fr.result)); } catch (e) { toast('엑셀 파일을 읽지 못했어요', 5000); return; }
      if (!P.hasHead || !P.rows.length) { toast('가져올 기사 정보가 없어요. "성명, 사번…" 제목이 있는 파일인지 확인해 주세요.', 6000); return; }
      var byNo = {}; drivers.forEach(function (d) { byNo[d.emp_no] = d; });
      var maxNo = drivers.reduce(function (s, d) { return Math.max(s, d.emp_no); }, 5325), used = {}, skip = 0, skipN = [];
      var plan = [];
      P.rows.forEach(function (o) {
        var no = toInt(o.emp_no);
        if (no != null && no !== 0 && (byNo[no] || used[no])) { skip++; skipN.push(String(o.name).trim() + '(' + no + ')'); return; }
        if (no == null) { while (byNo[maxNo + 1] || used[maxNo + 1]) maxNo++; no = ++maxNo; }
        used[no] = 1; if (no > maxNo) maxNo = no;
        plan.push({ no: no, o: o });
      });
      var add = plan.length, cnt = { 가입: 0, 퇴사: 0, 미납: 0 };
      plan.forEach(function (p) { cnt[p.o.status || '가입']++; });
      var m = $('#modal');
      m.innerHTML = '<div class="mbox"><h3>엑셀 업로드</h3><div class="mut">' + esc(file.name) + ' · 시트 "' + esc(P.sheet) + '"' + (P.legacy ? ' (기존 명단 양식)' : '') + '</div><div style="margin:10px 0;line-height:1.7">새로 추가 <b>' + add + '명</b> <span class="mut">(가입 ' + cnt['가입'] + ' · 퇴사 ' + cnt['퇴사'] + ' · 미납 ' + cnt['미납'] + ')</span>' +
        '<br>사번 중복으로 건너뜀 <b>' + skip + '명</b>' + (skip ? ' <span class="mut">' + esc(skipN.slice(0, 12).join(', ') + (skipN.length > 12 ? ' 외 ' + (skipN.length - 12) + '명' : '')) + '</span>' : '') + (P.bad ? ' · 성명이 없어 건너뜀 ' + P.bad + '줄' : '') + '<br><span class="mut">이미 있는 사번은 건드리지 않아요. 사번이 비어 있으면 마지막 사번 다음부터 붙어요. 가입일은 비워 둬요.</span></div><div class="acts"><button class="btn" id="u-ok"' + (add ? '' : ' disabled') + '>반영하기</button><button class="btn line" id="u-no">취소</button></div></div>';
      m.hidden = false;
      $('#u-no').addEventListener('click', function () { m.hidden = true; });
      $('#u-ok').addEventListener('click', function () {
        this.disabled = true;
        var recs = plan.map(function (p) {
          var o = p.o, r = { emp_no: p.no, team: '골드 2팀', joined_at: null, status: o.status || '가입', name: String(o.name).trim(), ssn: null, phone: null, ins_company: null, insurance: null, deposit_group: null, note: null, source: null,
            deposit_amount: 0, daily_fee: 0, insurance_cost: 0, chang_fee: 17000, callmaner_cost: 0, total_cost: 0, margin: 0 };
          ['team', 'ins_company', 'insurance', 'deposit_group', 'note', 'source', 'carrier', 'phone_owner', 'programs'].forEach(function (k) { if (o[k] != null) { var tv = String(o[k]).trim() || null; if (tv || ['carrier', 'phone_owner', 'programs'].indexOf(k) < 0) r[k] = tv; } });
          if (o.phone != null) r.phone = String(o.phone).replace(/[^0-9]/g, '') || null;
          if (o.ssn != null) { var dg = String(o.ssn).replace(/[^0-9]/g, ''); if (dg.length === 12) dg = '0' + dg; r.ssn = dg.length === 13 ? fmtSsn(dg) : null; }
          if (o.joined_at != null) r.joined_at = toDate(o.joined_at);
          ['deposit_amount', 'daily_fee', 'insurance_cost', 'chang_fee', 'total_cost', 'margin', 'callmaner_cost'].forEach(function (k) { var n = toInt(o[k]); if (n != null) r[k] = n; });
          if (o.total_cost == null) r.total_cost = calcTotal(r.daily_fee);
          if (o.margin == null) r.margin = calcMargin(r.total_cost, r.chang_fee, r.insurance_cost, r.callmaner_cost);
          return r;
        });
        var parts = chunk(recs, 100);
        parts.reduce(function (pr, part) { return pr.then(function () { return sb.from('golddriver_drivers').insert(part).then(function (x) { if (x.error) throw new Error(x.error.message); }); }); }, Promise.resolve())
          .then(function () {
            logAct('엑셀 업로드: 추가 ' + add + '명, 중복 건너뜀 ' + skip + '명 (' + file.name + ')', null);
            m.hidden = true; toast('추가 ' + add + '명 반영 · 중복 ' + skip + '명 건너뜀'); return loadAll().then(render);
          })
          .catch(function (e) { toast('반영 실패: ' + e.message, 7000); var b = $('#u-ok'); if (b) b.disabled = false; });
      });
    };
    fr.readAsArrayBuffer(file);
  }

  /* ---------- 결제 ---------- */
  function viewPay(v) {
    var rows = apps.filter(function (a) { return a.payment_status !== 'none' || a.signup_type === 'direct'; });
    v.innerHTML = '<h2>결제 · 안내 현황</h2><div class="panel mut">결제는 문자로 안내하는 방식이에요. 입금 확인 후 신청 상세에서 "가입 완료 처리"를 눌러 주세요.</div><div class="tw"><table><thead><tr><th>접수번호</th><th>이름</th><th>전화번호</th><th>신청 앱</th><th>예상 금액</th><th>결제</th><th>상태</th><th></th></tr></thead><tbody>' +
      rows.map(function (a) { return '<tr class="s-' + a.status + '"><td data-l="접수번호">' + esc(a.receipt_no) + '</td><td data-l="이름"><b>' + esc(a.name) + '</b></td><td data-l="전화">' + fmtPhone(a.phone) + '</td><td data-l="앱">' + esc(appsText(a)) + '</td><td data-l="금액">' + n0(a.payment_amount) + '원</td><td data-l="결제">' + PAY[a.payment_status] + '</td><td data-l="상태">' + stTag(a.status) + '</td><td><button class="btn sm line" data-open="' + a.id + '">열기</button></td></tr>'; }).join('') + '</tbody></table></div>';
    $$('[data-open]', v).forEach(function (b) { b.addEventListener('click', function () { openDrawer(b.getAttribute('data-open')); }); });
  }

  /* ---------- 처리 기록 · 백업 · 복원 ---------- */
  function viewLog(v) {
    v.innerHTML = '<h2>처리 기록</h2><div class="panel">' + (logs.length ? logs.map(function (l) { return '<div class="log"><span class="mut">' + ymdhm(l.created_at) + '</span> · <b>' + esc(l.admin_name) + '</b> · ' + esc(l.action) + '</div>'; }).join('') : '<div class="mut">아직 기록이 없어요</div>') + '</div>' +
      '<div class="panel"><b>백업 · 복원</b><div class="mut" style="margin:4px 0 8px">무료 플랜은 자동 백업이 없어요. 주 1회 이상 "전체 백업"을 받아 보관해 주세요. 백업 파일에는 가입 신청과 기사 가입 현황이 함께 들어 있고, 복원하면 둘 다 복원돼요. (운전면허증 사진 파일은 포함되지 않아요)</div>' +
      '<div class="acts"><button class="btn sm line" id="bk">전체 백업 (신청 + 기사 가입 현황)</button><button class="btn sm line" id="rs">복원 (백업 파일 선택)</button><input type="file" id="rsf" class="hid" accept=".json,application/json"></div></div>';
    $('#bk', v).addEventListener('click', backupAll);
    $('#rs', v).addEventListener('click', function () { $('#rsf', v).click(); });
    $('#rsf', v).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) restoreFile(f); });
  }
  function backupAll() {
    var data = { app: 'golddriver', version: 2, created_at: new Date().toISOString(), counts: { applications: apps.length, drivers: drivers.length }, applications: apps, drivers: drivers };
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); a.download = '골드대리운전_전체백업_' + ymd(new Date()) + '.json'; document.body.appendChild(a); a.click(); a.remove();
    logAct('전체 백업 파일 다운로드 (신청 ' + apps.length + '건, 기사 ' + drivers.length + '명)', null); toast('백업 파일을 내려받았어요');
  }
  function chunk(arr, n) { var o = []; for (var i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }
  function restoreFile(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var B; try { B = JSON.parse(fr.result); } catch (e) { B = null; }
      if (!B || B.app !== 'golddriver' || !Array.isArray(B.applications) || !Array.isArray(B.drivers)) { toast('골드대리운전 백업 파일(.json)이 아니에요', 5000); return; }
      var m = $('#modal');
      m.innerHTML = '<div class="mbox"><h3>백업에서 복원</h3><div class="mut">' + esc(file.name) + '<br>백업 시각 ' + esc(ymdhm(B.created_at)) + ' · 신청 ' + B.applications.length + '건 · 기사 ' + B.drivers.length + '명</div>' +
        '<label class="radio"><input type="radio" name="rmode" value="merge" checked><span><b>합쳐서 복원</b> (권장)<br><span class="mut">백업에 있는 자료를 되살리고 같은 항목은 백업 내용으로 덮어써요. 지금 있는 다른 자료는 그대로 둬요.</span></span></label>' +
        '<label class="radio"><input type="radio" name="rmode" value="full"><span><b>백업 시점으로 완전 복원</b><br><span class="mut" style="color:#d93a3a">백업에 없는 지금의 신청·기사 자료는 삭제돼요.</span></span></label>' +
        '<div class="acts"><button class="btn" id="b-ok">복원하기</button><button class="btn line" id="b-no">취소</button></div><div class="mut" id="b-st"></div></div>';
      m.hidden = false;
      $('#b-no').addEventListener('click', function () { m.hidden = true; });
      $('#b-ok').addEventListener('click', function () {
        var full = $('input[name=rmode]:checked', m).value === 'full', st = $('#b-st'), btn = this; btn.disabled = true;
        var say = function (t) { st.textContent = t; };
        var apps2 = B.applications.map(function (x) { var o = {}; for (var k in x) o[k] = x[k]; return o; });
        var drv2 = B.drivers;
        var run = Promise.resolve();
        if (full) {
          run = run.then(function () { say('현재 자료 정리 중…'); var keepD = {}; drv2.forEach(function (d) { keepD[d.id] = 1; }); var del = drivers.filter(function (d) { return !keepD[d.id]; }).map(function (d) { return d.id; });
            return chunk(del, 100).reduce(function (p, c) { return p.then(function () { return sb.from('golddriver_drivers').delete().in('id', c).then(chk); }); }, Promise.resolve()); })
          .then(function () { var keepA = {}; apps2.forEach(function (a) { keepA[a.id] = 1; }); var del = apps.filter(function (a) { return !keepA[a.id]; }).map(function (a) { return a.id; });
            return chunk(del, 100).reduce(function (p, c) { return p.then(function () { return sb.from('golddriver_applications').delete().in('id', c).then(chk); }); }, Promise.resolve()); });
        }
        run.then(function () { say('가입 신청 복원 중…'); return chunk(apps2, 100).reduce(function (p, c) { return p.then(function () { return sb.from('golddriver_applications').upsert(c, { onConflict: 'id' }).then(chk); }); }, Promise.resolve()); })
          .then(function () { say('기사 가입 현황 복원 중…'); return chunk(drv2, 100).reduce(function (p, c) { return p.then(function () { return sb.from('golddriver_drivers').upsert(c, { onConflict: 'id' }).then(chk); }); }, Promise.resolve()); })
          .then(function () { logAct('백업 복원 (' + (full ? '완전' : '합치기') + '): 신청 ' + apps2.length + '건, 기사 ' + drv2.length + '명 · ' + file.name, null); m.hidden = true; toast('복원했어요 (신청 ' + apps2.length + '건 · 기사 ' + drv2.length + '명)', 5000); return loadAll().then(render); })
          .catch(function (e) { say(''); btn.disabled = false; toast('복원 중 문제가 생겼어요: ' + (e && e.message ? e.message : e), 8000); loadAll().then(render); });
      });
    };
    fr.readAsText(file);
  }
  function chk(r) { if (r.error) throw new Error(r.error.message); return r; }

  /* ---------- 사고접수 번호 ---------- */
  var CLAIMS = [['삼성화재', '1588-5114'], ['현대해상', '1588-5656'], ['DB손해보험', '1588-0100'], ['KB손해보험', '1544-0114'], ['메리츠화재', '1566-7711'], ['한화손해보험', '1566-8000'], ['롯데손해보험', '1588-3344'], ['하나손해보험', '1566-3000'], ['캐롯(한화손보 캐롯)', '1566-0300'], ['MG손해보험', '1588-5959']];
  function viewClaim(v) {
    v.innerHTML = '<h2>보험사 사고접수 번호</h2><div class="mut" style="margin:-6px 0 10px">번호를 누르면 바로 전화가 연결돼요. (PC는 연결된 전화 앱, 폰은 통화 화면)</div>' +
      '<div class="tw claim"><table><thead><tr><th>보험사</th><th>사고접수 전화번호</th></tr></thead><tbody>' +
      CLAIMS.map(function (c) { return '<tr><td class="nl"><b>' + esc(c[0]) + '</b></td><td data-l="사고접수"><a class="callno" href="tel:' + c[1].replace(/[^0-9]/g, '') + '">' + esc(c[1]) + '</a></td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  /* ---------- CSV ---------- */
  function csv(name, head, rows) {
    var cell = function (x) { x = x == null ? '' : String(x); if (/^[=+\-@]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
    var t = '﻿' + [head].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  function initHist() {
    if (histOn) return; histOn = true;
    history.replaceState({ gd: 'root' }, ''); history.pushState({ gd: 'tab', tab: tab }, ''); curTab = tab;
    ['modal', 'drawer', 'medit'].forEach(function (id) {
      var el = $('#' + id), was = !el.hidden;
      new MutationObserver(function () {
        var open = !el.hidden;
        if (id === 'medit' && !open) document.body.classList.remove('noscroll');
        if (open && ovStack.indexOf(id) < 0) { ovStack.push(id); history.pushState({ gd: 'ov', id: id }, ''); }
        else if (!open && ovStack.indexOf(id) >= 0) { ovStack.splice(ovStack.indexOf(id), 1); if (!popClosing) { skipPop++; history.back(); } }
      }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    });
    window.addEventListener('popstate', function (e) {
      if (skipPop > 0) { skipPop--; return; }
      if (ovStack.length) { var id = ovStack[ovStack.length - 1]; popClosing = true; $('#' + id).hidden = true; Promise.resolve().then(function () { popClosing = false; }); return; }
      var st = e.state || {};
      if (st.gd === 'tab' && st.tab) { tab = st.tab; curTab = tab; fromPop = true; render(); window.scrollTo(0, 0); return; }
      if (exitArm) { exitArm = false; history.back(); return; }
      exitArm = true; setTimeout(function () { exitArm = false; }, 2000); toast('한 번 더 누르면 나가요', 2000); history.pushState({ gd: 'tab', tab: tab }, '');
    });
  }
  var mqh = function () { if (uid && !$('#main').hidden) render(); };
  if (MQ.addEventListener) MQ.addEventListener('change', mqh); else if (MQ.addListener) MQ.addListener(mqh);
  boot();
})();
