# پنل VLESS (Xray-core) روی Railway

پنل مدیریت کاربران VLESS با API کامل (برای اتصال ربات تلگرام) + یک داشبورد وب ساده،
طراحی‌شده برای دیپلوی روی Railway با فقط **یک پورت عمومی**.

## معماری

- **Xray-core** به‌صورت child-process روی `127.0.0.1` اجرا می‌شه و اصلاً از بیرون در دسترس نیست.
- **سرور Node.js** روی پورتی که Railway می‌ده (`$PORT`) گوش می‌ده:
  - درخواست‌های عادی HTTP → به Express (API + داشبورد) می‌ره.
  - درخواست WebSocket با مسیر `VLESS_WS_PATH` → مستقیم به Xray پروکسی می‌شه.
- کاربران توی **SQLite** ذخیره می‌شن. هر تغییر (ساخت/حذف/فعال‌سازی) باعث بازنویسی
  کانفیگ Xray و ری‌استارت سریع پروسه می‌شه (چند صدم ثانیه قطعی، غیرقابل‌حس).
- مصرف ترافیک هر کاربر با صدا زدن دستور داخلی `xray api statsquery` (که خود
  Xray-core فراهم می‌کنه، بدون نیاز به کتابخونه gRPC جدا) هر دقیقه خونده می‌شه.

## دیپلوی روی Railway

1. این ریپو رو به GitHub پوش کن و توی Railway از "Deploy from GitHub repo" استفاده کن
   (Railway به‌طور خودکار `Dockerfile` رو تشخیص می‌ده).
2. توی تنظیمات سرویس، این Environment Variable ها رو ست کن (نمونه کامل در `.env.example`):
   - `API_KEY` — کلید تصادفی برای ربات تلگرام/کلاینت‌ها
   - `ADMIN_USER` / `ADMIN_PASSWORD` — برای ورود به داشبورد وب
   - `VLESS_WS_PATH` — یه مسیر تصادفی و طولانی (مثلاً `/xr-9f2a1c4e`)
   - `PANEL_DOMAIN` — دامنه عمومی که Railway بهت می‌ده (Settings → Networking → Generate Domain)
3. مطمئن شو Railway روی سرویس یه **Public Domain با HTTPS** فعال کرده (پیش‌فرض همینه).
   Railway خودش گواهی TLS رو مدیریت می‌کنه؛ Xray داخل کانتینر بدون TLS (`security: none`)
   کار می‌کنه چون ترافیک رمزنگاری‌شده قبلش توسط Railway باز شده.
4. دیپلوی کن. لاگ‌ها رو چک کن که `Panel listening on :XXXX` و پیام‌های `[xray]` بدون خطا بیان.

## استفاده از API (برای ربات تلگرام)

همه‌ی درخواست‌ها به `https://<PANEL_DOMAIN>/api/...` نیاز به هدر دارن:

```
X-API-Key: <همون API_KEY که ست کردی>
```

| Method | Path                     | کار                                    |
|--------|--------------------------|-----------------------------------------|
| GET    | /api/users               | لیست همه‌ی کاربران                     |
| POST   | /api/users               | ساخت کاربر جدید                        |
| GET    | /api/users/:id           | مشاهده یک کاربر                        |
| PATCH  | /api/users/:id           | ویرایش (سقف ترافیک، انقضا، ...)        |
| DELETE | /api/users/:id           | حذف کاربر                              |
| GET    | /api/users/:id/config    | گرفتن لینک vless:// و QR (base64 PNG)  |
| POST   | /api/users/:id/reset     | صفر کردن مصرف ترافیک                   |
| POST   | /api/users/:id/enable    | فعال کردن                              |
| POST   | /api/users/:id/disable   | غیرفعال کردن                           |

### نمونه ساخت کاربر

```bash
curl -X POST https://your-app.up.railway.app/api/users \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"remark": "Ali - Telegram 12345", "trafficLimitGb": 30, "expireAt": 0}'
```

پاسخ شامل `link` (لینک vless://) و `qrDataUrl` (تصویر QR به‌صورت data URL) هست
که می‌تونی مستقیم توی تلگرام برای کاربر بفرستی.

`expireAt` یک unix timestamp (ثانیه) هست؛ `0` یعنی بدون انقضا.

## داشبورد وب

آدرس: `https://<PANEL_DOMAIN>/admin` — با `ADMIN_USER` / `ADMIN_PASSWORD` (Basic Auth) وارد شو.
از همون‌جا می‌تونی کاربر بسازی، QR بگیری، ترافیک رو ریست کنی یا کاربر رو حذف/غیرفعال کنی.

## نکات مهم

- **نسخه‌ی Xray-core**: توی `Dockerfile` آرگومان `XRAY_VERSION` رو ست کردیم؛ قبل از دیپلوی
  یه سر به [صفحه‌ی Releases در XTLS/Xray-core](https://github.com/XTLS/Xray-core/releases)
  بزن و اگه نسخه‌ی جدیدتری هست، آپدیتش کن.
- **دستور `xray api statsquery`**: فلگ‌های دقیق ممکنه بین نسخه‌های Xray کمی فرق کنه.
  اگه توی لاگ‌ها خطای `[stats] query failed` دیدی، با اجرای
  `docker exec -it <container> xray api statsquery --help` فلگ‌های درست رو پیدا کن و
  فایل `src/xray/statsWorker.js` رو مطابقش اصلاح کن.
- **بک‌آپ**: فایل SQLite توی `/app/data/panel.db` هست. اگه می‌خوای بین دیپلوی‌ها از بین
  نره، یه [Railway Volume](https://docs.railway.com/reference/volumes) به مسیر `/app/data`
  وصل کن، وگرنه با هر دیپلوی جدید دیتابیس (و در نتیجه لیست کاربرا) از صفر شروع می‌شه.
- **امنیت مسیر WS**: تنها لایه‌ی امنیتی روی خود اتصال VPN، همین `VLESS_WS_PATH` هست
  (چون Railway از قبل TLS رو ترمینیت کرده). حتماً یه مقدار طولانی و تصادفی براش بذار
  و جایی پابلیک منتشرش نکن.

## اجرای لوکال (تست)

روی سیستم شما باید Xray-core نصب باشه یا از Docker استفاده کنید:

```bash
cp .env.example .env
# مقادیر .env رو ویرایش کن
docker build -t vpn-panel .
docker run --rm -p 8080:8080 --env-file .env vpn-panel
```
