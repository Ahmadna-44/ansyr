#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""سيرفر الموقع + API لطلبات الاعتراض باستخدام SQLite من مكتبات بايثون القياسية."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import sqlite3, json, os, re, uuid
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parent
DB_DIR = BASE_DIR / "data"
DB_DIR.mkdir(exist_ok=True)
DB_FILE = DB_DIR / "appeals.db"
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8000"))
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "CHANGE-ME-ADMIN-KEY")

STATUSES = {"pending": "قيد المراجعة", "reviewed": "تمت المراجعة", "accepted": "مقبول", "rejected": "مرفوض"}


def db():
    c = sqlite3.connect(DB_FILE)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c


def init_db():
    with db() as con:
        con.execute("""
        CREATE TABLE IF NOT EXISTS appeals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_no TEXT NOT NULL UNIQUE,
            subscription_number TEXT NOT NULL,
            student_name TEXT NOT NULL,
            subjects_json TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            admin_note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)
        con.execute("CREATE INDEX IF NOT EXISTS idx_appeals_subscription ON appeals(subscription_number)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status)")
        con.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            target TEXT NOT NULL DEFAULT 'all',
            created_at TEXT NOT NULL
        )
        """)
        # أول تشغيل: إشعارات افتراضية، وبعدها تصبح كل الإشعارات مركزية في SQLite.
        if con.execute("SELECT COUNT(*) FROM notifications").fetchone()[0] == 0:
            stamp1 = "2026-08-20"
            stamp2 = "2026-08-25"
            con.executemany(
                "INSERT INTO notifications(title, body, target, created_at) VALUES (?,?,?,?)",
                [
                    ("صدور نتائج الفصل الأول", "تم اعتماد نتائج مواد الفصل الأول بالكامل، بالتوفيق للجميع 🌟", "all", stamp1),
                    ("تنويه لحاملي مادة واحدة", "امتحانات الدور الثاني ستُعقد الأسبوع القادم، يرجى مراجعة برنامج الامتحانات.", "carried:1", stamp2),
                ],
            )


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def make_request_no():
    # REQ-YYYYMMDD-XXXX
    with db() as con:
        while True:
            suffix = uuid.uuid4().hex[:4].upper()
            candidate = f"REQ-{datetime.now().strftime('%Y%m%d')}-{suffix}"
            if not con.execute("SELECT 1 FROM appeals WHERE request_no=?", (candidate,)).fetchone():
                return candidate


def json_body(handler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if length > 200_000:
            raise ValueError("payload too large")
        raw = handler.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")
    except Exception:
        return None


def send_json(handler, status, payload):
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(raw)


def safe_text(v, max_len):
    s = str(v or "").strip()
    return s[:max_len]


def student_catalog():
    catalog = {}
    for filename in ("students1.json", "students2.json", "students3.json"):
        path = BASE_DIR / filename
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict) or row.get("subscriptionNumber") is None:
                continue
            sid = str(row.get("subscriptionNumber"))
            name = str(row.get("fullName") or "").strip()
            if sid and name:
                catalog[sid] = name
    return catalog


def is_admin(handler):
    return handler.headers.get("X-Admin-Key", "") == ADMIN_API_KEY


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Always serve static files from the project directory.
        rel = urlparse(path).path.lstrip("/")
        target = (BASE_DIR / rel).resolve()
        if BASE_DIR not in target.parents and target != BASE_DIR:
            return str(BASE_DIR / "index.html")
        return str(target)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return send_json(self, 200, {"ok": True, "database": str(DB_FILE.name)})
        if parsed.path == "/api/appeals/track":
            qs = parse_qs(parsed.query)
            student_id = qs.get("subscriptionNumber", [""])[0].strip()
            request_no = qs.get("requestNo", [""])[0].strip().upper()
            if not student_id or not request_no:
                return send_json(self, 400, {"ok": False, "message": "الرجاء إرسال رقم الاكتتاب ورقم الطلب"})
            with db() as con:
                row = con.execute("SELECT * FROM appeals WHERE subscription_number=? AND request_no=?", (student_id, request_no)).fetchone()
            if not row:
                return send_json(self, 404, {"ok": False, "message": "لم يتم العثور على الطلب"})
            return send_json(self, 200, {"ok": True, "appeal": self.row_json(row)})

        if parsed.path == "/api/notifications":
            with db() as con:
                rows = con.execute("SELECT * FROM notifications ORDER BY id DESC").fetchall()
            return send_json(self, 200, {"ok": True, "notifications": [self.notification_json(r) for r in rows]})

        if parsed.path == "/api/admin/appeals":
            if not is_admin(self):
                return send_json(self, 401, {"ok": False, "message": "غير مصرح بالوصول"})
            qs = parse_qs(parsed.query)
            status = qs.get("status", [""])[0]
            with db() as con:
                query = "SELECT * FROM appeals"
                params = []
                if status in STATUSES:
                    query += " WHERE status=?"; params.append(status)
                query += " ORDER BY id DESC"
                rows = con.execute(query, params).fetchall()
            return send_json(self, 200, {"ok": True, "appeals": [self.row_json(r) for r in rows]})
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/admin/notifications":
            if not is_admin(self):
                return send_json(self, 401, {"ok": False, "message": "غير مصرح بالوصول"})
            payload = json_body(self)
            if not isinstance(payload, dict):
                return send_json(self, 400, {"ok": False, "message": "بيانات غير صالحة"})
            title = safe_text(payload.get("title"), 160)
            body = safe_text(payload.get("body"), 4000)
            target = safe_text(payload.get("target"), 80) or "all"
            if not title or not body:
                return send_json(self, 400, {"ok": False, "message": "عنوان ونص الإشعار مطلوبان"})
            if target != "all" and not re.fullmatch(r"(carried:\d{1,2}|student:\d{1,30})", target):
                return send_json(self, 400, {"ok": False, "message": "الفئة المستهدفة غير صالحة"})
            stamp = now_iso()
            with db() as con:
                cur = con.execute(
                    "INSERT INTO notifications(title, body, target, created_at) VALUES (?,?,?,?)",
                    (title, body, target, stamp),
                )
                row = con.execute("SELECT * FROM notifications WHERE id=?", (cur.lastrowid,)).fetchone()
            return send_json(self, 201, {"ok": True, "notification": self.notification_json(row)})

        if parsed.path != "/api/appeals":
            return send_json(self, 404, {"ok": False, "message": "المسار غير موجود"})
        payload = json_body(self)
        if not isinstance(payload, dict):
            return send_json(self, 400, {"ok": False, "message": "بيانات الطلب غير صالحة"})
        sid = safe_text(payload.get("subscriptionNumber"), 30)
        name = safe_text(payload.get("studentName"), 200)
        catalog = student_catalog()
        official_name = catalog.get(sid)
        if not official_name:
            return send_json(self, 400, {"ok": False, "message": "رقم الاكتتاب غير موجود ضمن بيانات الطلاب"})
        name = official_name
        notes = safe_text(payload.get("notes"), 2000)
        subjects = payload.get("subjects")
        if not re.fullmatch(r"\d{1,12}", sid):
            return send_json(self, 400, {"ok": False, "message": "رقم الاكتتاب غير صالح"})
        if not name or len(name) > 200:
            return send_json(self, 400, {"ok": False, "message": "اسم الطالب غير صالح"})
        if not isinstance(subjects, list) or not subjects or len(subjects) > 30:
            return send_json(self, 400, {"ok": False, "message": "يجب اختيار مادة واحدة على الأقل"})
        cleaned = []
        for item in subjects:
            if not isinstance(item, dict):
                continue
            key = safe_text(item.get("key"), 80)
            subject_name = safe_text(item.get("name"), 200)
            mark = safe_text(item.get("mark"), 30)
            reason = safe_text(item.get("reason"), 500)
            if not key or not subject_name:
                continue
            cleaned.append({"key": key, "name": subject_name, "mark": mark or "—", "reason": reason})
        if not cleaned:
            return send_json(self, 400, {"ok": False, "message": "تعذر قراءة المواد المختارة"})
        if any(x["key"] == "other" for x in cleaned) and not notes:
            return send_json(self, 400, {"ok": False, "message": "عند اختيار غير ذلك يجب كتابة ملاحظة"})

        request_no = make_request_no()
        stamp = now_iso()
        with db() as con:
            con.execute("""
                INSERT INTO appeals
                (request_no, subscription_number, student_name, subjects_json, notes, status, admin_note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'pending', '', ?, ?)
            """, (request_no, sid, name, json.dumps(cleaned, ensure_ascii=False), notes, stamp, stamp))
        return send_json(self, 201, {"ok": True, "appeal": {
            "requestNo": request_no,
            "subscriptionNumber": sid,
            "studentName": name,
            "subjects": cleaned,
            "notes": notes,
            "status": "pending",
            "statusLabel": STATUSES["pending"],
            "adminNote": "",
            "createdAt": stamp,
            "updatedAt": stamp,
        }})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        m = re.fullmatch(r"/api/admin/notifications/(\d+)", parsed.path)
        if not m:
            return send_json(self, 404, {"ok": False, "message": "الإشعار غير موجود"})
        if not is_admin(self):
            return send_json(self, 401, {"ok": False, "message": "غير مصرح بالوصول"})
        with db() as con:
            cur = con.execute("DELETE FROM notifications WHERE id=?", (int(m.group(1)),))
            if cur.rowcount == 0:
                return send_json(self, 404, {"ok": False, "message": "الإشعار غير موجود"})
        return send_json(self, 200, {"ok": True})

    def do_PATCH(self):
        parsed = urlparse(self.path)
        m = re.fullmatch(r"/api/admin/appeals/(\d+)", parsed.path)
        if not m:
            return send_json(self, 404, {"ok": False, "message": "الطلب غير موجود"})
        if not is_admin(self):
            return send_json(self, 401, {"ok": False, "message": "غير مصرح بالوصول"})
        payload = json_body(self)
        if not isinstance(payload, dict):
            return send_json(self, 400, {"ok": False, "message": "بيانات غير صالحة"})
        status = payload.get("status")
        admin_note = safe_text(payload.get("adminNote"), 2000)
        if status not in STATUSES:
            return send_json(self, 400, {"ok": False, "message": "حالة الطلب غير صالحة"})
        stamp = now_iso()
        with db() as con:
            cur = con.execute("UPDATE appeals SET status=?, admin_note=?, updated_at=? WHERE id=?", (status, admin_note, stamp, int(m.group(1))))
            if cur.rowcount == 0:
                return send_json(self, 404, {"ok": False, "message": "الطلب غير موجود"})
            row = con.execute("SELECT * FROM appeals WHERE id=?", (int(m.group(1)),)).fetchone()
        return send_json(self, 200, {"ok": True, "appeal": self.row_json(row)})

    @staticmethod
    def notification_json(row):
        stamp = row["created_at"]
        try:
            date = datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d")
        except Exception:
            date = str(stamp)[:10]
        return {
            "id": row["id"],
            "title": row["title"],
            "body": row["body"],
            "target": row["target"],
            "date": date,
            "createdAt": stamp,
        }

    @staticmethod
    def row_json(row):
        return {
            "id": row["id"],
            "requestNo": row["request_no"],
            "subscriptionNumber": row["subscription_number"],
            "studentName": row["student_name"],
            "subjects": json.loads(row["subjects_json"] or "[]"),
            "notes": row["notes"],
            "status": row["status"],
            "statusLabel": STATUSES.get(row["status"], row["status"]),
            "adminNote": row["admin_note"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, format, *args):
        print(f"[server] {self.address_string()} - {format % args}")


if __name__ == "__main__":
    init_db()
    print(f"\n✅ الموقع يعمل على: http://localhost:{PORT}")
    print(f"✅ API: http://localhost:{PORT}/api")
    print(f"✅ قاعدة البيانات: {DB_FILE}\n")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
