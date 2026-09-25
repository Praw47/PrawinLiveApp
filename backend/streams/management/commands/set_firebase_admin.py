from django.core.management.base import BaseCommand, CommandError
from firebase_admin import auth

from config.firebase_auth import _firebase_app


class Command(BaseCommand):
    help = "Grant or revoke the Firebase admin custom claim for a user."

    def add_arguments(self, parser):
        parser.add_argument("uid")
        parser.add_argument("--revoke", action="store_true")

    def handle(self, *args, **options):
        uid = options["uid"]
        try:
            user = auth.get_user(uid, app=_firebase_app())
            claims = dict(user.custom_claims or {})
            if options["revoke"]:
                claims.pop("admin", None)
            else:
                claims["admin"] = True
            auth.set_custom_user_claims(uid, claims, app=_firebase_app())
        except (auth.UserNotFoundError, ValueError, RuntimeError) as error:
            raise CommandError(str(error)) from error
        action = "Revoked" if options["revoke"] else "Granted"
        self.stdout.write(self.style.SUCCESS(f"{action} Firebase admin rights for {uid}. Refresh the user's ID token."))
