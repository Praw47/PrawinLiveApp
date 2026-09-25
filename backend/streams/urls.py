from django.urls import path
from .views import current_user, room_detail, rooms, start_stream

urlpatterns = [
    path("rooms/", rooms),
    path("rooms/<slug:room_id>/", room_detail),
    path("auth/me/", current_user),
    path("streams/start/", start_stream),
]
