/* ============================================================
   print.js — طباعة بيان نتائج الطالب على ورقة A4 واحدة
   QR حقيقي عبر qrcode.js مع رابط تحقق مباشر عند الاستضافة.
   ============================================================ */

function escapePrintText(value) {
  return String(value ?? "—").replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
}

function buildPrintHTML(student) {
  const status = getStatus(student);
  const s1avg = semesterAverage(student, SUBJECTS_S1);
  const s2avg = semesterAverage(student, SUBJECTS_S2);
  const overall = overallAverage(student);

  const rowsHTML = (list) => list.map(sub => {
    const g = student.grades[sub.key];
    const val = g.released ? g.value : "—";
    const st = !g.released ? "—" : (g.value >= siteConfig.passingGrade ? "ناجح" : "راسب");
    const cls = !g.released ? "print-pending" : (st === "ناجح" ? "print-pass" : "print-fail");
    return `<tr><td class="subj">${escapePrintText(sub.name)}</td><td>${escapePrintText(val)}</td><td class="${cls}">${st}</td></tr>`;
  }).join("");

  return `
    <div class="print-sheet" id="printArea" dir="rtl">
      <div class="print-head">
        <div class="print-head-right">
          <div>الجمهورية العربية السورية</div>
          <div>وزارة التعليم العالي والبحث العلمي</div>
          <div><b>${escapePrintText(siteConfig.university)}</b></div>
        </div>
        <div class="print-head-center">
          <img src="logo.png" class="print-university-logo" alt="شعار جامعة اللاذقية">
        </div>
        <div class="print-head-left">
          <div><b>${escapePrintText(siteConfig.college)}</b></div>
          <div>${escapePrintText(siteConfig.department)}</div>
        </div>
      </div>

      <div class="print-title">بيان نتائج الطالب</div>

      <table class="print-table print-info-table">
        <colgroup><col><col><col><col></colgroup>
        <thead><tr><th>الاسم الثلاثي</th><th>رقم الاكتتاب</th><th>المعدل</th><th>الحالة</th></tr></thead>
        <tbody><tr>
          <td>${escapePrintText(student.fullName)}</td>
          <td>${escapePrintText(student.subscriptionNumber)}</td>
          <td>${escapePrintText(overall)}</td>
          <td class="print-status-${status}">${escapePrintText(status)}</td>
        </tr></tbody>
      </table>

      <div class="print-section-title">نتائج الفصل الدراسي الأول <span>معدل الفصل: ${escapePrintText(s1avg)}</span></div>
      <table class="print-table">
        <colgroup><col class="subject-col"><col><col></colgroup>
        <thead><tr><th>المادة</th><th>العلامة</th><th>الحالة</th></tr></thead>
        <tbody>
          ${rowsHTML(SUBJECTS_S1)}
          <tr class="print-average-row"><td class="subj"><b>معدل الفصل الأول</b></td><td colspan="2"><b>${escapePrintText(s1avg)}</b></td></tr>
        </tbody>
      </table>

      <div class="print-section-title">نتائج الفصل الدراسي الثاني <span>معدل الفصل: ${escapePrintText(s2avg)}</span></div>
      <table class="print-table">
        <colgroup><col class="subject-col"><col><col></colgroup>
        <thead><tr><th>المادة</th><th>العلامة</th><th>الحالة</th></tr></thead>
        <tbody>
          ${rowsHTML(SUBJECTS_S2)}
          <tr class="print-average-row"><td class="subj"><b>معدل الفصل الثاني</b></td><td colspan="2"><b>${escapePrintText(s2avg)}</b></td></tr>
        </tbody>
      </table>

      <div class="print-bottom">
        <div class="print-verification">
          <b>للتأكد من صحة النتيجة</b>
          <span>امسح رمز QR للتحقق من بيانات الطالب.</span>
          <span>الحالة: <strong class="print-status-${status}">${status}</strong></span>
        </div>
        <div class="qr-box">
          <div id="studentQr" aria-label="رمز التحقق QR"></div>
          <small>رمز التحقق</small>
        </div>
      </div>
    </div>
  `;
}

function getStudentVerificationText(student) {
  const safePath = `${location.origin}${location.pathname}`;
  if (location.protocol === "http:" || location.protocol === "https:") {
    return `${safePath}#result?id=${encodeURIComponent(student.subscriptionNumber)}`;
  }
  return `VERIFY|${student.subscriptionNumber}|${student.fullName}|${siteConfig.university}`;
}

function renderStudentQR(student) {
  const target = document.getElementById("studentQr");
  if (!target) return;
  target.innerHTML = "";

  const text = getStudentVerificationText(student);

  if (window.QRCode) {
    new QRCode(target, {
      text,
      width: 86,
      height: 86,
      colorDark: "#111111",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
    return;
  }

  // احتياطي API إذا لم تُحمّل qrcode.js.
  const img = document.createElement("img");
  img.width = 86;
  img.height = 86;
  img.alt = "QR للتحقق من النتيجة";
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(text)}`;
  target.appendChild(img);
}

function openPrintView(student) {
  if (!student) return;
  const holder = document.getElementById("printHolder");
  if (!holder) return;

  holder.innerHTML = buildPrintHTML(student);
  holder.style.display = "block";

  // انتظر بناء الـQR وتحميل صورة الشعار قبل فتح نافذة الطباعة.
  renderStudentQR(student);
  const logo = document.querySelector("#printArea .print-university-logo");
  const printNow = () => setTimeout(() => window.print(), 180);

  if (logo && !logo.complete) {
    logo.addEventListener("load", printNow, { once: true });
    logo.addEventListener("error", printNow, { once: true });
  } else {
    printNow();
  }
}

window.addEventListener("afterprint", () => {
  const holder = document.getElementById("printHolder");
  if (holder) holder.style.display = "none";
});
