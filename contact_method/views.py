from django.shortcuts import render
from contact_method.models import ContactMethod
from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponseNotAllowed

class ContactMethodListView(ListView):
    model = ContactMethod
    template_name = "contact_method/contact_method_list.html"
    context_object_name = "contact_methods"

class ContactMethodCreateView(CreateView):
    model = ContactMethod
    fields = ["type", "value"]
    template_name = "contact_method/contact_method_form.html"
    success_url = reverse_lazy("contact_method:list")
    
class ContactMethodUpdateView(UpdateView):
    model = ContactMethod
    fields = ["type", "value"]
    template_name = "contact_method/contact_method_form.html"
    success_url = reverse_lazy("contact_method:list")

class ContactMethodDeleteView(DeleteView):
    model = ContactMethod
    template_name = "contact_method/contact_method_confirm_delete.html"
    success_url = reverse_lazy("contact_method:list")


def contact_method_delete(request, pk):
    """API endpoint to delete a ContactMethod by id.

    Accepts HTTP DELETE. Returns JSON { deleted: true, id: pk } on success.
    """
    if request.method != 'DELETE':
        return HttpResponseNotAllowed(['DELETE'])

    cm = get_object_or_404(ContactMethod, pk=pk)
    cm.delete()
    return JsonResponse({'deleted': True, 'id': pk})