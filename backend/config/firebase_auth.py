import json
import os
from functools import wraps

import firebase_admin
from django.conf import settings
from django.http import JsonResponse
from firebase_admin import auth, credentials


def _firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    service_account_json = settings.FIREBASE_SERVICE_ACCOUNT_JSON
    service_account_file = settings.FIREBASE_SERVICE_ACCOUNT_FILE
    if service_account_json:
        return firebase_admin.initialize_app(credentials.Certificate(json.loads(service_account_json)))
    if service_account_file and os.path.exists(service_account_file):
        return firebase_admin.initialize_app(credentials.Certificate(service_account_file))
    raise RuntimeError("Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_FILE or FIREBASE_SERVICE_ACCOUNT_JSON.")


def verify_request(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        return auth.verify_id_token(header[7:].strip(), app=_firebase_app())
    except (ValueError, auth.InvalidIdTokenError, auth.ExpiredIdTokenError, RuntimeError):
        return None


def is_firebase_admin(user):
    return bool(
        user.get("admin")
        or user.get("uid") in settings.FIREBASE_ADMIN_UIDS
        or user.get("email", "").lower() in settings.FIREBASE_ADMIN_EMAILS
    )


def firebase_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        user = verify_request(request)
        if user is None:
            return JsonResponse({"error": "A valid Firebase sign-in is required."}, status=401)
        request.firebase_user = user
        return view(request, *args, **kwargs)

    return wrapped


def firebase_admin_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        user = verify_request(request)
        if user is None:
            return JsonResponse({"error": "A valid Firebase sign-in is required."}, status=401)
        if not is_firebase_admin(user):
            return JsonResponse({"error": "Admin rights are required for this action."}, status=403)
        request.firebase_user = user
        return view(request, *args, **kwargs)

    return wrapped