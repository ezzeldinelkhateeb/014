# 🔧 Bunny.net API Authentication Troubleshooting

## المشكلة الحالية
أنت تواجه خطأ 401 (Authentication Denied) عند محاولة الوصول إلى Bunny.net API. هذا يعني أن مفتاح API غير صحيح أو غير موجود.

## الحلول

### 1️⃣ تحقق من ملف .env
```bash
# تأكد من وجود الملف .env في المجلد الجذر للمشروع
# يجب أن يحتوي على:
VITE_BUNNY_API_KEY=your_actual_api_key_here
```

### 2️⃣ احصل على مفتاح API الصحيح
1. ادخل إلى [Bunny.net Dashboard](https://panel.bunny.net)
2. اذهب إلى **Account** → **API Keys**
3. انسخ مفتاح API الخاص بك
4. ضعه في ملف `.env`

### 3️⃣ تحقق من تحميل متغيرات البيئة
```javascript
// افتح Developer Console في المتصفح وشغل:
console.log('API Key:', import.meta.env.VITE_BUNNY_API_KEY);
```

### 4️⃣ استخدم أداة التشخيص
المشروع يحتوي على أداة تشخيص تلقائية تعمل عند بدء التشغيل. تحقق من Console للحصول على تقرير مفصل.

### 5️⃣ اختبار الاتصال يدوياً
```bash
# شغل هذا الأمر في Terminal لاختبار مفتاح API:
curl -H "AccessKey: YOUR_API_KEY" https://api.bunny.net/videolibrary
```

## اختبار المشروع

### تشغيل أداة التشخيص
زر `/api/auth-check` لاختبار حالة مفاتيح API

### فحص المتغيرات يدوياً
```bash
# في Terminal:
echo $VITE_BUNNY_API_KEY

# أو في Node.js:
console.log(process.env.VITE_BUNNY_API_KEY);
```

## الأمان

### ❌ تم إزالة جميع عمليات الحذف
- لا يمكن حذف أي محتوى من Bunny.net
- جميع عمليات DELETE محذوفة من API endpoints
- CORS headers محدثة لإزالة DELETE methods

### ✅ المميزات المدعومة
- إنشاء المكتبات والكولكشن ✅
- رفع الفيديوهات ✅
- قراءة البيانات ✅
- تحديث البيانات ✅
- **حذف البيانات ❌ (محذوف للأمان)**

## إعدادات الإنتاج

### متغيرات البيئة المطلوبة
```bash
VITE_BUNNY_API_KEY=your_bunny_api_key

# اختيارية (للتكامل مع Google Sheets):
GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id
GOOGLE_SHEETS_CREDENTIALS_JSON={"type":"service_account",...}
```

### إعدادات الخادم
تأكد من أن خادم الإنتاج يمرر متغيرات البيئة بشكل صحيح.

## استكشاف الأخطاء

### خطأ 401 - Unauthorized
```javascript
// تحقق من:
1. مفتاح API صحيح ✓
2. متغير البيئة محمل ✓  
3. Headers يتم إرسالها بشكل صحيح ✓
```

### خطأ 500 - Server Error
```javascript
// تحقق من:
1. اتصال الشبكة بـ Bunny.net ✓
2. معلمات الطلب صحيحة ✓
3. تشكيل البيانات سليم ✓
```

### رسائل Console مفيدة
المشروع الآن يطبع معلومات مفيدة في Console:
- حالة مفاتيح API
- تقارير التشخيص
- تفاصيل الأخطاء

## المساعدة الإضافية

إذا استمرت المشاكل:
1. تحقق من Console للحصول على رسائل التشخيص
2. تأكد من إعادة تشغيل الخادم بعد تحديث .env
3. اختبر مفتاح API مع curl قبل استخدامه في التطبيق
4. تأكد من أن مفتاح API له صلاحيات للمكتبات المطلوبة
