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

  var ST = { new: ['신규', 'y'], consult_wait: ['상담 대기', 'b'], consulting: ['상담 중', 'b'], license_check: ['면허 확인', 'o'], license_wait: ['면허 대기', 'o'], complete: ['가입 완료', 'g'], canceled: ['취소', ''] };
  var WT = { daeri: '대리', takso: '탁송', both: '대리+탁송' }, WM = { part: '부업', full: '전업' }, INS = { geon: '건당보험', month: '월보험' };
  var PAY = { none: '-', requested: '안내 요청', paid: '결제 완료' }, LIC = { none: '미제출', submitted: '제출됨', confirmed: '확인 완료' };
  var APPN = { logi: '로지', callmaner: '콜마너', aicon: '아이콘', tmap: '티맵대리', kakao: '카카오T대리', handle: '핸들포유', none: '처음입니다' };
  var CAR = { SKT: 'SK', KT: 'KT', LGU: 'U+', SKT_MVNO: 'SK알뜰폰', KT_MVNO: 'KT알뜰폰', LGU_MVNO: 'U+알뜰폰' }, OWN = { self: '본인 명의', other: '타인 명의' };
  var TABS = [['home', '오늘 할 일'], ['apps', '가입 신청'], ['drivers', '기사 가입 현황'], ['pay', '결제'], ['log', '처리 기록'], ['claim', '사고접수']];
  var OWNER_EMAIL = 'bbw135@gmail.com';
  var tab = 'home', apps = [], drivers = [], logs = [], adminName = '관리자', filter = 'all', q = '', uid = null;

  function toast(m, ms) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, ms || 3000); }
  function ymd(s) { if (!s) return '-'; var d = new Date(s); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function ymdhm(s) { var d = new Date(s); return ymd(s) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function fmtPhone(p) { p = String(p || ''); return p.length === 11 ? p.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : p.length === 10 ? p.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : p; }
  function age(b) { if (!b) return '-'; var d = new Date(b), n = new Date(), a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }
  function n0(v) { return Number(v || 0).toLocaleString('ko-KR'); }
  function appsText(a) { var o = []; for (var k in (a.selected_apps || {})) o.push(APPN[k] + ' ' + a.selected_apps[k]); return o.join(', ') || '-'; }
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
        loadAll().then(function () { render(); subscribe(); });
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
  function openApps() { return apps.filter(function (a) { return a.status !== 'complete' && a.status !== 'canceled'; }); }
  function render() {
    var badge = apps.filter(function (a) { return a.status === 'new'; }).length;
    $('#tabs').innerHTML = TABS.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + (t[0] === 'apps' && badge ? '<span class="dot">' + badge + '</span>' : '') + '</button>'; }).join('');
    $$('#tabs button').forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-t'); render(); }); });
    var v = $('#view');
    ({ home: viewHome, apps: viewApps, drivers: viewDrivers, pay: viewPay, log: viewLog, claim: viewClaim })[tab](v);
  }

  /* ---------- 오늘 할 일 ---------- */
  function viewHome(v) {
    var today = ymd(new Date());
    var c = function (f) { return apps.filter(f).length; };
    var newc = c(function (a) { return a.status === 'new'; });
    var consult = c(function (a) { return a.signup_type === 'consult' && (a.status === 'new' || a.status === 'consult_wait' || a.status === 'consulting'); });
    var lic = c(function (a) { return a.license_status === 'submitted' && a.status !== 'complete' && a.status !== 'canceled'; });
    var pay = c(function (a) { return a.payment_status === 'requested' && a.status !== 'complete' && a.status !== 'canceled'; });
    var tdy = c(function (a) { return ymd(a.created_at) === today; });
    var todo = openApps().filter(function (a) { return a.status === 'new' || a.license_status === 'submitted' || a.payment_status === 'requested'; }).slice(0, 30);
    v.innerHTML = '<h2>오늘 할 일</h2><div class="cards">' +
      stat('신규 신청', newc, 'new', newc > 0) + stat('상담 전화 필요', consult, 'consult', consult > 0) + stat('면허증 확인', lic, 'lic', lic > 0) + stat('결제 안내 요청', pay, 'pay', pay > 0) +
      '<div class="stat"><b>' + tdy + '</b><span>오늘 접수</span></div><div class="stat" data-go="drivers"><b>' + drivers.length + '</b><span>가입 기사</span></div></div>' +
      '<div class="panel"><b>바로 처리할 신청</b>' + (todo.length ? todo.map(function (a) {
        return '<div class="todo clk" data-open="' + a.id + '"><div><b>' + esc(a.name) + '</b> ' + stTag(a.status) + '<div class="mut">' + fmtPhone(a.phone) + ' · ' + (a.signup_type === 'consult' ? '상담 ' + esc(a.call_time || '') : '바로 가입') + ' · 면허 ' + LIC[a.license_status] + ' · 결제 ' + PAY[a.payment_status] + '</div></div><div class="acts" style="margin:0"><button class="btn sm line" data-open="' + a.id + '">열기</button><a class="btn sm" href="' + tel(a.phone) + '">전화</a></div></div>';
      }).join('') : '<div class="mut" style="padding:14px 0">처리할 신청이 없어요 🎉</div>') + '</div>';
    $$('.stat[data-f]', v).forEach(function (s) { s.addEventListener('click', function () { filter = s.getAttribute('data-f'); tab = 'apps'; render(); }); });
    $$('.stat[data-go]', v).forEach(function (s) { s.addEventListener('click', function () { tab = s.getAttribute('data-go'); render(); }); });
    $$('.todo[data-open]', v).forEach(function (b) { b.addEventListener('click', function (e) { if (e.target.closest('a')) return; openDrawer(b.getAttribute('data-open')); }); });
  }
  function stat(l, n, f, hot) { return '<div class="stat ' + (hot ? 'hot' : '') + '" data-f="' + f + '"><b>' + n + '</b><span>' + l + '</span></div>'; }

  /* ---------- 가입 신청 ---------- */
  var FILTERS = [['all', '전체'], ['new', '신규'], ['consult', '상담 필요'], ['lic', '면허 확인'], ['pay', '결제 요청'], ['complete', '가입 완료'], ['canceled', '취소']];
  function matchF(a) {
    if (filter === 'all') return true;
    if (filter === 'new') return a.status === 'new';
    if (filter === 'consult') return a.signup_type === 'consult' && ['new', 'consult_wait', 'consulting'].indexOf(a.status) >= 0;
    if (filter === 'lic') return a.license_status === 'submitted' && a.status !== 'complete' && a.status !== 'canceled';
    if (filter === 'pay') return a.payment_status === 'requested' && a.status !== 'complete' && a.status !== 'canceled';
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
      '<div class="tw"><table><thead><tr><th class="ck"></th><th>접수번호</th><th>접수일시</th><th>상태</th><th>이름</th><th>나이</th><th>전화번호</th><th>지역</th><th>통신사</th><th>명의</th><th>업무</th><th>방식</th><th>보험</th><th>유형</th><th>앱</th><th>운전면허증</th><th>결제</th><th>담당자</th></tr></thead><tbody>' +
      rows.map(function (a) {
        return '<tr class="clk s-' + a.status + '" data-id="' + a.id + '"><td class="ck" data-nodrawer="1"><input type="checkbox" class="rk" data-id="' + a.id + '"' + (sel[a.id] ? ' checked' : '') + '></td><td data-l="접수번호">' + esc(a.receipt_no) + '</td><td data-l="접수">' + ymdhm(a.created_at) + '</td><td data-l="상태">' + stTag(a.status) + '</td><td data-l="이름"><b>' + esc(a.name) + '</b></td><td data-l="나이">' + age(a.birth_date) + '</td><td data-l="전화">' + fmtPhone(a.phone) + '</td><td data-l="지역">' + esc(a.region) + '</td><td data-l="통신사">' + esc(CAR[a.carrier] || '-') + '</td><td data-l="명의">' + esc((OWN[a.phone_owner] || '-').replace(' 명의', '')) + '</td><td data-l="업무">' + (WT[a.work_type] || '-') + '</td><td data-l="방식">' + (WM[a.work_mode] || '-') + '</td><td data-l="보험">' + (INS[a.insurance] || '-') + '</td><td data-l="유형">' + (a.signup_type === 'consult' ? '상담' : '바로가입') + '</td><td data-l="앱">' + esc(appsText(a)) + '</td><td data-l="운전면허증">' + LIC[a.license_status] + '</td><td data-l="결제">' + PAY[a.payment_status] + '</td><td data-l="담당자">' + esc(a.assignee || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (rows.length ? '' : '<div class="mut" style="padding:20px;text-align:center">해당하는 신청이 없어요</div>');
    $$('.chip', v).forEach(function (b) { b.addEventListener('click', function () { filter = b.getAttribute('data-f'); sel = {}; render(); }); });
    $('#q', v).addEventListener('change', function () { q = this.value; sel = {}; render(); });
    $$('tr.clk', v).forEach(function (r) { r.addEventListener('click', function (e) { if (e.target.closest('[data-nodrawer]')) return; openDrawer(r.getAttribute('data-id')); }); });
    $$('.rk', v).forEach(function (c) { c.addEventListener('change', function () { if (c.checked) sel[c.getAttribute('data-id')] = 1; else delete sel[c.getAttribute('data-id')]; viewApps(v); }); });
    $('#selall', v).addEventListener('change', function () { var on = this.checked; rows.forEach(function (a) { if (on) sel[a.id] = 1; else delete sel[a.id]; }); viewApps(v); });
    $('#seldel', v).addEventListener('click', function () { deleteApps(rows.filter(function (a) { return sel[a.id]; })); });
    $('#csv', v).addEventListener('click', function () {
      csv('가입신청_' + ymd(new Date()) + '.csv', ['접수번호', '접수일시', '상태', '이름', '생년월일', '전화번호', '지역', '통신사', '명의', '기종', '업무', '방식', '보험', '유형', '앱', '통화희망', '질문', '추천인', '운전면허증', '결제', '담당자', '메모'],
        rows.map(function (a) { return [a.receipt_no, ymdhm(a.created_at), (ST[a.status] || [a.status])[0], a.name, a.birth_date, fmtPhone(a.phone), a.region, CAR[a.carrier] || '', OWN[a.phone_owner] || '', a.device_model, WT[a.work_type], WM[a.work_mode], INS[a.insurance], a.signup_type === 'consult' ? '상담' : '바로가입', appsText(a), a.call_time, a.question, a.referrer, LIC[a.license_status], PAY[a.payment_status], a.assignee, a.memo]; }));
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
      var ids = list.map(function (a) { return a.id; }), paths = list.map(function (a) { return a.license_path; }).filter(Boolean);
      (paths.length ? sb.storage.from('golddriver-licenses').remove(paths) : Promise.resolve()).then(function () {
        return sb.from('golddriver_applications').delete().in('id', ids);
      }).then(function (r) {
        if (r.error) { toast('삭제 실패: ' + r.error.message, 5000); $('#x-ok').disabled = false; return; }
        logAct('가입 신청 ' + ids.length + '건 삭제 (' + list.slice(0, 3).map(function (a) { return a.name; }).join(', ') + (list.length > 3 ? ' 외' : '') + ')', null);
        sel = {}; m.hidden = true; toast(ids.length + '건 삭제했어요'); loadAll().then(render);
      });
    });
  }

  /* ---------- 상세 서랍 ---------- */
  function openDrawer(id) {
    var a = apps.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    var d = $('#drawer');
    var sOpts = Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (a.status === k ? ' selected' : '') + '>' + ST[k][0] + '</option>'; }).join('');
    d.innerHTML = '<div class="dbox"><div style="display:flex;justify-content:space-between"><h3>' + esc(a.name) + ' ' + stTag(a.status) + '</h3><button class="btn sm line" id="dx">닫기</button></div><div class="mut">' + esc(a.receipt_no) + ' · ' + ymdhm(a.created_at) + '</div>' +
      '<div class="acts"><a class="btn" href="' + tel(a.phone) + '">전화 걸기</a><a class="btn line" href="' + sms(a.phone, a.name + '님, 골드대리운전입니다.') + '">문자 보내기</a>' +
      (a.payment_status === 'requested' ? '<a class="btn dark" href="' + sms(a.phone, a.name + '님, 골드대리운전 첫 달 이용료 안내드립니다. 예상 금액 ' + n0(a.payment_amount) + '원. 입금 계좌는 [여기에 계좌 입력]') + '">결제 안내 문자</a>' : '') + '</div>' +
      '<dl class="kv"><dt>생년월일</dt><dd>' + esc(a.birth_date) + ' (만 ' + age(a.birth_date) + '세)</dd><dt>전화번호</dt><dd>' + fmtPhone(a.phone) + '</dd><dt>지역</dt><dd>' + esc(a.region || '-') + '</dd><dt>통신사</dt><dd>' + esc(CAR[a.carrier] || '-') + '</dd><dt>휴대폰 명의</dt><dd>' + esc(OWN[a.phone_owner] || '-') + '</dd><dt>휴대폰 기종</dt><dd>' + esc(a.device_model || '-') + '</dd><dt>업무/방식</dt><dd>' + (WT[a.work_type] || '-') + ' / ' + (WM[a.work_mode] || '-') + '</dd><dt>보험</dt><dd>' + (INS[a.insurance] || '-') + '</dd><dt>사용 경험 앱</dt><dd>' + esc((a.used_apps || []).map(function (x) { return APPN[x] || x; }).join(', ') || '-') + '</dd><dt>신청 앱</dt><dd>' + esc(appsText(a)) + '</dd><dt>예상 금액</dt><dd>' + n0(a.payment_amount) + '원</dd><dt>유형</dt><dd>' + (a.signup_type === 'consult' ? '상담부터 · ' + esc(a.call_time || '') : '상담 없이 바로 가입') + '</dd><dt>궁금한 점</dt><dd>' + esc(a.question || '-') + '</dd><dt>추천인</dt><dd>' + esc(a.referrer || '-') + '</dd><dt>마케팅 동의</dt><dd>' + (a.consent_marketing ? '동의' : '미동의') + '</dd><dt>운전면허증</dt><dd>' + LIC[a.license_status] + '</dd><dt>결제</dt><dd>' + PAY[a.payment_status] + '</dd></dl>' +
      '<div id="licarea"></div>' +
      '<div class="grid2"><div class="f"><label>상태</label><select id="d-st">' + sOpts + '</select></div><div class="f"><label>담당자</label><input id="d-as" value="' + esc(a.assignee || '') + '"></div></div>' +
      '<div class="f"><label>메모</label><textarea id="d-memo">' + esc(a.memo || '') + '</textarea></div>' +
      '<div class="acts"><button class="btn" id="d-save">저장</button>' + (a.driver_id ? '<span class="tag g big">기사 등록됨</span>' : '<button class="btn dark" id="d-reg">가입 완료 처리 → 기사 등록</button>') + '</div></div>';
    d.hidden = false;
    d.addEventListener('click', function h(e) { if (e.target === d) { d.hidden = true; d.removeEventListener('click', h); } });
    $('#dx').addEventListener('click', function () { d.hidden = true; });
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
      sb.from('golddriver_applications').update(upd).eq('id', a.id).then(function (r) {
        if (r.error) { toast('저장 실패: ' + r.error.message); return; }
        if (diff.length) logAct(a.name + ' · ' + diff.join(', '), a.id);
        toast('저장했어요'); d.hidden = true; loadAll().then(render);
      });
    });
    var reg = $('#d-reg'); if (reg) reg.addEventListener('click', function () { registerModal(a); });
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
      m.innerHTML = '<div class="mbox wide"><h3>가입 완료 처리</h3><div class="mut">' + esc(a.name) + ' 님을 기사 가입 현황에 등록합니다. 신청 상태는 "가입 완료"로 바뀝니다. 모든 칸은 나중에도 수정할 수 있어요.</div>' +
        '<div class="grid3"><div class="f"><label>가입일</label><input id="r-date" type="date" value="' + todayStr() + '"></div><div class="f"><label>사번</label><input id="r-emp" type="number" value="' + (r.data || '') + '"></div><div class="f"><label>소속</label><input id="r-team" value="골드 2팀"></div>' +
        '<div class="f"><label>성명</label><input id="r-name" value="' + esc(a.name) + '"></div><div class="f"><label>주민번호</label><input id="r-ssn" placeholder="000000-0000000" maxlength="14" autocomplete="off"><div class="ocr" id="r-ocr"></div></div><div class="f"><label>핸드폰 번호</label><input id="r-phone" value="' + esc(fmtPhone(a.phone)) + '"></div>' +
        '<div class="f"><label>보험 회사명</label><input id="r-co"></div><div class="f"><label>보험 종류</label><input id="r-ins" value="' + ins + '"></div><div class="f"><label>입금 그룹명</label><input id="r-dep"></div>' +
        '<div class="f"><label>일비</label><input id="r-daily" type="number" inputmode="numeric" value=""></div><div class="f"><label>실보험료</label><input id="r-real" type="number" inputmode="numeric" value="0"></div><div class="f"><label>창 비용</label><input id="r-chang" type="number" inputmode="numeric" value="17000"></div>' +
        '<div class="f"><label>콜마너 비용</label><input id="r-cm" type="number" inputmode="numeric" value="0"></div><div class="f"><label>월 합산 비용 (일비×30)</label><input id="r-tot" type="number" value="0"></div><div class="f"><label>순 마진 ((월합산−창비용−실보험료+콜마너)÷2)</label><input id="r-mar" type="number" value="0"></div></div>' +
        '<div class="f"><label>유입 경로</label><input id="r-src" list="srcl" placeholder="블로그 · 유튜브 · 소개 …"></div><div class="f"><label>비고</label><input id="r-note"></div>' +
        '<div class="acts"><button class="btn" id="r-ok">등록</button><button class="btn line" id="r-no">취소</button></div></div>';
      m.hidden = false;
      $('#r-ssn').addEventListener('input', function () { var d = this.value.replace(/[^0-9]/g, '').slice(0, 13); this.value = d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d; });
      money(['#r-daily', '#r-real', '#r-chang', '#r-cm', '#r-tot', '#r-mar']);
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
        var p = { joined_at: n('#r-date'), emp_no: n('#r-emp'), team: n('#r-team'), name: n('#r-name'), ssn: n('#r-ssn'), phone: n('#r-phone'), ins_company: n('#r-co'), insurance: n('#r-ins'), deposit_group: n('#r-dep'),
          daily_fee: n('#r-daily'), insurance_cost: n('#r-real'), chang_fee: n('#r-chang'), status: '가입', callmaner_cost: n('#r-cm'), total_cost: n('#r-tot'), margin: n('#r-mar'), source: n('#r-src'), note: n('#r-note') };
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
  var DCOL = [['joined_at', '가입일', 'd'], ['status', '상태', 't'], ['emp_no', '사번', 'n'], ['team', '소속'], ['name', '성명'], ['ssn', '주민번호', 's'], ['phone', '핸드폰 번호'], ['ins_company', '보험 회사명'], ['insurance', '보험 종류'], ['deposit_group', '입금 그룹명'],
    ['callmaner_cost', '콜마너 비용', 'n'], ['daily_fee', '일비', 'n'], ['insurance_cost', '실보험료', 'n'], ['chang_fee', '창 비용', 'n'], ['total_cost', '월 합산 비용', 'n'], ['margin', '순 마진', 'n'], ['source', '유입 경로'], ['note', '비고', 'm']];
  var SRC = ['블로그', '유튜브', '소개', '타타타', 'BK오더방', '이실장', '오우달', '새달사', '현근 영업', '지인'];
  var SRX = { '블로그': /블로그/g, '유튜브': /유튜브/g, '소개': /소개/g, '타타타': /타타타/g, 'BK오더방': /BK\s*오더방|오더방/g, '이실장': /이실장/g, '오우달': /오우달/g, '새달사': /새달사\s*쪽지|새달사/g, '현근 영업': /현근\s*영업|현근/g, '지인': /지인/g };
  function stripSrc(t, src) { var x = String(t || ''); if (src && SRX[src]) x = x.replace(SRX[src], ' '); x = x.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim(); var m = /^\((.*)\)$/.exec(x); if (m) x = m[1].trim(); x = x.replace(/^[\s,·\/\-:]+|[\s,·\/\-:]+$/g, '').trim(); return x; }
  function detectSrc(t) { t = String(t || ''); var order = [['블로그', '블로그'], ['유튜브', '유튜브'], ['소개', '소개'], ['타타타', '타타타'], ['오더방', 'BK오더방'], ['이실장', '이실장'], ['오우달', '오우달'], ['새달사', '새달사'], ['현근', '현근 영업'], ['지인', '지인']]; for (var i = 0; i < order.length; i++) if (t.indexOf(order[i][0]) >= 0) return order[i][1]; return null; }
  var DW = { joined_at: 6.8, status: 4.8, emp_no: 4, team: 4.8, name: 5, ssn: 8.5, phone: 8.5, ins_company: 5.5, insurance: 6.2, deposit_group: 9.2, callmaner_cost: 6.3, daily_fee: 5.5, insurance_cost: 6, chang_fee: 5, total_cost: 6.5, margin: 5.5, source: 6, note: 5 };
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
  var dfil = {}, dfoc = null, STS = ['가입', '퇴사', '미납'];
  var dsel = {};
  var DALIAS = { 가입일: 'joined_at', 사번: 'emp_no', 소속: 'team', 성명: 'name', 이름: 'name', 주민번호: 'ssn', 주민등록번호: 'ssn', 핸드폰번호: 'phone', 휴대폰번호: 'phone', 전화번호: 'phone', 핸드폰: 'phone', 보험회사명: 'ins_company', 보험회사: 'ins_company',
    보험종류: 'insurance', 보험: 'insurance', 입금그룹명: 'deposit_group', 일비: 'daily_fee', 일관리비: 'daily_fee', 창비: 'chang_fee', 창비용: 'chang_fee', 상태: 'status', 유입경로: 'source', 천안콜마너비용: 'callmaner_cost', 실보험료: 'insurance_cost', 월보험비용: 'insurance_cost', 월합산비용: 'total_cost', 순마진: 'margin', 월마진: 'margin', 콜마너비용: 'callmaner_cost', 비고: 'note' };
  var dq = '';
  function dval(d, c) { var v = d[c[0]]; if (v == null) return ''; if (c[0] === 'phone') return fmtPhone(v); if (c[2] === 'n' && c[0] !== 'emp_no') return n0(v); return v; }
  function viewDrivers(v) {
    var rows = drivers.filter(function (d) { var t = (d.name + d.phone + d.emp_no + (d.team || '') + (d.deposit_group || '') + (d.ins_company || '')).toLowerCase(); return !dq || t.indexOf(dq.toLowerCase()) >= 0; })
      .filter(function (d) { return DCOL.every(function (c) { var f = dfil[c[0]]; if (!f) return true; var s = c[0] === 'ssn' ? fmtSsn(d.ssn) : String(dval(d, c)); if (c[2] === 'n') { var fv = f.replace(/[^0-9\-]/g, ''); return fv === '' || String(d[c[0]] == null ? '' : d[c[0]]) === String(parseInt(fv, 10)); } return c[0] === 'status' ? s === f : s.toLowerCase().indexOf(f.toLowerCase()) >= 0; }); })
      .sort(dcmp);
    var sum = function (k) { return rows.reduce(function (s, d) { return s + (d[k] || 0); }, 0); };
    var dfN = Object.keys(dfil).filter(function (k) { return dfil[k]; }).length, DWT = 3 + DCOL.reduce(function (s, c) { return s + DW[c[0]]; }, 0);
    var cntS = function (x) { return drivers.filter(function (d) { return (d.status || '가입') === x; }).length; };
    var selN = rows.filter(function (d) { return dsel[d.id]; }).length, allOn = rows.length > 0 && selN === rows.length;
    v.innerHTML = '<h2>기사 가입 현황 <span class="mut" style="font-size:14px">' + rows.length + '명</span></h2><div class="bar"><input type="search" id="dq" placeholder="이름·전화·사번·소속·보험사" value="' + esc(dq) + '"><button class="btn sm" id="dadd">+ 추가</button><button class="btn sm line" id="dxl">엑셀 다운로드</button><button class="btn sm line" id="dup">엑셀 업로드</button><input type="file" id="dfile" class="hid" accept=".xlsx,.xls,.csv"><span class="mut">셀을 눌러 바로 수정(전화번호는 누르면 전화, 길게 누르면 수정) · 제목을 누르면 정렬 </span></div>' +
      '<div class="sumrow"><div class="sc main"><span>순 마진 합계' + (dfN || dq ? ' (필터 결과)' : '') + '</span><b>' + n0(sum('margin')) + '원</b></div><div class="sc"><span>가입</span><b class="g">' + cntS('가입') + '명</b></div><div class="sc"><span>퇴사</span><b>' + cntS('퇴사') + '명</b></div><div class="sc"><span>미납</span><b class="y">' + cntS('미납') + '명</b></div><div class="sc"><span>월 합산 비용 합계</span><b>' + n0(sum('total_cost')) + '원</b></div></div>' +
      '<div class="selbar"><label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="dselall" style="width:18px;height:18px;padding:0"' + (allOn ? ' checked' : '') + '> 전체 선택</label><span class="mut">' + selN + '명 선택됨</span><button class="btn sm red" id="dseldel"' + (selN ? '' : ' disabled') + '>선택 삭제</button><button class="btn sm red" id="dalldel"' + (drivers.length ? '' : ' disabled') + '>전체 삭제</button>' + (dfN ? '<button class="btn sm line" id="dfclr">필터 해제 (' + dfN + ')</button>' : '') + (dsort.k ? '<button class="btn sm line" id="dsclr">정렬 해제 (기본: 가입일순)</button>' : '') + '</div>' +
      '<datalist id="srcl">' + SRC.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist><div class="tw dtw"><table class="dt"><colgroup><col style="width:' + (300 / DWT).toFixed(2) + '%">' + DCOL.map(function (c) { return '<col style="width:' + (DW[c[0]] * 100 / DWT).toFixed(2) + '%">'; }).join('') + '</colgroup><thead><tr><th class="ck"></th>' + DCOL.map(function (c) { var on = dsort.k === c[0]; return '<th class="sk" data-sk="' + c[0] + '">' + c[1] + '<i class="ar' + (on ? ' on' : '') + '">' + (on ? (dsort.dir > 0 ? '▲' : '▼') : '↕') + '</i></th>'; }).join('') + '</tr><tr class="fr"><th class="ck"></th>' + DCOL.map(function (c) {
        var k = c[0], f = dfil[k] || '';
        if (k === 'status') return '<th><select class="fi" data-k="status"><option value="">전체</option>' + STS.map(function (x) { return '<option' + (f === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></th>';
        return '<th><input class="fi" data-k="' + k + '" value="' + esc(f) + '" placeholder="필터" autocomplete="off"></th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (d) {
        return '<tr><td class="ck"><input type="checkbox" class="dk" data-id="' + d.id + '"' + (dsel[d.id] ? ' checked' : '') + '></td>' + DCOL.map(function (c) {
          var val = dval(d, c), k = c[0], t = c[2];
          var cls = 'cell' + (t === 'n' ? ' num' : '');
          if (k === 'status') return '<td data-l="상태"><select class="cell st st-' + esc(d.status || '가입') + '" data-id="' + d.id + '" data-k="status">' + STS.map(function (x) { return '<option' + ((d.status || '가입') === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td>';
          if (k === 'source') return '<td data-l="유입 경로"><input class="cell" list="srcl" data-id="' + d.id + '" data-k="source" value="' + esc(d.source || '') + '"></td>';
          if (k === 'note') return '<td data-l="비고" class="nt"><div class="note" data-id="' + d.id + '" title="' + esc(d.note || '') + '">' + (d.note ? esc(d.note) : '<span class="mut">+ 메모</span>') + '</div></td>';
          if (k === 'phone') return '<td data-l="' + c[1] + '"><input class="cell" data-id="' + d.id + '" data-k="phone" value="' + esc(val) + '" readonly title="누르면 전화 · 길게 누르거나 더블클릭하면 수정"></td>';
          if (k === 'name') return '<td data-l="성명"><b><input class="cell" data-id="' + d.id + '" data-k="name" value="' + esc(val) + '"></b></td>';
          if (k === 'ssn') return '<td data-l="주민번호"><input class="cell ssn" data-id="' + d.id + '" data-k="ssn" data-full="' + esc(fmtSsn(d.ssn)) + '" value="' + esc(maskSsn(d.ssn)) + '" maxlength="14" autocomplete="off" placeholder="000000-0000000"></td>';
          if (t === 'd') return '<td data-l="가입일"><input class="cell" type="text" inputmode="numeric" maxlength="10" data-id="' + d.id + '" data-k="' + k + '" data-n="d" placeholder="날짜 입력" value="' + esc(val) + '"></td>';
          return '<td data-l="' + c[1] + '"><input class="' + cls + '" data-id="' + d.id + '" data-k="' + k + '" data-n="' + (t || '') + '" value="' + esc(val) + '"' + '' + '></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody><tfoot><tr class="tf"><td class="ck"></td>' + DCOL.map(function (c) { var k = c[0]; if (k === 'joined_at') return '<td><b>합계</b></td>'; if (['callmaner_cost', 'daily_fee', 'insurance_cost', 'chang_fee', 'total_cost', 'margin'].indexOf(k) >= 0) return '<td><b>' + n0(sum(k)) + '</b></td>'; return '<td></td>'; }).join('') + '</tr></tfoot></table></div>' + (rows.length ? '' : '<div class="mut" style="padding:20px;text-align:center">아직 기사가 없어요. 가입 신청에서 "가입 완료 처리"를 하면 아래에 순서대로 추가돼요.</div>');
    $$('.dk', v).forEach(function (c) { c.addEventListener('change', function () { if (c.checked) dsel[c.getAttribute('data-id')] = 1; else delete dsel[c.getAttribute('data-id')]; viewDrivers(v); }); });
    $('#dselall', v).addEventListener('change', function () { var on = this.checked; rows.forEach(function (d) { if (on) dsel[d.id] = 1; else delete dsel[d.id]; }); viewDrivers(v); });
    $('#dseldel', v).addEventListener('click', function () { deleteDrivers(rows.filter(function (d) { return dsel[d.id]; }), false); });
    $('#dalldel', v).addEventListener('click', function () { deleteDrivers(drivers.slice(), true); });
    $('#dq', v).addEventListener('change', function () { dq = this.value; dsel = {}; render(); });
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
    $$('th.sk', v).forEach(function (th) { th.addEventListener('click', function () {
      var k = th.getAttribute('data-sk');
      if (dsort.k !== k) { dsort.k = k; dsort.dir = 1; } else if (dsort.dir === 1) dsort.dir = -1; else { dsort.k = null; dsort.dir = 1; }
      viewDrivers(v); }); });
    $$('.fi', v).forEach(function (f) {
      var k = f.getAttribute('data-k'), comp = false;
      var apply = function () { dfil[k] = f.value; dsel = {}; dfoc = f.tagName === 'INPUT' ? { k: k, pos: f.selectionStart } : null; viewDrivers(v); };
      if (f.tagName === 'SELECT') { f.addEventListener('change', apply); return; }
      f.addEventListener('compositionstart', function () { comp = true; });
      f.addEventListener('compositionend', function () { comp = false; apply(); });
      f.addEventListener('input', function () { if (!comp) apply(); });
    });
    if (dfoc) { var ff = $('.fi[data-k="' + dfoc.k + '"]', v); if (ff) { ff.focus(); try { ff.setSelectionRange(dfoc.pos, dfoc.pos); } catch (e) { } } dfoc = null; }
    var sc = $('#dsclr', v); if (sc) sc.addEventListener('click', function () { dsort = { k: null, dir: 1 }; viewDrivers(v); });
    var fc = $('#dfclr', v); if (fc) fc.addEventListener('click', function () { dfil = {}; dsel = {}; viewDrivers(v); });
    $$('.note', v).forEach(function (n) { n.addEventListener('click', function () { noteModal(drivers.filter(function (x) { return x.id === n.getAttribute('data-id'); })[0], v); }); });
    $$('input.cell, select.cell', v).forEach(function (i) {
      i.addEventListener('change', function () {
        var k = i.getAttribute('data-k'), val = i.value.trim(), id = i.getAttribute('data-id'), upd = {};
        var d = drivers.filter(function (x) { return x.id === id; })[0];
        if (k === 'ssn') { var dg = val.replace(/[^0-9]/g, ''); if (dg && dg.length !== 13) { toast('주민번호는 13자리로 입력해 주세요'); i.value = maskSsn(d.ssn); return; } val = dg ? fmtSsn(dg) : null; }
        else if (k === 'emp_no') { var en = parseInt(val.replace(/[^0-9]/g, ''), 10); if (!en) { toast('사번은 숫자로 입력해 주세요'); i.value = d.emp_no; return; } if (drivers.some(function (x) { return x.id !== id && x.emp_no === en; })) { toast('이미 사용 중인 사번이에요'); i.value = d.emp_no; return; } val = en; }
        else if (i.getAttribute('data-n') === 'n') { val = val === '' ? 0 : parseInt(val.replace(/[^0-9\-]/g, ''), 10); if (isNaN(val)) { toast('숫자만 입력해 주세요'); return; } }
        else if (k === 'phone') val = val.replace(/[^0-9]/g, '');
        else if (k === 'joined_at') { var dd = val === '' ? '' : toDate(val); if (dd == null) { toast('가입일은 2026-10-28 형식으로 입력해 주세요'); i.value = d.joined_at || ''; return; } val = dd || null; i.value = dd || ''; }
        else if (k !== 'name') val = val || null;
        upd[k] = val;
        if (k === 'daily_fee') upd.total_cost = calcTotal(val);
        if (['daily_fee', 'total_cost', 'chang_fee', 'insurance_cost', 'callmaner_cost'].indexOf(k) >= 0) { var nd = {}, q; for (q in d) nd[q] = d[q]; for (q in upd) nd[q] = upd[q]; upd.margin = calcMargin(nd.total_cost, nd.chang_fee, nd.insurance_cost, nd.callmaner_cost); }
        sb.from('golddriver_drivers').update(upd).eq('id', id).then(function (r) {
          if (r.error) { toast('저장 실패: ' + (/duplicate/.test(r.error.message) ? '이미 사용 중인 사번이에요' : r.error.message)); if (k === 'emp_no') i.value = d.emp_no; return; }
          for (var x in upd) d[x] = upd[x];
          if (k === 'emp_no') { viewDrivers(v); return; }
          if (i.getAttribute('data-n') === 'n' && k !== 'emp_no') i.value = n0(d[k]);
          if (k === 'ssn') { i.setAttribute('data-full', fmtSsn(val)); i.value = maskSsn(val); }
          if (upd.total_cost !== undefined || upd.margin !== undefined) { viewDrivers(v); } else { i.style.background = '#e8f7ee'; setTimeout(function () { i.style.background = ''; }, 700); }
          logAct((d.name || '') + ' 기사 ' + (DCOL.filter(function (c) { return c[0] === k; })[0][1]) + ' 수정', d.application_id);
        });
      });
    });
    var mgi = DCOL.map(function (c) { return c[0]; }).indexOf('margin') + 1;
    $$('table.dt tr', v).forEach(function (tr) { if (tr.children[mgi]) tr.children[mgi].classList.add('mg'); });
    var ams = ['callmaner_cost', 'daily_fee', 'insurance_cost', 'chang_fee', 'total_cost', 'margin'].map(function (k) { return DCOL.map(function (c) { return c[0]; }).indexOf(k) + 1; });
    $$('table.dt tr', v).forEach(function (tr) { ams.forEach(function (i) { if (tr.children[i]) tr.children[i].classList.add('am'); }); });
    $('#dadd', v).addEventListener('click', function () { addDriverModal(); });
    $('#dxl', v).addEventListener('click', function () { exportDriversXlsx(rows); });
    $('#dup', v).addEventListener('click', function () { $('#dfile', v).click(); });
    $('#dfile', v).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) importDrivers(f); });
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
    var head = DCOL.map(function (c) { return c[1]; });
    var data = [head].concat(rows.map(function (d) { return DCOL.map(function (c) { var x = c[0] === 'ssn' ? fmtSsn(d.ssn) : (c[2] === 'n' ? (d[c[0]] == null ? '' : d[c[0]]) : dval(d, c)); return x; }); }));
    var ws = XLSX.utils.aoa_to_sheet(data); ws['!cols'] = DCOL.map(function (c) { return { wch: Math.max(10, c[1].length * 2 + 2) }; });
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
        if (no != null && (byNo[no] || used[no])) { skip++; skipN.push(String(o.name).trim() + '(' + no + ')'); return; }
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
            daily_fee: 0, insurance_cost: 0, chang_fee: 17000, callmaner_cost: 0, total_cost: 0, margin: 0 };
          ['team', 'ins_company', 'insurance', 'deposit_group', 'note', 'source'].forEach(function (k) { if (o[k] != null) r[k] = String(o[k]).trim() || null; });
          if (o.phone != null) r.phone = String(o.phone).replace(/[^0-9]/g, '') || null;
          if (o.ssn != null) { var dg = String(o.ssn).replace(/[^0-9]/g, ''); if (dg.length === 12) dg = '0' + dg; r.ssn = dg.length === 13 ? fmtSsn(dg) : null; }
          if (o.joined_at != null) r.joined_at = toDate(o.joined_at);
          ['daily_fee', 'insurance_cost', 'chang_fee', 'total_cost', 'margin', 'callmaner_cost'].forEach(function (k) { var n = toInt(o[k]); if (n != null) r[k] = n; });
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

  boot();
})();
