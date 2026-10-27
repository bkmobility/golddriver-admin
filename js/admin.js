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
  var APPN = { logi: '로지', callmaner: '콜마너', aicon: '아이콘' };
  var TABS = [['home', '오늘 할 일'], ['apps', '가입 신청'], ['drivers', '가입 기사 현황'], ['pay', '결제'], ['log', '처리 기록']];
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
        adminName = a.data.name; $('#who').textContent = adminName + ' 님';
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
        return '<div class="todo"><div><b>' + esc(a.name) + '</b> ' + stTag(a.status) + '<div class="mut">' + fmtPhone(a.phone) + ' · ' + (a.signup_type === 'consult' ? '상담 ' + esc(a.call_time || '') : '바로 가입') + ' · 면허 ' + LIC[a.license_status] + ' · 결제 ' + PAY[a.payment_status] + '</div></div><div class="acts" style="margin:0"><a class="btn sm" href="' + tel(a.phone) + '">전화</a><button class="btn sm line" data-open="' + a.id + '">열기</button></div></div>';
      }).join('') : '<div class="mut" style="padding:14px 0">처리할 신청이 없어요 🎉</div>') + '</div>';
    $$('.stat[data-f]', v).forEach(function (s) { s.addEventListener('click', function () { filter = s.getAttribute('data-f'); tab = 'apps'; render(); }); });
    $$('.stat[data-go]', v).forEach(function (s) { s.addEventListener('click', function () { tab = s.getAttribute('data-go'); render(); }); });
    $$('[data-open]', v).forEach(function (b) { b.addEventListener('click', function () { openDrawer(b.getAttribute('data-open')); }); });
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
  function viewApps(v) {
    var rows = apps.filter(matchF).filter(function (a) { var t = (a.name + a.phone + (a.receipt_no || '') + (a.region || '')).toLowerCase(); return !q || t.indexOf(q.toLowerCase()) >= 0; });
    v.innerHTML = '<h2>가입 신청 <span class="mut" style="font-size:14px">' + rows.length + '건</span></h2><div class="bar"><div class="chips">' +
      FILTERS.map(function (f) { return '<button class="chip ' + (filter === f[0] ? 'on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div><input type="search" id="q" placeholder="이름·전화·접수번호" value="' + esc(q) + '"><button class="btn sm line" id="csv">엑셀(CSV) 다운로드</button></div>' +
      '<div class="tw"><table><thead><tr><th>접수번호</th><th>접수일시</th><th>상태</th><th>이름</th><th>나이</th><th>전화번호</th><th>지역</th><th>업무</th><th>방식</th><th>보험</th><th>유형</th><th>앱</th><th>면허증</th><th>결제</th><th>담당자</th></tr></thead><tbody>' +
      rows.map(function (a) {
        return '<tr class="clk s-' + a.status + '" data-id="' + a.id + '"><td data-l="접수번호">' + esc(a.receipt_no) + '</td><td data-l="접수">' + ymdhm(a.created_at) + '</td><td data-l="상태">' + stTag(a.status) + '</td><td data-l="이름"><b>' + esc(a.name) + '</b></td><td data-l="나이">' + age(a.birth_date) + '</td><td data-l="전화">' + fmtPhone(a.phone) + '</td><td data-l="지역">' + esc(a.region) + '</td><td data-l="업무">' + (WT[a.work_type] || '-') + '</td><td data-l="방식">' + (WM[a.work_mode] || '-') + '</td><td data-l="보험">' + (INS[a.insurance] || '-') + '</td><td data-l="유형">' + (a.signup_type === 'consult' ? '상담' : '바로가입') + '</td><td data-l="앱">' + esc(appsText(a)) + '</td><td data-l="면허증">' + LIC[a.license_status] + '</td><td data-l="결제">' + PAY[a.payment_status] + '</td><td data-l="담당자">' + esc(a.assignee || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (rows.length ? '' : '<div class="mut" style="padding:20px;text-align:center">해당하는 신청이 없어요</div>');
    $$('.chip', v).forEach(function (b) { b.addEventListener('click', function () { filter = b.getAttribute('data-f'); render(); }); });
    $('#q', v).addEventListener('change', function () { q = this.value; render(); });
    $$('tr.clk', v).forEach(function (r) { r.addEventListener('click', function () { openDrawer(r.getAttribute('data-id')); }); });
    $('#csv', v).addEventListener('click', function () {
      csv('가입신청_' + ymd(new Date()) + '.csv', ['접수번호', '접수일시', '상태', '이름', '생년월일', '전화번호', '지역', '기종', '업무', '방식', '보험', '유형', '앱', '통화희망', '질문', '추천인', '면허증', '결제', '담당자', '메모'],
        rows.map(function (a) { return [a.receipt_no, ymdhm(a.created_at), (ST[a.status] || [a.status])[0], a.name, a.birth_date, fmtPhone(a.phone), a.region, a.device_model, WT[a.work_type], WM[a.work_mode], INS[a.insurance], a.signup_type === 'consult' ? '상담' : '바로가입', appsText(a), a.call_time, a.question, a.referrer, LIC[a.license_status], PAY[a.payment_status], a.assignee, a.memo]; }));
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
      '<dl class="kv"><dt>생년월일</dt><dd>' + esc(a.birth_date) + ' (만 ' + age(a.birth_date) + '세)</dd><dt>전화번호</dt><dd>' + fmtPhone(a.phone) + '</dd><dt>지역/기종</dt><dd>' + esc(a.region) + ' / ' + esc(a.device_model || '-') + '</dd><dt>업무/방식</dt><dd>' + (WT[a.work_type] || '-') + ' / ' + (WM[a.work_mode] || '-') + '</dd><dt>보험</dt><dd>' + (INS[a.insurance] || '-') + '</dd><dt>사용 경험 앱</dt><dd>' + esc((a.used_apps || []).map(function (x) { return APPN[x] || x; }).join(', ') || '-') + '</dd><dt>신청 앱</dt><dd>' + esc(appsText(a)) + '</dd><dt>예상 금액</dt><dd>' + n0(a.payment_amount) + '원</dd><dt>유형</dt><dd>' + (a.signup_type === 'consult' ? '상담부터 · ' + esc(a.call_time || '') : '상담 없이 바로 가입') + '</dd><dt>궁금한 점</dt><dd>' + esc(a.question || '-') + '</dd><dt>추천인</dt><dd>' + esc(a.referrer || '-') + '</dd><dt>마케팅 동의</dt><dd>' + (a.consent_marketing ? '동의' : '미동의') + '</dd><dt>면허증</dt><dd>' + LIC[a.license_status] + '</dd><dt>결제</dt><dd>' + PAY[a.payment_status] + '</dd></dl>' +
      '<div id="licarea"></div>' +
      '<div class="grid2"><div class="f"><label>상태</label><select id="d-st">' + sOpts + '</select></div><div class="f"><label>담당자</label><input id="d-as" value="' + esc(a.assignee || '') + '"></div></div>' +
      '<div class="f"><label>메모</label><textarea id="d-memo">' + esc(a.memo || '') + '</textarea></div>' +
      '<div class="acts"><button class="btn" id="d-save">저장</button>' + (a.driver_id ? '<span class="tag g">기사 등록됨</span>' : '<button class="btn dark" id="d-reg">가입 완료 처리 → 기사 등록</button>') + '</div></div>';
    d.hidden = false;
    d.addEventListener('click', function h(e) { if (e.target === d) { d.hidden = true; d.removeEventListener('click', h); } });
    $('#dx').addEventListener('click', function () { d.hidden = true; });
    if (a.license_path) {
      sb.storage.from('golddriver-licenses').createSignedUrl(a.license_path, 600).then(function (r) {
        $('#licarea').innerHTML = r.data ? '<b>면허증</b><a href="' + r.data.signedUrl + '" target="_blank"><img class="lic" src="' + r.data.signedUrl + '"></a><div class="mut" style="font-size:12px">링크는 10분 후 만료됩니다</div>' : '<div class="err">면허증을 불러오지 못했어요</div>';
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

  function registerModal(a) {
    sb.rpc('golddriver_next_emp_no').then(function (r) {
      var m = $('#modal');
      var ins = a.insurance === 'month' ? '월보험' : '건당보험';
      m.innerHTML = '<div class="mbox"><h3>가입 완료 처리</h3><div class="mut">' + esc(a.name) + ' 님을 가입 기사로 등록합니다. 신청 상태는 "가입 완료"로 바뀝니다.</div>' +
        '<div class="grid2"><div class="f"><label>사번</label><input id="r-emp" type="number" value="' + (r.data || '') + '"></div><div class="f"><label>소속</label><input id="r-team"></div>' +
        '<div class="f"><label>보험</label><input id="r-ins" value="' + ins + '"></div><div class="f"><label>입금 그룹명</label><input id="r-dep"></div>' +
        '<div class="f"><label>월 합산 비용</label><input id="r-tot" type="number" value="' + (a.payment_amount || 0) + '"></div><div class="f"><label>월 보험비용</label><input id="r-ic" type="number" value="0"></div>' +
        '<div class="f"><label>콜마너 비용</label><input id="r-cm" type="number" value="0"></div></div><div class="f"><label>비고</label><input id="r-note"></div>' +
        '<div class="acts"><button class="btn" id="r-ok">등록</button><button class="btn line" id="r-no">취소</button></div></div>';
      m.hidden = false;
      $('#r-no').addEventListener('click', function () { m.hidden = true; });
      $('#r-ok').addEventListener('click', function () {
        var p = { emp_no: $('#r-emp').value, team: $('#r-team').value, insurance: $('#r-ins').value, deposit_group: $('#r-dep').value, total_cost: $('#r-tot').value, insurance_cost: $('#r-ic').value, callmaner_cost: $('#r-cm').value, note: $('#r-note').value };
        this.disabled = true;
        sb.rpc('golddriver_register_driver', { p_application_id: a.id, p: p }).then(function (x) {
          if (x.error) { toast('등록 실패: ' + (/duplicate/.test(x.error.message) ? '이미 사용 중인 사번이에요' : x.error.message), 5000); $('#r-ok').disabled = false; return; }
          m.hidden = true; $('#drawer').hidden = true; toast('사번 ' + x.data.emp_no + ' 번으로 기사 등록 완료!'); tab = 'drivers'; loadAll().then(render);
        });
      });
    });
  }

  /* ---------- 가입 기사 현황 ---------- */
  var DCOL = [['emp_no', '사번', 'n'], ['team', '소속'], ['name', '성명'], ['birth_date', '생년월일'], ['phone', '전화번호'], ['insurance', '보험'], ['deposit_group', '입금 그룹명'], ['total_cost', '월 합산 비용', 'n'], ['mgmt_fee', '입 관리비', 'n'], ['chang_fee', '창비', 'n'], ['insurance_cost', '월 보험비용', 'n'], ['callmaner_cost', '콜마너 비용', 'n'], ['margin', '월 마진', 'n'], ['share_gongong', '공옹', 'n'], ['share_byeonguk', '병욱', 'n'], ['share_hyeongeun', '현근', 'n'], ['note', '비고']];
  var dq = '';
  function viewDrivers(v) {
    var rows = drivers.filter(function (d) { var t = (d.name + d.phone + d.emp_no + (d.team || '') + (d.deposit_group || '')).toLowerCase(); return !dq || t.indexOf(dq.toLowerCase()) >= 0; });
    var sum = function (k) { return rows.reduce(function (s, d) { return s + (d[k] || 0); }, 0); };
    v.innerHTML = '<h2>가입 기사 현황 <span class="mut" style="font-size:14px">' + rows.length + '명</span></h2><div class="bar"><input type="search" id="dq" placeholder="이름·전화·사번·소속" value="' + esc(dq) + '"><button class="btn sm line" id="dcsv">엑셀(CSV) 다운로드</button><span class="mut">셀을 눌러 바로 수정할 수 있어요 · 월 마진 합계 ' + n0(sum('margin')) + '원</span></div>' +
      '<div class="tw"><table><thead><tr>' + DCOL.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (d) {
        return '<tr>' + DCOL.map(function (c) {
          var val = d[c[0]] == null ? '' : d[c[0]];
          if (c[0] === 'phone') return '<td data-l="전화번호"><input class="cell" data-id="' + d.id + '" data-k="phone" value="' + esc(fmtPhone(val)) + '"> <a href="' + tel(val) + '">📞</a></td>';
          if (c[0] === 'name') return '<td data-l="성명"><b><input class="cell" data-id="' + d.id + '" data-k="name" value="' + esc(val) + '"></b></td>';
          return '<td data-l="' + c[1] + '"><input class="cell ' + (c[2] === 'n' ? 'num' : '') + '" data-id="' + d.id + '" data-k="' + c[0] + '" data-n="' + (c[2] || '') + '" value="' + esc(c[2] === 'n' ? val : val) + '"' + (c[0] === 'emp_no' ? ' readonly' : '') + '></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    $('#dq', v).addEventListener('change', function () { dq = this.value; render(); });
    $$('input.cell', v).forEach(function (i) {
      i.addEventListener('change', function () {
        var k = i.getAttribute('data-k'), val = i.value.trim(), id = i.getAttribute('data-id'), upd = {};
        if (i.getAttribute('data-n') === 'n') { val = val === '' ? 0 : parseInt(val.replace(/[^0-9\-]/g, ''), 10); if (isNaN(val)) { toast('숫자만 입력해 주세요'); return; } }
        else if (k === 'phone') val = val.replace(/[^0-9]/g, '');
        else if (k === 'birth_date') val = val || null;
        else if (k !== 'name') val = val || null;
        upd[k] = val;
        var d = drivers.filter(function (x) { return x.id === id; })[0];
        sb.from('golddriver_drivers').update(upd).eq('id', id).then(function (r) {
          if (r.error) { toast('저장 실패: ' + r.error.message); return; }
          d[k] = val; i.style.background = '#e8f7ee'; setTimeout(function () { i.style.background = ''; }, 700);
          logAct((d.name || '') + ' 기사 ' + (DCOL.filter(function (c) { return c[0] === k; })[0][1]) + ' 수정', d.application_id);
        });
      });
    });
    $('#dcsv', v).addEventListener('click', function () {
      csv('가입기사현황_' + ymd(new Date()) + '.csv', DCOL.map(function (c) { return c[1]; }), rows.map(function (d) { return DCOL.map(function (c) { return c[0] === 'phone' ? fmtPhone(d.phone) : d[c[0]]; }); }));
    });
  }

  /* ---------- 결제 ---------- */
  function viewPay(v) {
    var rows = apps.filter(function (a) { return a.payment_status !== 'none' || a.signup_type === 'direct'; });
    v.innerHTML = '<h2>결제 · 안내 현황</h2><div class="panel mut">결제는 문자로 안내하는 방식이에요. 입금 확인 후 신청 상세에서 "가입 완료 처리"를 눌러 주세요.</div><div class="tw"><table><thead><tr><th>접수번호</th><th>이름</th><th>전화번호</th><th>신청 앱</th><th>예상 금액</th><th>결제</th><th>상태</th><th></th></tr></thead><tbody>' +
      rows.map(function (a) { return '<tr class="s-' + a.status + '"><td data-l="접수번호">' + esc(a.receipt_no) + '</td><td data-l="이름"><b>' + esc(a.name) + '</b></td><td data-l="전화">' + fmtPhone(a.phone) + '</td><td data-l="앱">' + esc(appsText(a)) + '</td><td data-l="금액">' + n0(a.payment_amount) + '원</td><td data-l="결제">' + PAY[a.payment_status] + '</td><td data-l="상태">' + stTag(a.status) + '</td><td><button class="btn sm line" data-open="' + a.id + '">열기</button></td></tr>'; }).join('') + '</tbody></table></div>';
    $$('[data-open]', v).forEach(function (b) { b.addEventListener('click', function () { openDrawer(b.getAttribute('data-open')); }); });
  }

  /* ---------- 처리 기록 ---------- */
  function viewLog(v) {
    v.innerHTML = '<h2>처리 기록</h2><div class="panel">' + (logs.length ? logs.map(function (l) { return '<div class="log"><span class="mut">' + ymdhm(l.created_at) + '</span> · <b>' + esc(l.admin_name) + '</b> · ' + esc(l.action) + '</div>'; }).join('') : '<div class="mut">아직 기록이 없어요</div>') + '</div>' +
      '<div class="panel"><b>백업</b><div class="mut" style="margin:4px 0 8px">무료 플랜은 자동 백업이 없어요. 주 1회 이상 아래 버튼으로 내려받아 보관해 주세요.</div><button class="btn sm line" id="bk">전체 백업 (신청 + 기사 CSV)</button></div>';
    $('#bk', v).addEventListener('click', function () {
      var ak = ['receipt_no', 'created_at', 'status', 'name', 'birth_date', 'phone', 'region', 'work_type', 'work_mode', 'insurance', 'signup_type', 'payment_status', 'license_status', 'assignee', 'memo'];
      csv('백업_가입신청_' + ymd(new Date()) + '.csv', ak, apps.map(function (a) { return ak.map(function (k) { return a[k]; }); }));
      setTimeout(function () { csv('백업_가입기사_' + ymd(new Date()) + '.csv', DCOL.map(function (c) { return c[1]; }), drivers.map(function (d) { return DCOL.map(function (c) { return d[c[0]]; }); })); }, 400);
    });
  }

  /* ---------- CSV ---------- */
  function csv(name, head, rows) {
    var cell = function (x) { x = x == null ? '' : String(x); if (/^[=+\-@]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
    var t = '﻿' + [head].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  boot();
})();
