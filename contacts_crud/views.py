from django.views.generic import TemplateView
from contact.models import Contact

class HomePageView(TemplateView):
    template_name = "home.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Order contacts by last name, then first name for an alphabetical list
        context["contacts"] = Contact.objects.order_by('last_name', 'first_name')
        return context