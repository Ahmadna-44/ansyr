/* ============================================================
   app.js — منطق الموقع العام (التوجيه بين الصفحات وعرضها)
   ============================================================ */

const app = document.getElementById("app");

// ---------- الوضع الليلي / النهاري ----------
function toggleTheme() {
  const html = document.documentElement;
  const cur = html.getAttribute("data-theme");
  html.setAttribute("data-theme", cur === "light" ? "dark" : "light");
  document.getElementById("themeIcon").textContent = html.getAttribute("data-theme") === "light" ? "🌙" : "☀️";
}

// ---------- الإشعارات ----------
function myNotifications() {
  // إشعارات عامة فقط بهالعرض التجريبي (بدون تسجيل دخول لطالب معيّن)
  return notifications.slice().reverse();
}
function openNotifDrawer() {
  const list = myNotifications();
  document.getElementById("drawerRoot").innerHTML = `
    <div class="drawer-backdrop" onclick="closeNotifDrawer()"></div>
    <div class="drawer">
      <h3 style="margin-top:0;">🔔 الإشعارات</h3>
      ${list.length ? list.map(n => `
        <div class="notif-item">
          <div class="ti">${n.title}</div>
          <div class="bo">${n.body}</div>
          <div class="da">${n.date}</div>
        </div>`).join("") : `<div class="empty">لا يوجد إشعارات حالياً</div>`}
    </div>
  `;
}
function closeNotifDrawer(){ document.getElementById("drawerRoot").innerHTML = ""; }

// ---------- الاحتفال بالنجاح ----------
function launchConfetti() {
  const colors = ["#00f0ff", "#b24bff", "#ff3fa4", "#3dffa0", "#ffb84d"];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    const size = 6 + Math.random() * 6;
    el.style.width = size + "px";
    el.style.height = (size * 0.4) + "px";
    el.style.left = Math.random() * 100 + "vw";
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = (2.2 + Math.random() * 1.6) + "s";
    el.style.animationDelay = (Math.random() * 0.6) + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
}

// ---------- التوجيه ----------
function nav(hash) { location.hash = hash; }
window.addEventListener("hashchange", render);
window.addEventListener("site-config-updated", () => render());
window.addEventListener("notifications-updated", () => {});
window.addEventListener("storage", (event) => {
  if (event.key === "universitySiteConfig") { Object.assign(siteConfig, JSON.parse(event.newValue || "{}")); render(); }
  if (event.key === "universityNotifications") { notifications = JSON.parse(event.newValue || "[]"); }
});
window.addEventListener("DOMContentLoaded", async () => {
  const loaded = await loadStudentJSON();
  // تحميل الإشعارات من قاعدة البيانات المركزية حتى تظهر لكل الأجهزة والمستخدمين.
  await loadNotificationsFromServer();
  if (!loaded) app.innerHTML = `<div class="page"><div class="empty">تعذر تحميل ملفات الطلاب. ضع students1.json و students2.json و students3.json بجانب ملفات الموقع وشغّل الموقع عبر خادم محلي.</div></div>`;
  else render();
  // تحديث الإشعارات تلقائياً دون الحاجة لإعادة تحميل الصفحة.
  setInterval(loadNotificationsFromServer, 15000);
});

function render() {
  const hash = location.hash.replace("#", "") || "home";
  const [route, queryStr] = hash.split("?");
  const params = new URLSearchParams(queryStr || "");

  if (route !== "result") document.querySelectorAll(".confetti-piece").forEach(el => el.remove());

  if (route === "home") return renderHome();
  if (route === "exam-search") return renderExamSearch();
  if (route === "compare") return renderCompare();
  if (route === "appeal") return renderAppeal();
  if (route === "appeal-track") return renderAppealTrack();
  if (route === "result") return renderResult(params.get("id"));
  if (route === "subjects") return renderSubjectsHome();
  if (route === "subject") return renderSubjectRanking(params.get("key"));
  if (route === "ranking") return renderRanking();
  return renderHome();
}

// ---------- تقديم ومتابعة الاعتراضات ----------
function appealEscape(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function renderAppeal() {
  app.innerHTML = `
    <div class="page">
      <div class="back-link" onclick="nav('home')">→ رجوع للرئيسية</div>
      <h2 class="section-title">📝 تقديم اعتراض</h2>
      <div class="card appeal-card">
        <p class="muted">أدخل رقم الاكتتاب للتأكد من بيانات الطالب ثم اختر المواد التي تريد الاعتراض عليها.</p>
        <div class="field"><label>رقم الاكتتاب</label><input id="appealId" type="text" inputmode="numeric" placeholder="مثال: 5001" onkeydown="if(event.key==='Enter')loadAppealStudent()"></div>
        <button class="btn btn-glow" style="width:100%" onclick="loadAppealStudent()">متابعة ←</button>
        <div id="appealStudentBox" style="margin-top:16px;"></div>
      </div>
    </div>`;
}
function loadAppealStudent(){
  const id=document.getElementById('appealId').value.trim();
  const box=document.getElementById('appealStudentBox');
  const student=getStudentById(id);
  if(!student){box.innerHTML='<div class="empty">لا يوجد طالب بهذا الرقم.</div>';return;}
  box.innerHTML=`
    <div class="appeal-student-summary">
      <div><span>رقم الاكتتاب</span><strong class="mono">${appealEscape(student.subscriptionNumber)}</strong></div>
      <div><span>اسم الطالب</span><strong>${appealEscape(student.fullName)}</strong></div>
    </div>
    <h3 style="margin:22px 0 10px;">اختر المواد التي تريد الاعتراض عليها</h3>
    <div class="subject-check-grid">
      ${ALL_SUBJECTS.map(sub=>{const g=student.grades[sub.key]; const mark=g?.released ? gradeNumber(g.value) : null; return `<label class="subject-check"><input type="checkbox" value="${appealEscape(sub.key)}" data-subject-name="${appealEscape(sub.name)}" data-mark="${mark===null?'لم تصدر بعد':mark}" onchange="toggleAppealFormVisibility()"><span><b>${appealEscape(sub.name)}</b><small>العلامة الحالية: ${mark===null?'لم تصدر بعد':mark}</small></span></label>`;}).join('')}
      <label class="subject-check other-check"><input id="appealOther" type="checkbox" value="other" data-subject-name="غير ذلك" data-mark="—" onchange="toggleAppealFormVisibility()"><span><b>غير ذلك</b><small>لسبب أو مادة غير موجودة بالقائمة</small></span></label>
    </div>
    <div id="appealOtherHint" class="field" style="display:none;margin-top:14px;"><label>ملاحظة مطلوبة عند اختيار «غير ذلك»</label><textarea id="appealNotes" rows="4" placeholder="اكتب تفاصيل الاعتراض هنا..."></textarea></div>
    <div class="field" style="margin-top:14px;"><label>يمكنك كتابة ملاحظة إن أردت ذلك</label><textarea id="appealGeneralNotes" rows="4" placeholder="أي تفاصيل إضافية تساعد في مراجعة طلبك..."></textarea></div>
    <button id="sendAppealBtn" class="btn btn-glow" style="width:100%;margin-top:4px" disabled onclick="submitAppeal('${appealEscape(student.subscriptionNumber)}')">📨 تقديم طلب الاعتراض</button>
    <div id="appealSubmitMsg" style="margin-top:12px;"></div>`;
}
function toggleAppealFormVisibility(){
  const checks=[...document.querySelectorAll('.subject-check-grid input[type=checkbox]')];
  const selected=checks.filter(x=>x.checked);
  const other=document.getElementById('appealOther');
  document.getElementById('sendAppealBtn').disabled=!selected.length;
  document.getElementById('appealOtherHint').style.display=other?.checked?'block':'none';
}
async function submitAppeal(id){
  const student=getStudentById(id);
  const checks=[...document.querySelectorAll('.subject-check-grid input[type=checkbox]:checked')];
  const other=document.getElementById('appealOther')?.checked;
  const otherNote=document.getElementById('appealNotes')?.value.trim()||'';
  const generalNote=document.getElementById('appealGeneralNotes')?.value.trim()||'';
  if(!checks.length){return;}
  if(other && !otherNote){document.getElementById('appealSubmitMsg').innerHTML='<span class="appeal-error">⚠️ عند اختيار «غير ذلك» يجب كتابة الملاحظة المطلوبة.</span>';return;}
  const btn=document.getElementById('sendAppealBtn'); btn.disabled=true; btn.textContent='جاري إرسال الطلب...';
  const subjects=checks.map(c=>({key:c.value,name:c.dataset.subjectName,mark:c.dataset.mark,reason:c.value==='other'?otherNote:''}));
  const notes=[generalNote, otherNote].filter(Boolean).join('\n');
  try{
    const res=await fetch(apiUrl('/appeals'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscriptionNumber:String(student.subscriptionNumber),studentName:student.fullName,subjects,notes})});
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.message||'تعذر إرسال الطلب');
    app.innerHTML=`<div class="page"><div class="card center appeal-success-card"><div class="success-icon">✅</div><h2>تم تقديم طلب الاعتراض بنجاح</h2><p class="muted">احتفظ برقم الطلب لمتابعته لاحقاً.</p><div class="request-number">${appealEscape(data.appeal.requestNo)}</div><div class="appeal-student-summary" style="margin-top:18px;"><div><span>الطالب</span><strong>${appealEscape(student.fullName)}</strong></div><div><span>عدد المواد</span><strong>${subjects.length}</strong></div></div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:18px;"><button class="btn btn-glow" onclick="location.hash='appeal-track'">متابعة الطلب</button><button class="btn" onclick="nav('home')">الرئيسية</button></div></div></div>`;
  }catch(err){btn.disabled=false;btn.textContent='📨 تقديم طلب الاعتراض';document.getElementById('appealSubmitMsg').innerHTML=`<span class="appeal-error">❌ ${appealEscape(err.message)}</span>`;}
}
function renderAppealTrack(){
  app.innerHTML=`<div class="page"><div class="back-link" onclick="nav('home')">→ رجوع للرئيسية</div><h2 class="section-title">🔎 متابعة طلب اعتراض</h2><div class="card"><p class="muted">أدخل رقم الاكتتاب ورقم الطلب الذي حصلت عليه بعد إرسال الاعتراض.</p><div class="field"><label>رقم الاكتتاب</label><input id="trackId" inputmode="numeric" placeholder="مثال: 5001"></div><div class="field"><label>رقم طلب الاعتراض</label><input id="trackNo" placeholder="REQ-20260831-AB12"></div><button class="btn btn-glow" style="width:100%" onclick="trackAppeal()">متابعة الحالة</button><div id="trackResult" style="margin-top:16px"></div></div></div>`;
}
async function trackAppeal(){
  const id=document.getElementById('trackId').value.trim(); const no=document.getElementById('trackNo').value.trim().toUpperCase(); const box=document.getElementById('trackResult');
  if(!id||!no){box.innerHTML='<div class="empty">يرجى تعبئة الحقلين.</div>';return;}
  try{const res=await fetch(apiUrl(`/appeals/track?subscriptionNumber=${encodeURIComponent(id)}&requestNo=${encodeURIComponent(no)}`)); const data=await res.json(); const a=data.appeal; if(!a){box.innerHTML='<div class="empty">لم يتم العثور على طلب بهذا الرقم لهذا الطالب.</div>';return;} box.innerHTML=appealCardHTML(a,false);}catch(e){box.innerHTML=`<div class="empty">تعذر الاتصال بخدمة الاعتراضات: ${appealEscape(e.message)}</div>`;}
}
function appealCardHTML(a,adminMode){
  const statusClass={pending:'appeal-status-pending',reviewed:'appeal-status-reviewed',accepted:'appeal-status-accepted',rejected:'appeal-status-rejected'}[a.status]||'';
  return `<div class="appeal-card-inner"><div class="appeal-top"><div><b>${appealEscape(a.requestNo)}</b><div class="muted">${new Date(a.createdAt).toLocaleString('ar-SY')}</div></div><span class="appeal-status ${statusClass}">${appealEscape(a.statusLabel)}</span></div><div class="appeal-student-summary"><div><span>اسم الطالب</span><strong>${appealEscape(a.studentName)}</strong></div><div><span>رقم الاكتتاب</span><strong class="mono">${appealEscape(a.subscriptionNumber)}</strong></div></div><div class="appeal-subjects"><b>المواد المعترض عليها</b>${a.subjects.map(s=>`<div class="appeal-subject-row"><span>${appealEscape(s.name)}</span><span class="mono">${appealEscape(s.mark)}</span></div>`).join('')}</div>${a.notes?`<div class="appeal-note"><b>الملاحظة</b><p>${appealEscape(a.notes).replace(/\n/g,'<br>')}</p></div>`:''}${a.adminNote?`<div class="appeal-note admin-note"><b>ملاحظة الإدارة</b><p>${appealEscape(a.adminNote).replace(/\n/g,'<br>')}</p></div>`:''}${adminMode?`<div class="appeal-admin-actions"><select id="status-${a.id}"><option value="pending" ${a.status==='pending'?'selected':''}>قيد المراجعة</option><option value="reviewed" ${a.status==='reviewed'?'selected':''}>تمت المراجعة</option><option value="accepted" ${a.status==='accepted'?'selected':''}>مقبول</option><option value="rejected" ${a.status==='rejected'?'selected':''}>مرفوض</option></select><textarea id="adminNote-${a.id}" rows="3" placeholder="ملاحظة الإدارة...">${appealEscape(a.adminNote)}</textarea><button class="btn btn-glow" onclick="updateAppeal(${a.id})">💾 حفظ حالة الطلب</button></div>`:''}</div>`;
}

// ---------- الصفحة الرئيسية ----------
function renderHome() {
  app.innerHTML = `
    <div class="page">
      <div class="hero">
        <div class="uni-logo-lg"><img src="logo.png" alt="شعار جامعة اللاذقية"></div>
        <h1 class="display" style="font-size:26px;margin:6px 0 0;">نتائج طلاب ${siteConfig.university}</h1>
        <p>${siteConfig.college} — ${siteConfig.department}</p>
      </div>

      <h2 class="section-title center" style="margin-top:30px;">اختر الخدمة التي تريدها</h2>
      <div class="services">
        <div class="service-btn" onclick="nav('exam-search')">
          <span class="ico">📄</span>
          <div class="name">النتائج الامتحانية</div>
          <div class="desc">استعلام كامل عن نتيجتك بالاسم أو رقم الاكتتاب</div>
        </div>
        <div class="service-btn" onclick="nav('subjects')">
          <span class="ico">📊</span>
          <div class="name">علامات المواد على حدة</div>
          <div class="desc">ترتيب كل طلاب مادة معيّنة من الأعلى للأدنى</div>
        </div>
        <div class="service-btn" onclick="nav('ranking')">
          <span class="ico">🏆</span>
          <div class="name">ترتيب الطلاب</div>
          <div class="desc">الأوائل على الدفعة وترتيب باقي الطلاب</div>
        </div>
        <div class="service-btn compare-service" onclick="nav('compare')">
          <span class="ico">⚖️</span>
          <div class="name">مقارنة بين طالبين</div>
          <div class="desc">قارن المعدل العام وكل علامات الفصلين جنباً إلى جنب</div>
        </div>
        <div class="service-btn" onclick="nav('appeal')">
          <span class="ico">📝</span>
          <div class="name">تقديم اعتراض</div>
          <div class="desc">قدّم طلب اعتراض على مادة أو أكثر وتابع حالته لاحقاً</div>
        </div>
        <div class="service-btn" onclick="nav('appeal-track')">
          <span class="ico">🔎</span>
          <div class="name">متابعة طلب اعتراض</div>
          <div class="desc">اعرف حالة طلبك باستخدام رقم الاكتتاب ورقم الطلب</div>
        </div>
      </div>
    </div>
  `;
}

// ---------- البحث عن النتيجة الامتحانية ----------
let examSearchMode = "id";
function renderExamSearch() {
  app.innerHTML = `
    <div class="page">
      <div class="back-link" onclick="nav('home')">→ رجوع للرئيسية</div>
      <h2 class="section-title">النتائج الامتحانية</h2>
      <div class="tabs">
        <div class="tab ${examSearchMode==='id'?'active':''}" onclick="setExamMode('id')">🔢 حسب رقم الاكتتاب</div>
        <div class="tab ${examSearchMode==='name'?'active':''}" onclick="setExamMode('name')">🔤 حسب الاسم</div>
      </div>
      <div class="card">
        ${examSearchMode === 'id' ? `
          <div class="field">
            <label>رقم الاكتتاب</label>
            <input id="idInput" type="text" inputmode="numeric" placeholder="مثال: 5001" onkeydown="if(event.key==='Enter')searchById()">
          </div>
          <button class="btn btn-glow" style="width:100%" onclick="searchById()">بحث عن النتيجة</button>
          <div id="idResultMsg"></div>
        ` : `
          <div class="field">
            <label>اكتب حرف واحد على الأقل من الاسم الثلاثي</label>
            <input id="nameInput" type="text" placeholder="مثال: يوسف" oninput="searchByName()">
          </div>
          <div id="nameResults"></div>
        `}
      </div>
    </div>
  `;
}
function setExamMode(m){ examSearchMode = m; renderExamSearch(); }

function showResultLoading(id) {
  const root = document.getElementById("loadingRoot");
  root.innerHTML = `
    <div class="result-loading-backdrop">
      <div class="result-loading-card">
        <div class="loading-orbit">⏳</div>
        <div class="loading-title">جارِ استخراج نتيجتك</div>
        <div class="loading-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  setTimeout(() => {
    root.innerHTML = "";
    nav(`result?id=${encodeURIComponent(id)}`);
  }, 2000);
}

function searchById() {
  const id = document.getElementById("idInput").value.trim();
  const student = getStudentById(id);
  const msg = document.getElementById("idResultMsg");
  if (!student) { msg.innerHTML = `<p class="muted" style="margin-top:10px;">لا يوجد طالب بهذا الرقم</p>`; return; }
  showResultLoading(student.subscriptionNumber);
}

function searchByName() {
  const q = document.getElementById("nameInput").value;
  const box = document.getElementById("nameResults");
  if (!q.trim()) { box.innerHTML = ""; return; }
  const results = searchStudentsByName(q);
  if (!results.length) { box.innerHTML = `<div class="empty">لا يوجد نتائج مطابقة</div>`; return; }
  box.innerHTML = results.map(s => `
    <div class="stu-row" onclick="showResultLoading('${s.subscriptionNumber}')">
      <div>
        <div class="name">${s.fullName}</div>
        <div class="sub mono">رقم الاكتتاب: ${s.subscriptionNumber} — شعبة ${s.section}</div>
      </div>
      <div class="arrow">◀</div>
    </div>
  `).join("");
}

// ---------- صفحة نتيجة طالب ----------
function subjectRow(sub, g, statusOverride) {
  let cls = "pending", val = "—", st = "—";
  if (g.released) {
    const passed = g.value >= siteConfig.passingGrade;
    cls = passed ? "pass" : "fail";
    val = g.value + (g.retaken ? " *" : "");
    st = passed ? "ناجح" : "راسب";
  }
  return `<tr class="${cls}"><td class="subj">${sub.name}</td><td class="grade">${val}</td><td class="status">${st}</td></tr>`;
}

function renderResult(id) {
  const student = getStudentById(id);
  if (!student) { app.innerHTML = `<div class="page"><div class="empty">تعذر إيجاد الطالب المطلوب.</div></div>`; return; }

  const overall = overallAverage(student);
  const status = getStatus(student);
  const color = statusColor(status);
  const pct = overall ? Math.min(100, overall) : 0;
  const s1avg = semesterAverage(student, SUBJECTS_S1);
  const s2avg = semesterAverage(student, SUBJECTS_S2);
  const { high, low } = highLowSubject(student);
  const rank = rankOf(student);
  const carried = countCarried(student);
  const passedCount = countPassedReleased(student);

  const R = 54, C = 2 * Math.PI * R;
  const dash = overall ? (pct / 100) * C : 0;

  app.innerHTML = `
    <div class="page">
      <div class="back-link" onclick="nav('exam-search')">→ رجوع للبحث</div>

      <div class="result-head">
        <div class="item"><div class="k">الاسم الثلاثي</div><div class="v">${student.fullName}</div></div>
        <div class="item"><div class="k">رقم الاكتتاب</div><div class="v mono">${student.subscriptionNumber}</div></div>
        <div class="item"><div class="k">القسم</div><div class="v">${siteConfig.department}</div></div>
      </div>

      <div class="card center">
        <div class="gauge-wrap">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="${R}" stroke="var(--border)" stroke-width="12" fill="none"/>
            <circle cx="75" cy="75" r="${R}" stroke="${color}" stroke-width="12" fill="none"
              stroke-linecap="round" stroke-dasharray="${dash} ${C}"
              transform="rotate(-90 75 75)" style="filter:drop-shadow(0 0 8px ${color}); transition:stroke-dasharray 1s ease;"/>
            <text x="75" y="70" text-anchor="middle" font-family="IBM Plex Mono" font-size="24" font-weight="700" fill="var(--text)">${overall !== null ? overall + "%" : "—"}</text>
            <text x="75" y="90" text-anchor="middle" font-family="Cairo" font-size="11" fill="var(--muted)">المعدل العام</text>
          </svg>
          <div class="average-action-row">
            <div class="status-pill" style="background:${color}22; color:${color}; border:1px solid ${color};">${status}</div>
            <button class="chart-icon-btn" onclick="openStudentChart('${student.subscriptionNumber}')" title="عرض الرسم البياني للعلامات" aria-label="عرض الرسم البياني للعلامات">📊</button>
          </div>
        </div>
      </div>

      <div class="table-title">جدول نتائج الفصل الأول</div>
      <table class="grades-table">
        <tr><th style="width:52%">المادة</th><th>العلامة</th><th>الحالة</th></tr>
        ${SUBJECTS_S1.map(sub => subjectRow(sub, student.grades[sub.key])).join("")}
        <tr class="avg-row s1"><td class="subj">معدل الفصل الدراسي الأول</td><td colspan="2">${s1avg ?? "—"}</td></tr>
      </table>

      <div class="table-title">جدول نتائج الفصل الثاني</div>
      <table class="grades-table">
        <tr><th style="width:52%">المادة</th><th>العلامة</th><th>الحالة</th></tr>
        ${SUBJECTS_S2.map(sub => subjectRow(sub, student.grades[sub.key])).join("")}
        <tr class="avg-row s2"><td class="subj">معدل الفصل الدراسي الثاني</td><td colspan="2">${s2avg ?? "—"}</td></tr>
      </table>

      <div class="table-title">بطاقة الطالب</div>
      <div class="stat-grid">
        <div class="stat-box"><div class="k">أعلى علامة</div><div class="v">${high ? high.value : "—"}</div><div class="k">${high ? high.name : ""}</div></div>
        <div class="stat-box"><div class="k">أدنى علامة</div><div class="v">${low ? low.value : "—"}</div><div class="k">${low ? low.name : ""}</div></div>
        <div class="stat-box"><div class="k">الترتيب على الدفعة</div><div class="v">${rank ?? "—"}</div></div>
        <div class="stat-box"><div class="k">مواد ناجح/راسب بها</div><div class="v" dir="ltr">${passedCount} / ${carried}</div></div>
      </div>

      <div class="actions-row">
        <button class="btn btn-glow" onclick="openPrintView(getStudentById('${student.subscriptionNumber}'))">🖨️ طباعة النتيجة</button>
        <button class="btn" onclick="shareResult('${student.subscriptionNumber}')">🔗 مشاركة النتيجة</button>
      </div>
    </div>
    <div id="printHolder" style="display:none;"></div>
  `;

  if (status !== "راسب") setTimeout(launchConfetti, 350);
}

function openStudentChart(id) {
  const student = getStudentById(id);
  if (!student) return;

  const data = ALL_SUBJECTS
    .map(sub => ({
      label: sub.name,
      value: gradeNumber(student.grades[sub.key]?.value),
    }))
    .filter(x => x.value !== null);

  const chart = data.length
    ? `<div class="horizontal-grade-chart">
        ${data.map(d => {
          const value = Math.max(0, Math.min(100, d.value));
          const color = value >= siteConfig.passingGrade ? "var(--neon-green)" : "var(--neon-red)";
          return `<div class="grade-chart-row">
            <div class="grade-chart-name">${escapeHTML(d.label)}</div>
            <div class="grade-chart-track" aria-label="${escapeHTML(d.label)} ${value}%">
              <div class="grade-chart-fill" style="width:${value}%;background:${color};box-shadow:0 0 12px ${color};"></div>
            </div>
            <div class="grade-chart-value" style="color:${color}">${value}%</div>
          </div>`;
        }).join("")}
      </div>`
    : `<div class="empty">لا توجد علامات صادرة لرسمها.</div>`;

  document.getElementById("drawerRoot").innerHTML = `
    <div class="chart-modal-backdrop" onclick="closeStudentChart()"></div>
    <div class="chart-modal grade-chart-modal">
      <div class="chart-modal-head">
        <div>
          <div class="k">📊 مخطط علامات الطالب</div>
          <h3>${escapeHTML(student.fullName)}</h3>
          <div class="muted">كل مادة ممثلة بشريط أفقي حسب علامتها من 100</div>
        </div>
        <button class="icon-btn" onclick="closeStudentChart()">✕</button>
      </div>
      <div class="chart-legend"><span><i class="legend-dot pass"></i> ناجح</span><span><i class="legend-dot fail"></i> راسب</span></div>
      ${chart}
    </div>`;
}
function closeStudentChart(){ document.getElementById("drawerRoot").innerHTML = ""; }

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));
}

function shareResult(id) {
  const url = location.origin + location.pathname + `#result?id=${id}`;
  if (navigator.share) {
    navigator.share({ title: "نتيجتي الجامعية", url }).catch(()=>{});
  } else {
    navigator.clipboard?.writeText(url);
    alert("تم نسخ رابط النتيجة: " + url);
  }
}

// ---------- مقارنة طالبين ----------
function resolveStudentInput(value) {
  const q = String(value || "").trim();
  if (!q) return { error: "اكتب اسم الطالب أو رقم الاكتتاب" };
  const byId = getStudentById(q);
  if (byId) return { student: byId };
  const exact = ALL_STUDENTS.filter(s => s.fullName.trim() === q);
  if (exact.length === 1) return { student: exact[0] };
  const partial = searchStudentsByName(q);
  if (partial.length === 1) return { student: partial[0] };
  if (partial.length > 1) return { error: "وجدت أكثر من طالب بهذا الاسم، اكتب الاسم الثلاثي كاملاً أو رقم الاكتتاب" };
  return { error: "لم يتم العثور على طالب بهذا الاسم أو الرقم" };
}

function renderCompare() {
  app.innerHTML = `
    <div class="page">
      <div class="back-link" onclick="nav('home')">→ رجوع للرئيسية</div>
      <h2 class="section-title center">⚖️ مقارنة بين طالبين</h2>
      <p class="muted center">أدخل اسم الطالب أو رقم الاكتتاب لكل طالب.</p>
      <div class="compare-inputs">
        <div class="card">
          <label>الطالب الأول</label>
          <input id="compareOne" type="text" placeholder="الاسم أو رقم الاكتتاب">
        </div>
        <div class="card">
          <label>الطالب الثاني</label>
          <input id="compareTwo" type="text" placeholder="الاسم أو رقم الاكتتاب">
        </div>
      </div>
      <button class="btn btn-glow compare-submit" onclick="compareStudents()">⚖️ عرض المقارنة</button>
      <div id="compareResult"></div>
    </div>`;
}

function compareStudents() {
  const a = resolveStudentInput(document.getElementById("compareOne").value);
  const b = resolveStudentInput(document.getElementById("compareTwo").value);
  const box = document.getElementById("compareResult");
  if (!a.student || !b.student) {
    box.innerHTML = `<div class="card compare-error">⚠️ ${escapeHTML(a.error || b.error)}</div>`;
    return;
  }
  if (String(a.student.subscriptionNumber) === String(b.student.subscriptionNumber)) {
    box.innerHTML = `<div class="card compare-error">⚠️ اختر طالبين مختلفين للمقارنة.</div>`;
    return;
  }
  const students = [a.student, b.student];
  const avg = students.map(overallAverage);
  const header = students.map((s, i) => `
    <th>
      <div class="compare-name">${escapeHTML(s.fullName)}</div>
      <div class="mono compare-id">${s.subscriptionNumber}</div>
      <div class="compare-avg">${avg[i] ?? "—"}%</div>
    </th>`).join("");
  const rows = ALL_SUBJECTS.map(sub => {
    const vals = students.map(s => gradeNumber(s.grades[sub.key]?.value));
    return `<tr><td class="compare-subject">${escapeHTML(sub.name)}</td>${vals.map(v => `<td class="compare-mark">${v === null ? "—" : v + "%"}</td>`).join("")}</tr>`;
  }).join("");
  box.innerHTML = `
    <div class="table-title">نتيجة المقارنة</div>
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead><tr><th>المادة</th>${header}</tr></thead>
        <tbody>
          <tr class="compare-overall"><td>المعدل العام</td>${avg.map(v => `<td>${v ?? "—"}%</td>`).join("")}</tr>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

// ---------- علامات المواد على حدة ----------
function renderSubjectsHome() {
  app.innerHTML = `
    <div class="page">
      <div class="back-link" onclick="nav('home')">→ رجوع للرئيسية</div>
      <h2 class="section-title">اختر المادة</h2>
      <p class="muted">سيظهر ترتيب كل طلاب المادة من الأعلى علامة للأدنى</p>
      <div class="table-title">الفصل الأول</div>
      <div class="services" style="grid-template-columns:repeat(2,1fr);">
        ${SUBJECTS_S1.map(s => `<div class="service-btn" style="padding:16px 8px;" onclick="nav('subject?key=${s.key}')"><div class="name" style="font-size:14px;">${s.name}</div></div>`).join("")}
      </div>
      <div class="table-title">الفصل الثاني</div>
      <div class="services" style="grid-template-columns:repeat(2,1fr);">
        ${SUBJECTS_S2.map(s => `<div class="service-btn" style="padding:16px 8px;" onclick="nav('subject?key=${s.key}')"><div class="name" style="font-size:14px;">${s.name}</div></div>`).join("")}
      </div>
    </div>
  `;
}

function renderSubjectRanking(key) {
  const sub = ALL_SUBJECTS.find(s => s.key === key);
  if (!sub) return renderSubjectsHome();
  const ranking = subjectRanking(key);
  app.innerHTML = `
    <div class="page">
      <div class="back-link" onclick="nav('subjects')">→ رجوع لاختيار المادة</div>
      <h2 class="section-title">ترتيب طلاب مادة: ${sub.name}</h2>
      <p class="muted">عدد الطلاب الذين صدرت لهم العلامة: ${ranking.length}</p>
      ${ranking.length ? ranking.map((r, i) => `
        <div class="stu-row" onclick="nav('result?id=${r.student.subscriptionNumber}')">
          <div>
            <div class="name">${i+1}. ${r.student.fullName}</div>
            <div class="sub mono">رقم الاكتتاب: ${r.student.subscriptionNumber}</div>
          </div>
          <div class="v mono" style="font-weight:800;">${r.grade.value}</div>
        </div>
      `).join("") : `<div class="empty">لم تصدر علامات هذه المادة بعد</div>`}
    </div>
  `;
}

// ---------- ترتيب الطلاب ----------
function renderRanking() {
  const ranking = overallRanking();
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const medals = ["🥇","🥈","🥉"];
  const order = [1,0,2]; // نعرض التاني بالوسط لتأثير المنصة
  app.innerHTML = `
    <div class="page">
      <div class="back-link" onclick="nav('home')">→ رجوع للرئيسية</div>
      <h2 class="section-title center">ترتيب الطلاب على الدفعة</h2>
      <div class="podium">
        ${order.map(i => top3[i] ? `
          <div class="pod-item pod-${i+1}">
            <div class="pod-medal">${medals[i]}</div>
            <div class="pod-bar">${top3[i].avg}</div>
            <div class="pod-name">${top3[i].student.fullName}</div>
            <div class="ranking-status status-${top3[i].status === 'ناجح' ? 'pass' : top3[i].status === 'منقول' ? 'transfer' : 'fail'}">${top3[i].status}</div>
          </div>` : "").join("")}
      </div>
      ${rest.map((r, i) => `
        <div class="stu-row" onclick="nav('result?id=${r.student.subscriptionNumber}')">
          <div>
            <div class="name">${i+4}. ${r.student.fullName}</div>
            <div class="sub mono">رقم الاكتتاب: ${r.student.subscriptionNumber}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="ranking-status status-${r.status === 'ناجح' ? 'pass' : r.status === 'منقول' ? 'transfer' : 'fail'}">${r.status}</span>
            <div class="v mono" style="font-weight:800;">${r.avg}</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
