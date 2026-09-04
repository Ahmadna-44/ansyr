/* إعدادات الاتصال بخدمة الاعتراضات */
const API_BASE_URL = "http://localhost:8000/api";

function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// مفتاح لوحة التحكم: غيّره قبل الاستخدام الفعلي على الإنترنت. يجب أن يطابق ADMIN_API_KEY في server.py.
const ADMIN_API_KEY = "CHANGE-ME-ADMIN-KEY";
