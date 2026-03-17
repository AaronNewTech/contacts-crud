from django.db import models

class Contact(models.Model):

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class ScheduledEvent(models.Model):
    """Simple scheduled event attached to a contact.

    Fields chosen to match your request: name, start_date, start_time,
    end_date, end_time. Name will be auto-filled on save if blank.
    """
    contact = models.ForeignKey(Contact, related_name='events', on_delete=models.CASCADE)
    name = models.CharField(max_length=255, blank=True)
    start_date = models.DateField()
    start_time = models.TimeField()
    end_date = models.DateField()
    end_time = models.TimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Auto-populate name if empty: "Call with {First Last}"
        if not self.name:
            try:
                self.name = f"Call with {self.contact.first_name} {self.contact.last_name}".strip()
            except Exception:
                # If contact not yet saved or available, leave blank
                pass
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.start_date} {self.start_time})"