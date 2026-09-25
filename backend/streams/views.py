import json
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from config.firebase_auth import firebase_admin_required, firebase_required, is_firebase_admin

ROOMS = [
    {"id": "night-market", "title": "PRAWIN Gaming HUB", "host": "Mina Park", "handle": "@minapark", "category": "Gaming", "viewers": 1842, "avatar": "PG", "accent": "#d7f04a", "image": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80", "featured": True},
    {"id": "ceramic-studio", "title": "Making a cup from scratch", "host": "Theo Clay", "handle": "@theoclay", "category": "Create", "viewers": 624, "avatar": "TC", "accent": "#f2a66f", "image": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80", "featured": False},
    {"id": "vinyl-sunday", "title": "Vinyl Sunday: deep cuts only", "host": "Nico Wells", "handle": "@nicowells", "category": "Music", "viewers": 391, "avatar": "NW", "accent": "#b7a5ff", "image": "https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=800&q=80", "featured": False},
]


def rooms(request):
    return JsonResponse({"rooms": ROOMS})


def room_detail(request, room_id):
    room = next((room for room in ROOMS if room["id"] == room_id), None)
    if room is None:
        return JsonResponse({"error": "Room not found"}, status=404)
    return JsonResponse({"room": room})


@firebase_required
def current_user(request):
    user = request.firebase_user
    return JsonResponse({
        "uid": user["uid"],
        "email": user.get("email", ""),
        "name": user.get("name") or user.get("email", "").split("@")[0],
        "is_admin": is_firebase_admin(user),
    })


@csrf_exempt
@firebase_admin_required
def start_stream(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)
    title = payload.get("title", "Untitled live stream").strip()
    if not title:
        return JsonResponse({"error": "A stream title is required."}, status=400)
    return JsonResponse({"status": "ready", "title": title, "stream_key": "pulse-local-demo"}, status=201)
