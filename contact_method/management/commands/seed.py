from django.core.management.base import BaseCommand
from contact.models import Contact
from contact_method.models import ContactMethod

class Command(BaseCommand):
    help = "Seed demo contacts and contact methods."

    def handle(self, *args, **options):
        samples = [
            {"first_name": "Alice", "last_name": "Smith", "contacts": [{"type": "email", "value": "alice@example.com"}, {"type": "phone", "value": "555-0101"}]},

            {"first_name": "Bob", "last_name": "Jones", "contacts": [{"type": "email", "value": "bob@example.com"}]},

            {"first_name": "Charlie", "last_name": "Brown", "contacts": [{"type": "phone", "value": "555-0202"}, {"type": "social", "value": "@charlie"}]},

            {"first_name": "David", "last_name": "Wilson", "contacts": [{"type": "email", "value": "david@example.com"}, {"type": "phone", "value": "555-0303"}]},

            {"first_name": "Eve", "last_name": "Davis", "contacts": [{"type": "email", "value": "eve@example.com"}, {"type": "social", "value": "@eve"}]},

            {"first_name": "Frank", "last_name": "Miller", "contacts": [{"type": "email", "value": "frank@example.com"}, {"type": "phone", "value": "555-0404"}]},

            {"first_name": "Grace", "last_name": "Harris", "contacts": [{"type": "email", "value": "grace@example.com"}, {"type": "social", "value": "@grace"}]},
            
            {"first_name": "Hank", "last_name": "Moore", "contacts": [{"type": "email", "value": "hank@example.com"}, {"type": "phone", "value": "555-0505"}]},
        ]

        for s in samples:
            contact, created = Contact.objects.get_or_create(
                first_name=s["first_name"],
                last_name=s["last_name"],
            )
            if created:
                self.stdout.write(f"Created contact {contact}")
            else:
                self.stdout.write(f"Found contact {contact}")

            for c in s["contacts"]:
                cm, cm_created = ContactMethod.objects.get_or_create(contact=contact, type=c["type"], value=c["value"])
                if cm_created:
                    self.stdout.write(f"  Created contact method {cm}")