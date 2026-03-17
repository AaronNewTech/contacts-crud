from django.db import models
from django.conf import settings

class ContactMethod(models.Model):
    CONTACT_TYPES = [
        ('email', 'Email'),
        ('phone', 'Phone'),
        ('social', 'Social Media'),
    ]
    contact = models.ForeignKey("contact.Contact", on_delete=models.CASCADE, related_name="contact_methods")
    type = models.CharField(max_length=20, choices=CONTACT_TYPES)
    value = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    def get_type_display(self) -> str:
        # Provide a concrete implementation to satisfy static analysis tools;
        # return the human-readable label for the stored type key.
        return dict(self.CONTACT_TYPES).get(self.type, self.type)

    def __str__(self):
        return f"{self.get_type_display()}: {self.value}"
    
    