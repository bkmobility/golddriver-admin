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
  var TABS = [['home', '오늘 할 일'], ['apps', '가입 신청'], ['drivers', '기사 가입 현황'], ['pay', '결제'], ['log', '처리 기록']];
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
    ({ home: viewHome, apps: viewApps, drivers: viewDrivers, pay: viewPay, log: viewLog })[tab](v);
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
      '<div class="acts"><button class="btn" id="d-save">저장</button>' + (a.driver_id ? '<span class="tag g">기사 등록됨</span>' : '<button class="btn dark" id="d-reg">가입 완료 처리 → 기사 등록</button>') + '</div></div>';
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
  function calcTotal(daily) { daily = parseInt(daily, 10) || 0; return daily > 0 ? daily * 30 - 1000 : 0; }
  function calcMargin(total) { return Math.round((parseInt(total, 10) || 0) / 2); }
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
        '<div class="f"><label>일비</label><input id="r-daily" type="number" inputmode="numeric" value=""></div><div class="f"><label>실보험료</label><input id="r-real" type="number" inputmode="numeric" value="0"></div><div class="f"><label>콜마너 비용</label><input id="r-cm" type="number" inputmode="numeric" value="0"></div>' +
        '<div class="f"><label>월 합산 비용 (일비×30−1,000)</label><input id="r-tot" type="number" value="0"></div><div class="f"><label>순 마진 (월 합산÷2)</label><input id="r-mar" type="number" value="0"></div></div>' +
        '<div class="f"><label>비고</label><input id="r-note"></div>' +
        '<div class="acts"><button class="btn" id="r-ok">등록</button><button class="btn line" id="r-no">취소</button></div></div>';
      m.hidden = false;
      $('#r-ssn').addEventListener('input', function () { var d = this.value.replace(/[^0-9]/g, '').slice(0, 13); this.value = d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d; });
      $('#r-daily').addEventListener('input', function () { var t = calcTotal(this.value); $('#r-tot').value = t; $('#r-mar').value = calcMargin(t); });
      $('#r-tot').addEventListener('input', function () { $('#r-mar').value = calcMargin(this.value); });
      $('#r-no').addEventListener('click', function () { m.hidden = true; });
      if (a.license_path) {
        ocrSsn(a.license_path, function (msg, cls) { var o = $('#r-ocr'); if (o) { o.className = 'ocr ' + cls; o.textContent = msg; } }).then(function (s) { var el = $('#r-ssn'); if (s && el && !el.value) el.value = s; });
      } else { $('#r-ocr').textContent = '운전면허증이 아직 없어요. 받으면 직접 입력하거나 나중에 표에서 입력하세요.'; }
      $('#r-ok').addEventListener('click', function () {
        var n = function (id) { return $(id).value.trim(); };
        var p = { joined_at: n('#r-date'), emp_no: n('#r-emp'), team: n('#r-team'), name: n('#r-name'), ssn: n('#r-ssn'), phone: n('#r-phone'), ins_company: n('#r-co'), insurance: n('#r-ins'), deposit_group: n('#r-dep'),
          daily_fee: n('#r-daily'), insurance_cost: n('#r-real'), callmaner_cost: n('#r-cm'), total_cost: n('#r-tot'), margin: n('#r-mar'), note: n('#r-note') };
        if (p.ssn && p.ssn.replace(/[^0-9]/g, '').length !== 13) { toast('주민번호는 13자리로 입력해 주세요'); return; }
        this.disabled = true;
        sb.rpc('golddriver_register_driver', { p_application_id: a.id, p: p }).then(function (x) {
          if (x.error) { toast('등록 실패: ' + (/duplicate/.test(x.error.message) ? '이미 사용 중인 사번이에요' : x.error.message), 5000); $('#r-ok').disabled = false; return; }
          m.hidden = true; $('#drawer').hidden = true; toast('사번 ' + x.data.emp_no + ' 번으로 등록 완료!'); tab = 'drivers'; loadAll().then(render);
        });
      });
    });
  }

  /* ---------- 기사 가입 현황 ---------- */
  var DCOL = [['joined_at', '가입일', 'd'], ['emp_no', '사번', 'n'], ['team', '소속'], ['name', '성명'], ['ssn', '주민번호', 's'], ['phone', '핸드폰 번호'], ['ins_company', '보험 회사명'], ['insurance', '보험 종류'], ['deposit_group', '입금 그룹명'],
    ['daily_fee', '일비', 'n'], ['insurance_cost', '실보험료', 'n'], ['total_cost', '월 합산 비용', 'n'], ['margin', '순 마진', 'n'], ['callmaner_cost', '콜마너 비용', 'n']];
  var DALIAS = { 가입일: 'joined_at', 사번: 'emp_no', 소속: 'team', 성명: 'name', 이름: 'name', 주민번호: 'ssn', 주민등록번호: 'ssn', 핸드폰번호: 'phone', 휴대폰번호: 'phone', 전화번호: 'phone', 핸드폰: 'phone', 보험회사명: 'ins_company', 보험회사: 'ins_company',
    보험종류: 'insurance', 보험: 'insurance', 입금그룹명: 'deposit_group', 일비: 'daily_fee', 실보험료: 'insurance_cost', 월보험비용: 'insurance_cost', 월합산비용: 'total_cost', 순마진: 'margin', 월마진: 'margin', 콜마너비용: 'callmaner_cost', 비고: 'note' };
  var dq = '';
  function dval(d, c) { var v = d[c[0]]; if (v == null) return ''; if (c[0] === 'phone') return fmtPhone(v); return v; }
  function viewDrivers(v) {
    var rows = drivers.filter(function (d) { var t = (d.name + d.phone + d.emp_no + (d.team || '') + (d.deposit_group || '') + (d.ins_company || '')).toLowerCase(); return !dq || t.indexOf(dq.toLowerCase()) >= 0; })
      .sort(function (a, b) { return a.emp_no - b.emp_no; });
    var sum = function (k) { return rows.reduce(function (s, d) { return s + (d[k] || 0); }, 0); };
    v.innerHTML = '<h2>기사 가입 현황 <span class="mut" style="font-size:14px">' + rows.length + '명</span></h2><div class="bar"><input type="search" id="dq" placeholder="이름·전화·사번·소속·보험사" value="' + esc(dq) + '"><button class="btn sm line" id="dxl">엑셀 다운로드</button><button class="btn sm line" id="dup">엑셀 업로드</button><input type="file" id="dfile" class="hid" accept=".xlsx,.xls,.csv"><span class="mut">셀을 눌러 바로 수정 · 순 마진 합계 ' + n0(sum('margin')) + '원</span></div>' +
      '<div class="tw"><table><thead><tr>' + DCOL.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (d) {
        return '<tr>' + DCOL.map(function (c) {
          var val = dval(d, c), k = c[0], t = c[2];
          var cls = 'cell' + (t === 'n' ? ' num' : '');
          if (k === 'phone') return '<td data-l="' + c[1] + '"><input class="cell" data-id="' + d.id + '" data-k="phone" value="' + esc(val) + '"> <a href="' + tel(d.phone) + '">📞</a></td>';
          if (k === 'name') return '<td data-l="성명"><b><input class="cell" data-id="' + d.id + '" data-k="name" value="' + esc(val) + '"></b></td>';
          if (k === 'ssn') return '<td data-l="주민번호"><input class="cell ssn" data-id="' + d.id + '" data-k="ssn" data-full="' + esc(fmtSsn(d.ssn)) + '" value="' + esc(maskSsn(d.ssn)) + '" maxlength="14" autocomplete="off" placeholder="000000-0000000"></td>';
          if (t === 'd') return '<td data-l="가입일"><input class="cell" type="date" data-id="' + d.id + '" data-k="' + k + '" data-n="d" value="' + esc(val) + '"></td>';
          return '<td data-l="' + c[1] + '"><input class="' + cls + '" data-id="' + d.id + '" data-k="' + k + '" data-n="' + (t || '') + '" value="' + esc(val) + '"' + (k === 'emp_no' ? ' readonly' : '') + '></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' + (rows.length ? '' : '<div class="mut" style="padding:20px;text-align:center">아직 기사가 없어요. 가입 신청에서 "가입 완료 처리"를 하면 아래에 순서대로 추가돼요.</div>');
    $('#dq', v).addEventListener('change', function () { dq = this.value; render(); });
    $$('input.ssn', v).forEach(function (i) {
      i.addEventListener('focus', function () { i.value = i.getAttribute('data-full') || ''; });
      i.addEventListener('input', function () { var d = i.value.replace(/[^0-9]/g, '').slice(0, 13); i.value = d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d; });
      i.addEventListener('blur', function () { i.value = maskSsn(i.value); });
    });
    $$('input.cell', v).forEach(function (i) {
      i.addEventListener('change', function () {
        var k = i.getAttribute('data-k'), val = i.value.trim(), id = i.getAttribute('data-id'), upd = {};
        var d = drivers.filter(function (x) { return x.id === id; })[0];
        if (k === 'ssn') { var dg = val.replace(/[^0-9]/g, ''); if (dg && dg.length !== 13) { toast('주민번호는 13자리로 입력해 주세요'); i.value = maskSsn(d.ssn); return; } val = dg ? fmtSsn(dg) : null; }
        else if (i.getAttribute('data-n') === 'n') { val = val === '' ? 0 : parseInt(val.replace(/[^0-9\-]/g, ''), 10); if (isNaN(val)) { toast('숫자만 입력해 주세요'); return; } }
        else if (k === 'phone') val = val.replace(/[^0-9]/g, '');
        else if (k !== 'name') val = val || null;
        upd[k] = val;
        if (k === 'daily_fee') { upd.total_cost = calcTotal(val); upd.margin = calcMargin(upd.total_cost); }
        else if (k === 'total_cost') upd.margin = calcMargin(val);
        sb.from('golddriver_drivers').update(upd).eq('id', id).then(function (r) {
          if (r.error) { toast('저장 실패: ' + r.error.message); return; }
          for (var x in upd) d[x] = upd[x];
          if (k === 'ssn') { i.setAttribute('data-full', fmtSsn(val)); i.value = maskSsn(val); }
          if (upd.total_cost !== undefined || upd.margin !== undefined) { viewDrivers(v); } else { i.style.background = '#e8f7ee'; setTimeout(function () { i.style.background = ''; }, 700); }
          logAct((d.name || '') + ' 기사 ' + (DCOL.filter(function (c) { return c[0] === k; })[0][1]) + ' 수정', d.application_id);
        });
      });
    });
    $('#dxl', v).addEventListener('click', function () { exportDriversXlsx(rows); });
    $('#dup', v).addEventListener('click', function () { $('#dfile', v).click(); });
    $('#dfile', v).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) importDrivers(f); });
  }
  function exportDriversXlsx(rows) {
    var head = DCOL.map(function (c) { return c[1]; });
    var data = [head].concat(rows.map(function (d) { return DCOL.map(function (c) { var x = c[0] === 'ssn' ? fmtSsn(d.ssn) : dval(d, c); return x; }); }));
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
    var wb = XLSX.read(buf, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
    var raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    if (!raw.length) return { rows: [], bad: 0 };
    var head = raw[0].map(function (h) { return DALIAS[String(h).replace(/\s+/g, '')] || null; });
    var rows = [], bad = 0;
    raw.slice(1).forEach(function (r) {
      var o = {}, any = false;
      head.forEach(function (k, i) { if (!k) return; var x = r[i]; if (x === '' || x == null) return; any = true; o[k] = x; });
      if (!any) return;
      if (!o.name) { bad++; return; }
      rows.push(o);
    });
    return { rows: rows, bad: bad, hasHead: head.some(Boolean) };
  }
  function importDrivers(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var P; try { P = parseDriverSheet(new Uint8Array(fr.result)); } catch (e) { toast('엑셀 파일을 읽지 못했어요', 5000); return; }
      if (!P.hasHead || !P.rows.length) { toast('가져올 기사 정보가 없어요. 첫 줄에 "성명, 사번…" 제목이 있는 파일인지 확인해 주세요.', 6000); return; }
      var byNo = {}; drivers.forEach(function (d) { byNo[d.emp_no] = d; });
      var maxNo = drivers.reduce(function (s, d) { return Math.max(s, d.emp_no); }, 5325), used = {};
      var plan = P.rows.map(function (o) {
        var no = toInt(o.emp_no); if (no == null || used[no]) no = null;
        if (no == null) { while (byNo[maxNo + 1] || used[maxNo + 1]) maxNo++; no = ++maxNo; }
        used[no] = 1; if (no > maxNo) maxNo = no;
        return { no: no, o: o, old: byNo[no] || null };
      });
      var upd = plan.filter(function (p) { return p.old; }).length, add = plan.length - upd;
      var m = $('#modal');
      m.innerHTML = '<div class="mbox"><h3>엑셀 업로드</h3><div class="mut">' + esc(file.name) + '</div><div style="margin:10px 0;line-height:1.7">새로 추가 <b>' + add + '명</b> · 기존 사번 수정 <b>' + upd + '명</b>' + (P.bad ? ' · 성명이 없어 건너뜀 ' + P.bad + '줄' : '') + '<br><span class="mut">사번이 비어 있으면 현재 마지막 사번 다음부터 순서대로 붙고, 같은 사번이 있으면 엑셀에 적힌 칸만 덮어써요. 비어 있는 칸은 기존 값을 유지해요.</span></div><div class="acts"><button class="btn" id="u-ok">반영하기</button><button class="btn line" id="u-no">취소</button></div></div>';
      m.hidden = false;
      $('#u-no').addEventListener('click', function () { m.hidden = true; });
      $('#u-ok').addEventListener('click', function () {
        this.disabled = true;
        var recs = plan.map(function (p) {
          var o = p.o, r = p.old ? JSON.parse(JSON.stringify(p.old)) : { team: '골드 2팀', joined_at: todayStr(), total_cost: 0, margin: 0, daily_fee: 0, insurance_cost: 0, callmaner_cost: 0, mgmt_fee: 0, chang_fee: 0, share_gongong: 0, share_byeonguk: 0, share_hyeongeun: 0 };
          r.emp_no = p.no; r.name = String(o.name).trim();
          ['team', 'ins_company', 'insurance', 'deposit_group', 'note'].forEach(function (k) { if (o[k] != null) r[k] = String(o[k]).trim() || null; });
          if (o.phone != null) r.phone = String(o.phone).replace(/[^0-9]/g, '') || null;
          if (o.ssn != null) { var dg = String(o.ssn).replace(/[^0-9]/g, ''); if (dg.length === 12) dg = '0' + dg; r.ssn = dg.length === 13 ? fmtSsn(dg) : (r.ssn || null); }
          if (o.joined_at != null) r.joined_at = toDate(o.joined_at) || r.joined_at;
          ['daily_fee', 'insurance_cost', 'total_cost', 'margin', 'callmaner_cost'].forEach(function (k) { var n = toInt(o[k]); if (n != null) r[k] = n; });
          if (o.daily_fee != null && o.total_cost == null) r.total_cost = calcTotal(r.daily_fee);
          if ((o.daily_fee != null || o.total_cost != null) && o.margin == null) r.margin = calcMargin(r.total_cost);
          delete r.created_at; delete r.updated_at;
          return r;
        });
        var news = recs.filter(function (r) { return !r.id; }), olds = recs.filter(function (r) { return r.id; });
        var jobs = [];
        if (olds.length) jobs.push(sb.from('golddriver_drivers').upsert(olds, { onConflict: 'id' }));
        if (news.length) jobs.push(sb.from('golddriver_drivers').insert(news));
        Promise.all(jobs).then(function (rs) {
          var er = rs.filter(function (x) { return x.error; })[0];
          if (er) { toast('반영 실패: ' + er.error.message, 6000); $('#u-ok').disabled = false; return; }
          logAct('엑셀 업로드: 추가 ' + add + '명, 수정 ' + upd + '명 (' + file.name + ')', null);
          m.hidden = true; toast('추가 ' + add + '명 · 수정 ' + upd + '명 반영했어요'); loadAll().then(render);
        });
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

  /* ---------- CSV ---------- */
  function csv(name, head, rows) {
    var cell = function (x) { x = x == null ? '' : String(x); if (/^[=+\-@]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
    var t = '﻿' + [head].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  boot();
})();
