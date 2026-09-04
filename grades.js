/* ============================================================
   grades.js — دمج علامات JSON وحساب المعدلات والحالات.
   ============================================================ */

function findRowsBySubscription(rows, id) {
  return rows.filter(s => String(s.subscriptionNumber) === String(id));
}

function findRowBySubscription(rows, id) {
  return rows.find(s => String(s.subscriptionNumber) === String(id)) || null;
}

function buildStudentRecord(base) {
  const s2 = findRowBySubscription(students2, base.subscriptionNumber) || {};
  const s3Rows = findRowsBySubscription(students3, base.subscriptionNumber);
  const campaignGrades = {};

  // الطالب قد يملك عدة علامات حملة في عدة أسطر داخل students3.json.
  s3Rows.forEach(row => {
    ALL_SUBJECTS.forEach(sub => {
      if (row[sub.key] !== undefined && row[sub.key] !== null && row[sub.key] !== "") {
        campaignGrades[sub.key] = row[sub.key];
      }
    });
  });

  const grades = {};
  ALL_SUBJECTS.forEach(sub => {
    let value = null;
    let retaken = false;
    if (Object.prototype.hasOwnProperty.call(campaignGrades, sub.key)) {
      value = campaignGrades[sub.key];
      retaken = true;
    } else if (base[sub.key] !== undefined) {
      value = base[sub.key];
    } else if (s2[sub.key] !== undefined) {
      value = s2[sub.key];
    }
    grades[sub.key] = { value, retaken, released: value !== null && value !== undefined && value !== "" };
  });

  return { subscriptionNumber: base.subscriptionNumber, fullName: base.fullName || "", section: base.section || "", grades };
}

function rebuildStudentRecords() {
  ALL_STUDENTS = students1.map(buildStudentRecord);
  window.dispatchEvent(new CustomEvent("student-data-updated", { detail: ALL_STUDENTS }));
}

function getStudentById(id) {
  return ALL_STUDENTS.find(s => String(s.subscriptionNumber) === String(id));
}

function searchStudentsByName(query) {
  const q = (query || "").trim();
  if (!q) return [];
  return ALL_STUDENTS.filter(s => s.fullName.includes(q));
}

function gradeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function countCarried(student) {
  return ALL_SUBJECTS.filter(sub => {
    const g = student.grades[sub.key];
    const mark = gradeNumber(g?.value);
    return g?.released && mark !== null && mark < siteConfig.passingGrade;
  }).length;
}

function countPassedReleased(student) {
  return ALL_SUBJECTS.filter(sub => {
    const g = student.grades[sub.key];
    const mark = gradeNumber(g?.value);
    return g?.released && mark !== null && mark >= siteConfig.passingGrade;
  }).length;
}

function getStatus(student) {
  const carried = countCarried(student);
  if (carried >= siteConfig.failMinCarried) return "راسب";
  if (carried <= siteConfig.passMaxCarried) return "ناجح";
  return "منقول";
}

function statusColor(status) {
  if (status === "ناجح") return "var(--neon-green)";
  if (status === "منقول") return "var(--neon-amber)";
  return "var(--neon-red)";
}

function semesterAverage(student, subjectList) {
  const marks = subjectList
    .map(sub => gradeNumber(student.grades[sub.key]?.value))
    .filter(mark => mark !== null);
  if (marks.length === 0) return null;
  return Number((marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2));
}

function overallAverage(student) {
  return semesterAverage(student, ALL_SUBJECTS);
}

function highLowSubject(student) {
  const released = ALL_SUBJECTS
    .map(sub => ({ ...sub, ...student.grades[sub.key] }))
    .filter(g => g.released && gradeNumber(g.value) !== null);
  if (!released.length) return { high: null, low: null };
  const high = released.reduce((a, b) => gradeNumber(b.value) > gradeNumber(a.value) ? b : a);
  const low = released.reduce((a, b) => gradeNumber(b.value) < gradeNumber(a.value) ? b : a);
  return { high, low };
}

function overallRanking() {
  return ALL_STUDENTS
    .map(s => ({ student: s, avg: overallAverage(s), status: getStatus(s), carried: countCarried(s) }))
    .filter(r => r.avg !== null)
    .sort((a, b) => b.avg - a.avg);
}

function statusRanking(status) {
  return ALL_STUDENTS
    .map(s => ({ student: s, avg: overallAverage(s), status: getStatus(s), carried: countCarried(s) }))
    .filter(r => r.status === status && r.avg !== null)
    .sort((a, b) => b.avg - a.avg);
}

function rankOf(student) {
  const ranking = overallRanking();
  const idx = ranking.findIndex(r => r.student.subscriptionNumber === student.subscriptionNumber);
  return idx === -1 ? null : idx + 1;
}

function subjectRanking(subjectKey) {
  return ALL_STUDENTS
    .map(s => ({ student: s, grade: s.grades[subjectKey] }))
    .filter(r => r.grade && r.grade.released && gradeNumber(r.grade.value) !== null)
    .sort((a, b) => gradeNumber(b.grade.value) - gradeNumber(a.grade.value));
}

function carriedCountDistribution() {
  const dist = {};
  for (let i = 1; i <= ALL_SUBJECTS.length; i++) dist[i] = 0;
  ALL_STUDENTS.forEach(s => {
    const c = countCarried(s);
    if (c >= 1) dist[c] = (dist[c] || 0) + 1;
  });
  return dist;
}

function statusCounts() {
  const counts = { "ناجح": 0, "منقول": 0, "راسب": 0 };
  ALL_STUDENTS.forEach(s => counts[getStatus(s)]++);
  return counts;
}
