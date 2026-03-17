from django.shortcuts import render, get_object_or_404
from django.urls import reverse_lazy
from django.shortcuts import redirect
from django.urls import reverse
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotAllowed
from .models import Contact, ScheduledEvent
from contact_method.models import ContactMethod
import json


def event_create_api(request, pk):
    """Create a ScheduledEvent for the given contact.

    Expects JSON: { name?, start_date: 'YYYY-MM-DD', start_time: 'HH:MM:SS', end_date: 'YYYY-MM-DD', end_time: 'HH:MM:SS' }
    Returns the created event JSON on success with status 201.
    """
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        return HttpResponseBadRequest('Invalid JSON')

    contact = get_object_or_404(Contact, pk=pk)

    # Required fields
    start_date = payload.get('start_date')
    start_time = payload.get('start_time')
    end_date = payload.get('end_date')
    end_time = payload.get('end_time')

    if not (start_date and start_time and end_date and end_time):
        return JsonResponse({'error': 'start_date, start_time, end_date and end_time are required'}, status=400)

    name = payload.get('name', '')

    # Parse and validate date/time inputs to provide clearer errors and avoid 500s
    from django.utils.dateparse import parse_date, parse_time

    sd = parse_date(start_date)
    st = parse_time(start_time)
    ed = parse_date(end_date)
    et = parse_time(end_time)

    if not (sd and st and ed and et):
        return JsonResponse({'error': 'Invalid date/time format. Use YYYY-MM-DD for dates and HH:MM or HH:MM:SS for times.'}, status=400)

    # Ensure end is not before start (basic sanity check)
    try:
        from datetime import datetime

        start_dt = datetime.combine(sd, st)
        end_dt = datetime.combine(ed, et)
        if end_dt < start_dt:
            return JsonResponse({'error': 'Event end must be the same or after start.'}, status=400)
    except Exception:
        # If combine fails for unexpected reasons, return a generic error
        return JsonResponse({'error': 'Invalid date/time values.'}, status=400)

    try:
        ev = ScheduledEvent.objects.create(
            contact=contact,
            name=name,
            start_date=sd,
            start_time=st,
            end_date=ed,
            end_time=et,
        )
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=400)

    out = {
        'id': ev.pk,
        'name': ev.name,
        'start_date': ev.start_date.isoformat(),
        'start_time': ev.start_time.isoformat(),
        'end_date': ev.end_date.isoformat(),
        'end_time': ev.end_time.isoformat(),
    }
    return JsonResponse(out, status=201)


def event_delete_api(request, pk):
    """API endpoint to delete a ScheduledEvent by id.

    Accepts HTTP DELETE. Returns JSON { deleted: True, id: pk } on success.
    """
    if request.method != 'DELETE':
        return HttpResponseNotAllowed(['DELETE'])

    ev = get_object_or_404(ScheduledEvent, pk=pk)
    ev.delete()
    return JsonResponse({'deleted': True, 'id': pk})

class ContactListView(ListView):
    model = Contact
    template_name = "contact/contact_list.html"
    context_object_name = "contacts"

class ContactDetailView(DetailView):
    model = Contact
    template_name = "contact/contact_detail.html"
    context_object_name = "contact"


class ContactDetailPartialView(DetailView):
    """Return an HTML fragment for a contact detail (used by AJAX on the home page)."""
    model = Contact
    template_name = "contact/_detail.html"
    context_object_name = "contact"

def contact_api(request, pk):
    """Return JSON representation of a contact and its contact methods.

    This endpoint is intended for client-side rendering: the front-end
    fetches JSON and builds the DOM with plain JavaScript.
    """
    contact = get_object_or_404(Contact, pk=pk)
    # Avoid relying on IDE inference of related attributes; query the
    # ContactMethod model explicitly to collect the type/value pairs.
    methods = list(ContactMethod.objects.filter(contact=contact).values("id", "type", "value"))
    # include scheduled events for this contact
    events = list(ScheduledEvent.objects.filter(contact=contact).order_by('start_date', 'start_time').values(
        "id", "name", "start_date", "start_time", "end_date", "end_time"
    ))
    data = {
        "id": contact.pk,
        "first_name": contact.first_name,
        "last_name": contact.last_name,
        "created_at": contact.created_at.isoformat(),
        "updated_at": contact.updated_at.isoformat(),
        "contact_methods": methods,
        "events": events,
    }
    return JsonResponse(data)


def contact_update(request, pk):
    """Update a contact and its contact methods from JSON payload.

    Expects JSON: { "first_name": "...", "last_name": "...", "contact_methods": [{"type":"email","value":"x"}, ...] }
    Returns updated JSON same as contact_api.
    """
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest('Invalid JSON')

    contact = get_object_or_404(Contact, pk=pk)

    # Update basic fields
    first = payload.get('first_name')
    last = payload.get('last_name')
    if first is not None:
        contact.first_name = first
    if last is not None:
        contact.last_name = last
    contact.save()

    # Update contact methods: simple strategy - replace all methods with provided list
    methods = payload.get('contact_methods')
    if isinstance(methods, list):
        # Validate: do not allow duplicate email addresses for the same contact
        seen_emails = set()
        for m in methods:
            if (m.get('type') or '').lower() == 'email' and m.get('value'):
                email_norm = m.get('value').strip().lower()
                if email_norm in seen_emails:
                    return JsonResponse({
                        'error': 'This is a duplicate contact method, please enter a unique contact method.'
                    }, status=400)
                seen_emails.add(email_norm)

        # remove existing and create new methods
        ContactMethod.objects.filter(contact=contact).delete()
        for m in methods:
            mtype = m.get('type')
            mval = m.get('value')
            if mtype and mval:
                ContactMethod.objects.create(contact=contact, type=mtype, value=mval)

    # return updated representation
    methods_out = list(ContactMethod.objects.filter(contact=contact).values('id', 'type', 'value'))
    events_out = list(ScheduledEvent.objects.filter(contact=contact).order_by('start_date', 'start_time').values(
        'id', 'name', 'start_date', 'start_time', 'end_date', 'end_time'
    ))
    data = {
        'id': contact.pk,
        'first_name': contact.first_name,
        'last_name': contact.last_name,
        'created_at': contact.created_at.isoformat(),
        'updated_at': contact.updated_at.isoformat(),
        'contact_methods': methods_out,
        'events': events_out,
    }
    return JsonResponse(data)


def contact_create_api(request):
    """Create a contact from JSON payload and return its JSON representation.

    Expects JSON: { first_name, last_name, contact_methods: [{type, value}, ...] }
    If no payload is provided, creates an empty contact. Returns 201 on success.
    """
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        return HttpResponseBadRequest('Invalid JSON')

    first = payload.get('first_name', '')
    last = payload.get('last_name', '')

    c = Contact.objects.create(first_name=first, last_name=last)

    methods = payload.get('contact_methods')
    if isinstance(methods, list):
        # Validate duplicate emails in provided methods (per-contact constraint)
        seen_emails = set()
        for m in methods:
            if (m.get('type') or '').lower() == 'email' and m.get('value'):
                email_norm = m.get('value').strip().lower()
                if email_norm in seen_emails:
                    return JsonResponse({
                        'error': 'This is a duplicate contact method, please enter a unique contact method.'
                    }, status=400)
                seen_emails.add(email_norm)

        for m in methods:
            mtype = m.get('type')
            mval = m.get('value')
            if mtype and mval:
                ContactMethod.objects.create(contact=c, type=mtype, value=mval)

    data = {
        'id': c.pk,
        'first_name': c.first_name,
        'last_name': c.last_name,
        'created_at': c.created_at.isoformat(),
        'updated_at': c.updated_at.isoformat(),
        'contact_methods': list(ContactMethod.objects.filter(contact=c).values('id', 'type', 'value')),
        'events': list(ScheduledEvent.objects.filter(contact=c).order_by('start_date', 'start_time').values('id', 'name', 'start_date', 'start_time', 'end_date', 'end_time')),
    }
    return JsonResponse(data, status=201)


def contact_delete_api(request, pk):
    """Delete a contact and return JSON result.

    Accepts HTTP DELETE (preferred) or POST as a fallback for clients that
    can't send DELETE. Returns 200 with {'deleted': True} on success.
    """
    if request.method not in ('DELETE', 'POST'):
        return HttpResponseNotAllowed(['DELETE', 'POST'])

    contact = get_object_or_404(Contact, pk=pk)
    contact.delete()
    return JsonResponse({'deleted': True})

class ContactCreateView(CreateView):
    model = Contact
    fields = ["first_name", "last_name"]
    # We don't want a separate create template for this demo. A GET to the
    # create URL will create a blank Contact and immediately redirect back to
    # the home page with ?new=<pk> so the SPA can open the blank entry in the
    # existing detail form. This is acceptable for a small demo app without
    # authentication.
    def get(self, request, *args, **kwargs):
        # Create a blank contact and redirect to home so the client-side
        # JavaScript can load and edit it.
        obj = Contact.objects.create(first_name="", last_name="")
        home_url = reverse('home')
        return redirect(f"{home_url}?new={obj.pk}")

    def form_valid(self, form):
        # Fallback: if for some reason a POST arrives here, save and redirect
        # to the same home/?new=<pk> flow so the UI remains consistent.
        self.object = form.save()
        home_url = reverse('home')
        return redirect(f"{home_url}?new={self.object.pk}")

class ContactUpdateView(UpdateView):
    model = Contact
    fields = ["first_name", "last_name"]
    template_name = "contact/contact_form.html"
    success_url = reverse_lazy("contact:list")

class ContactDeleteView(DeleteView):
    model = Contact
    template_name = "contact/contact_confirm_delete.html"
    success_url = reverse_lazy("contact:list")