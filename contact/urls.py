from django.urls import path
from .views import (
    ContactListView, ContactDetailView, ContactCreateView, ContactUpdateView, ContactDeleteView,
    ContactDetailPartialView, contact_api,
)
from .views import contact_update
from contact_method.views import contact_method_delete
from .views import contact_create_api
from .views import contact_delete_api
from .views import event_create_api
from .views import event_delete_api

app_name = "contact"

urlpatterns = [
    path("", ContactListView.as_view(), name="list"),
    path("create/", ContactCreateView.as_view(), name="create"),
    path("<int:pk>/", ContactDetailView.as_view(), name="detail"),
    path("partial/<int:pk>/", ContactDetailPartialView.as_view(), name="partial"),
     path("api/<int:pk>/", contact_api, name="api"),
     path("api/<int:pk>/update/", contact_update, name="api-update"),
    path("api/create/", contact_create_api, name="api-create"),
    path("api/<int:pk>/events/create/", event_create_api, name="event-create"),
    path("event/<int:pk>/delete/", event_delete_api, name="event-delete"),
    path("api/<int:pk>/delete/", contact_delete_api, name="api-delete"),
    path("method/<int:pk>/delete/", contact_method_delete, name="method-delete"),
    path("<int:pk>/edit/", ContactUpdateView.as_view(), name="edit"),
    path("<int:pk>/delete/", ContactDeleteView.as_view(), name="delete"),
]