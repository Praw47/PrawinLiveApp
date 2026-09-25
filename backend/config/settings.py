import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = "pulse-local-development-key"
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
INSTALLED_APPS = ["streams"]
MIDDLEWARE = ["corsheaders.middleware.CorsMiddleware", "django.middleware.common.CommonMiddleware"]
ROOT_URLCONF = "config.urls"
TEMPLATES = []
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {
	"default": {
		"ENGINE": "django.db.backends.mysql",
		"NAME": os.getenv("DB_NAME", "prawin47"),
		"USER": os.getenv("DB_USER", "root"),
		"PASSWORD": os.getenv("DB_PASSWORD", ""),
		"HOST": os.getenv("DB_HOST", "localhost"),
		"PORT": os.getenv("DB_PORT", "3306"),
	}
}
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = False
FIREBASE_SERVICE_ACCOUNT_FILE = os.getenv(
	"FIREBASE_SERVICE_ACCOUNT_FILE", str(BASE_DIR.parent / "firebase-service-account.json")
)
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
FIREBASE_ADMIN_UIDS = {
	uid.strip() for uid in os.getenv("FIREBASE_ADMIN_UIDS", "").split(",") if uid.strip()
}
FIREBASE_ADMIN_EMAILS = {
	email.strip().lower()
	for email in os.getenv("FIREBASE_ADMIN_EMAILS", "kprawin@gmail.com,kdprawin@gmail.com").split(",")
	if email.strip()
}
