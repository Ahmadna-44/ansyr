/* ============================================================
   admin.js — منطق لوحة التحكم (موقع منفصل بالكامل عن موقع الطلاب)
   ملاحظة: هاد نموذج أولي بالمتصفح فقط، التغييرات بتضل بالجلسة الحالية.
   لحفظ دائم لازم تربط أزرار الحفظ هون بقاعدة بيانات/سيرفر حقيقي.
   ============================================================ */

const admin = document.getElementById("admin");
let adminTab = "dashboard";
let adminAppeals = [];
let adminAppealFilter = "all";

function setAdminTab(t) { adminTab = t; renderAdmin(); }

function renderAdmin() {
  admin.innerHTML = `
    <div class="page">
      <div class="tabs">
        <div class="tab ${adminTab==='dashboard'?'active':''}" onclick="setAdminTab('dashboard')">📊 لوحة الإحصائيات</div>
        <div class="tab ${adminTab==='notif'?'active':''}" onclick="setAdminTab('notif')">🔔 الإشعارات</div>
        <div class="tab ${adminTab==='appeals'?'active':''}" onclick="setAdminTab('appeals')">📝 طلبات الاعتراض</div>
        <div class="tab ${adminTab==='statusRanking'?'active':''}" onclick="setAdminTab('statusRanking')">🏆 ترتيب الحالات</div>
        <div class="tab ${adminTab==='settings'?'active':''}" onclick="setAdminTab('settings')">⚙️ شروط النجاح</div>
      </div>
      <div id="adminBody"></div>
    </div>
  `;
  if (adminTab === "dashboard") renderDashboard();
  if (adminTab === "notif") renderNotifAdmin();
  if (adminTab === "appeals") renderAppealsAdmin();
  if (adminTab === "statusRanking") renderStatusRankingAdmin();
  if (adminTab === "settings") renderSettings();
  if (adminTab === "appeals") loadAppealsAdmin();
}

// ---------- لوحة الإحصائيات ----------
function renderDashboard() {
  const counts = statusCounts();
  const selected = window.adminCarriedFilter ?? null;
  const carriedGroups = Array.from({length: ALL_SUBJECTS.length + 1}, (_, i) => {
    const students = ALL_STUDENTS.filter(s => countCarried(s) === i);
    return { count: i, students };
  });

  document.getElementById("adminBody").innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <h3 style="margin-top:0;">توزّع حالات الطلاب</h3>
      <div class="admin-status-grid">
        <div class="stat-box"><span>🟢 ناجحون</span><b class="mono">${counts["ناجح"]}</b></div>
        <div class="stat-box"><span>🟠 منقولون</span><b class="mono">${counts["منقول"]}</b></div>
        <div class="stat-box"><span>🔴 راسبون</span><b class="mono">${counts["راسب"]}</b></div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">الطلاب حسب عدد المواد المحمولة</h3>
      <p class="muted" style="margin-top:-4px;">اختر العدد لعرض أسماء الطلاب. يشمل من حامل مادة واحدة حتى 13 مادة، إضافةً إلى الطلاب الذين لا يحملون أي مادة.</p>
      <div class="carried-filter-grid">
        ${carriedGroups.map(g => `
          <button class="carried-filter ${selected === g.count ? 'active' : ''}" onclick="selectCarriedFilter(${g.count})">
            <span>${g.count === 0 ? 'ولا مادة' : `حامل ${g.count} ${g.count === 1 ? 'مادة' : 'مواد'}`}</span>
            <b>${g.students.length}</b>
          </button>
        `).join("")}
      </div>
      <div id="carriedStudentsList" style="margin-top:16px;">
        ${selected === null ? `<div class="empty">اختر عدد المواد المحمولة لعرض أسماء الطلاب.</div>` : renderCarriedStudents(selected)}
      </div>
    </div>
  `;
}

function selectCarriedFilter(count) {
  window.adminCarriedFilter = count;
  renderDashboard();
}

function renderCarriedStudents(count) {
  const students = ALL_STUDENTS.filter(s => countCarried(s) === count);
  const title = count === 0 ? "طلاب لا يحملون أي مادة" : `طلاب يحملون ${count} ${count === 1 ? "مادة" : "مواد"}`;
  if (!students.length) return `<div class="empty"><b>${title}</b><br>لا يوجد طلاب ضمن هذه الفئة.</div>`;
  return `
    <div class="carried-list-title">${title} <span>${students.length} طالب</span></div>
    ${students.map((s, i) => `
      <div class="stu-row admin-student-row">
        <div>
          <div class="name">${i + 1}. ${s.fullName}</div>
          <div class="sub mono">رقم الاكتتاب: ${s.subscriptionNumber} — شعبة ${s.section}</div>
        </div>
        <div class="carried-badge">${count === 0 ? 'لا يحمل' : `${count} مادة`}</div>
      </div>
    `).join("")}
  `;
}

// ---------- ترتيب الطلاب حسب الحالة ----------
function renderStatusRankingAdmin() {
  const groups = [
    { status: "ناجح", icon: "🟢", label: "الناجحون", color: "var(--neon-green)" },
    { status: "منقول", icon: "🟠", label: "المنقولون", color: "var(--neon-amber)" },
    { status: "راسب", icon: "🔴", label: "الراسبون", color: "var(--neon-red)" },
  ];

  document.getElementById("adminBody").innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <h3 style="margin-top:0;">أسماء الطلاب ومعدلاتهم حسب الحالة</h3>
      <p class="muted" style="margin-top:-4px;">كل قائمة مرتبة من أعلى معدل إلى أدنى معدل، والحالة محسوبة وفق شروط النجاح الحالية.</p>
    </div>
    <div class="status-ranking-grid">
      ${groups.map(group => {
        const ranking = statusRanking(group.status);
        return `
          <div class="card status-ranking-card">
            <div class="status-ranking-head" style="border-color:${group.color};">
              <div><span class="status-icon">${group.icon}</span><strong>${group.label}</strong></div>
              <span class="count-pill">${ranking.length}</span>
            </div>
            <div class="status-ranking-list">
              ${ranking.length ? ranking.map((r, i) => `
                <div class="stu-row admin-ranking-row" onclick="window.location.href='index.html#result?id=${r.student.subscriptionNumber}'">
                  <div>
                    <div class="name">${i + 1}. ${r.student.fullName}</div>
                    <div class="sub mono">رقم الاكتتاب: ${r.student.subscriptionNumber} — ${r.carried === 0 ? 'لا يحمل مواد' : `يحمل ${r.carried} ${r.carried === 1 ? 'مادة' : 'مواد'}`}</div>
                  </div>
                  <div class="rank-average mono">${r.avg}</div>
                </div>
              `).join("") : `<div class="empty">لا يوجد طلاب ضمن هذه الحالة.</div>`}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ---------- إدارة طلبات الاعتراض ----------
async function loadAppealsAdmin(){
  const body=document.getElementById('adminBody');
  if(body) body.innerHTML='<div class="card"><div class="empty">جاري تحميل طلبات الاعتراض...</div></div>';
  try{
    const res=await fetch(apiUrl('/admin/appeals'),{headers:{'X-Admin-Key':ADMIN_API_KEY}});
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.message||'تعذر تحميل الطلبات');
    adminAppeals=data.appeals||[]; renderAppealsAdmin();
  }catch(e){ if(body) body.innerHTML=`<div class="card"><div class="empty">❌ تعذر تحميل طلبات الاعتراض: ${escapeHtml(e.message)}</div></div>`; }
}
function renderAppealsAdmin(){
  const filtered=adminAppeals.filter(a=>adminAppealFilter==='all'||a.status===adminAppealFilter);
  const counts={all:adminAppeals.length,pending:adminAppeals.filter(a=>a.status==='pending').length,reviewed:adminAppeals.filter(a=>a.status==='reviewed').length,accepted:adminAppeals.filter(a=>a.status==='accepted').length,rejected:adminAppeals.filter(a=>a.status==='rejected').length};
  document.getElementById('adminBody').innerHTML=`<div class="card appeal-admin-header"><div><h3 style="margin:0 0 6px;">📋 طلبات الاعتراض</h3><p class="muted" style="margin:0;">كل طلب يظهر معه اسم الطالب، رقم الاكتتاب، المواد المعترض عليها، الملاحظات وحالة المراجعة.</p></div><button class="btn" onclick="loadAppealsAdmin()">↻ تحديث</button></div><div class="appeal-filter-grid">${[['all','الكل'],['pending','قيد المراجعة'],['reviewed','تمت المراجعة'],['accepted','مقبول'],['rejected','مرفوض']].map(([k,label])=>`<button class="appeal-filter ${adminAppealFilter===k?'active':''}" onclick="setAppealFilter('${k}')"><span>${label}</span><b>${counts[k]}</b></button>`).join('')}</div>${filtered.length?filtered.map(a=>appealAdminCard(a)).join(''):'<div class="card"><div class="empty">لا توجد طلبات ضمن هذا التصنيف.</div></div>'}`;
}
function setAppealFilter(v){adminAppealFilter=v;renderAppealsAdmin();}
function appealAdminCard(a){
  const cls={pending:'appeal-status-pending',reviewed:'appeal-status-reviewed',accepted:'appeal-status-accepted',rejected:'appeal-status-rejected'}[a.status]||'';
  return `<div class="card appeal-admin-card"><div class="appeal-top"><div><div class="request-number small">${escapeHtml(a.requestNo)}</div><div class="muted">${new Date(a.createdAt).toLocaleString('ar-SY')}</div></div><span class="appeal-status ${cls}">${escapeHtml(a.statusLabel)}</span></div><div class="appeal-student-summary"><div><span>اسم الطالب</span><strong>${escapeHtml(a.studentName)}</strong></div><div><span>رقم الاكتتاب</span><strong class="mono">${escapeHtml(a.subscriptionNumber)}</strong></div></div><div class="appeal-subjects"><b>المواد المعترض عليها (${a.subjects.length})</b>${a.subjects.map(s=>`<div class="appeal-subject-row"><span>${escapeHtml(s.name)}</span><span class="mono">العلامة: ${escapeHtml(s.mark)}</span></div>`).join('')}</div>${a.notes?`<div class="appeal-note"><b>ملاحظة الطالب</b><p>${escapeHtml(a.notes).replace(/\n/g,'<br>')}</p></div>`:''}<div class="appeal-admin-actions"><label>حالة الطلب</label><select id="status-${a.id}"><option value="pending" ${a.status==='pending'?'selected':''}>قيد المراجعة</option><option value="reviewed" ${a.status==='reviewed'?'selected':''}>تمت المراجعة</option><option value="accepted" ${a.status==='accepted'?'selected':''}>مقبول</option><option value="rejected" ${a.status==='rejected'?'selected':''}>مرفوض</option></select><label>رد / ملاحظة الإدارة</label><textarea id="adminNote-${a.id}" rows="3" placeholder="اكتب قرارك أو ملاحظتك للطالب...">${escapeHtml(a.adminNote)}</textarea><button class="btn btn-glow" onclick="updateAppeal(${a.id})">💾 حفظ التعديل</button></div></div>`;
}
async function updateAppeal(id){
  const status=document.getElementById(`status-${id}`).value; const adminNote=document.getElementById(`adminNote-${id}`).value.trim();
  try{const res=await fetch(apiUrl(`/admin/appeals/${id}`),{method:'PATCH',headers:{'Content-Type':'application/json','X-Admin-Key':ADMIN_API_KEY},body:JSON.stringify({status,adminNote})});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.message||'فشل الحفظ');const idx=adminAppeals.findIndex(a=>a.id===id);if(idx>=0)adminAppeals[idx]=data.appeal;renderAppealsAdmin();}catch(e){alert('تعذر حفظ الطلب: '+e.message);}
}

// ---------- إدارة الإشعارات ----------
function targetOptionsHTML() {
  let opts = `<option value="all">جميع الطلاب</option>`;
  for (let i = 1; i <= 13; i++) {
    opts += `<option value="carried:${i}">الحاملين ${i} ${i === 1 ? "مادة" : "مواد"}</option>`;
  }
  return opts;
}

function renderNotifAdmin() {
  document.getElementById("adminBody").innerHTML = `
    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin-top:0;">إرسال إشعار جديد</h3>
      <div class="field">
        <label>عنوان الإشعار</label>
        <input id="nTitle" type="text" placeholder="اكتب عنوان الإشعار">
      </div>
      <div class="field">
        <label>نص الإشعار</label>
        <textarea id="nBody" rows="5" placeholder="اكتب نص الإشعار هنا..."></textarea>
      </div>

      <div class="field">
        <label>الإشعار لـ</label>
        <select id="nTarget" onchange="toggleStudentTarget()">
          ${targetOptionsHTML()}
          <option value="student">طالب محدد</option>
        </select>
      </div>

      <div class="field" id="studentTargetBox" style="display:none;">
        <label>رقم الاكتتاب</label>
        <input id="nStudentId" type="number" inputmode="numeric" placeholder="ضع رقم الاكتتاب">
        <div id="studentTargetHint" class="muted" style="margin-top:6px;"></div>
      </div>

      <button class="btn btn-glow" style="width:100%;" onclick="addNotification()">📨 إرسال الإشعار</button>
    </div>

    <h3>الإشعارات الحالية</h3>
    ${notifications.slice().reverse().map(n => `
      <div class="notif-item" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div>
          <div class="ti">${escapeHtml(n.title)}</div>
          <div class="bo">${escapeHtml(n.body).replace(/\n/g, '<br>')}</div>
          <div class="da">${targetLabel(n.target)} — ${n.date}</div>
        </div>
        <button class="icon-btn" onclick="deleteNotification(${n.id})" title="حذف">🗑️</button>
      </div>
    `).join("") || `<div class="empty">لا يوجد إشعارات</div>`}
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));
}

function toggleStudentTarget() {
  const select = document.getElementById("nTarget");
  const box = document.getElementById("studentTargetBox");
  if (!select || !box) return;
  const isStudent = select.value === "student";
  box.style.display = isStudent ? "block" : "none";
  if (!isStudent) {
    const input = document.getElementById("nStudentId");
    if (input) input.value = "";
  }
}

function targetLabel(target) {
  if (target === "all") return "جميع الطلاب";
  if (target === "student") return "طالب محدد";
  if (target.startsWith("student:")) {
    const id = target.split(":")[1];
    const s = getStudentById(id);
    return "طالب محدد: " + (s ? `${s.fullName} (${id})` : id);
  }
  if (target.startsWith("carried:")) return "الحاملين " + target.split(":")[1] + " مادة";
  return target;
}

async function loadAdminNotifications() {
  try {
    const res = await fetch(apiUrl("/notifications"), { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "تعذر تحميل الإشعارات");
    notifications = Array.isArray(data.notifications) ? data.notifications : [];
    saveNotificationsToStorage();
    return true;
  } catch (e) {
    console.warn("تعذر الاتصال بقاعدة بيانات الإشعارات، سيتم استخدام النسخة المحلية مؤقتاً.", e);
    return false;
  }
}

async function addNotification() {
  const title = document.getElementById("nTitle").value.trim();
  const body = document.getElementById("nBody").value.trim();
  const selectedTarget = document.getElementById("nTarget").value;

  if (!title || !body) {
    alert("الرجاء تعبئة عنوان الإشعار ونص الإشعار");
    return;
  }

  let target = selectedTarget;
  if (selectedTarget === "student") {
    const id = document.getElementById("nStudentId").value.trim();
    if (!id) {
      alert("الرجاء وضع رقم الاكتتاب للطالب المحدد");
      return;
    }
    const student = getStudentById(id);
    if (!student) {
      alert("رقم الاكتتاب غير موجود ضمن بيانات الطلاب");
      return;
    }
    target = `student:${id}`;
  }

  try {
    const res = await fetch(apiUrl("/admin/notifications"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": ADMIN_API_KEY },
      body: JSON.stringify({ title, body, target })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "فشل إرسال الإشعار");
    notifications.unshift(data.notification);
    saveNotificationsToStorage();
    renderNotifAdmin();
  } catch (e) {
    alert("تعذر إرسال الإشعار إلى قاعدة البيانات: " + e.message);
  }
}

async function deleteNotification(id) {
  if (!confirm("هل تريد حذف هذا الإشعار من الموقع عند جميع المستخدمين؟")) return;
  try {
    const res = await fetch(apiUrl(`/admin/notifications/${id}`), {
      method: "DELETE",
      headers: { "X-Admin-Key": ADMIN_API_KEY }
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "فشل حذف الإشعار");
    notifications = notifications.filter(n => n.id !== id);
    saveNotificationsToStorage();
    renderNotifAdmin();
  } catch (e) {
    alert("تعذر حذف الإشعار: " + e.message);
  }
}

// ---------- شروط النجاح ----------
function renderSettings() {
  document.getElementById("adminBody").innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">تعديل علامة النجاح وشروط الحالات</h3>
      <p class="muted">هاي الإعدادات بتتحكم بحساب حالة كل الطلاب (ناجح / منقول / راسب) بشكل فوري بكل الموقع.</p>
      <div class="field"><label>علامة النجاح بكل مادة (من 100)</label><input id="cfgPass" type="number" value="${siteConfig.passingGrade}"></div>
      <div class="field"><label>ناجح: عدد المواد المحمولة يساوي أو أقل من</label><input id="cfgPassMax" type="number" value="${siteConfig.passMaxCarried}"></div>
      <div class="field"><label>منقول: من مادة محمولة وحتى</label><input id="cfgTransferMax" type="number" value="${siteConfig.transferMaxCarried}"></div>
      <div class="field"><label>راسب: عدد المواد المحمولة يساوي أو أكثر من</label><input id="cfgFailMin" type="number" value="${siteConfig.failMinCarried}"></div>
      <button class="btn btn-glow" style="width:100%" onclick="saveSettings()">حفظ الإعدادات</button>
      <div id="saveMsg" style="margin-top:10px;"></div>
    </div>
  `;
}
function saveSettings() {
  siteConfig.passingGrade = +document.getElementById("cfgPass").value;
  siteConfig.passMaxCarried = +document.getElementById("cfgPassMax").value;
  siteConfig.transferMaxCarried = +document.getElementById("cfgTransferMax").value;
  siteConfig.failMinCarried = +document.getElementById("cfgFailMin").value;
  saveConfigToStorage();
  document.getElementById("saveMsg").innerHTML = `<span style="color:var(--neon-green);">✔ تم حفظ الإعدادات، الحسابات والموقع العام تحدّثت</span>`;
  setTimeout(() => renderDashboard(), 600);
}

function toggleTheme() {
  const html = document.documentElement;
  const cur = html.getAttribute("data-theme");
  html.setAttribute("data-theme", cur === "light" ? "dark" : "light");
  document.getElementById("themeIcon").textContent = html.getAttribute("data-theme") === "light" ? "🌙" : "☀️";
}

window.addEventListener("storage", (event) => {
  if (event.key === "universityNotifications") {
    notifications = JSON.parse(event.newValue || "[]");
    if (adminTab === "notif") renderNotifAdmin();
  }
  if (event.key === "universitySiteConfig") {
    Object.assign(siteConfig, JSON.parse(event.newValue || "{}"));
    if (adminTab === "settings") renderSettings();
    else if (adminTab === "appeals") loadAppealsAdmin();
    else renderDashboard();
  }
});
window.addEventListener("DOMContentLoaded", async () => {
  const loaded = await loadStudentJSON();
  await loadAdminNotifications();
  if (!loaded) {
    document.getElementById("admin").innerHTML = `<div class="page"><div class="empty">تعذر تحميل ملفات الطلاب. ضع ملفات JSON الثلاثة بجانب الموقع وشغّل الموقع عبر خادم محلي.</div></div>`;
    return;
  }
  renderAdmin();
});
