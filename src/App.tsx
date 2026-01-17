import type { FC } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Refine } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { dataProvider, authProvider } from '@/providers/refine';
import { ProtectedAdminRoute } from '@/components/routes/ProtectedAdminRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { AdminDashboard } from '@/pages/admin/Dashboard';
import { TournamentsList } from '@/pages/admin/tournaments/TournamentsList';
import { TournamentCreate } from '@/pages/admin/tournaments/TournamentCreate';
import { TournamentEdit } from '@/pages/admin/tournaments/TournamentEdit';
import { ActivitiesList } from '@/pages/admin/activities/ActivitiesList';
import { ActivityCreate } from '@/pages/admin/activities/ActivityCreate';
import { ActivityEdit } from '@/pages/admin/activities/ActivityEdit';
import { RegistrationsList } from '@/pages/admin/registrations/RegistrationsList';
import { HotelPartnersList } from '@/pages/admin/hotel-partners/HotelPartnersList';
import { HotelPartnerCreate } from '@/pages/admin/hotel-partners/HotelPartnerCreate';
import { HotelPartnerEdit } from '@/pages/admin/hotel-partners/HotelPartnerEdit';
import { GuestInstructorsList } from '@/pages/admin/guest-instructors/GuestInstructorsList';
import { GuestInstructorCreate } from '@/pages/admin/guest-instructors/GuestInstructorCreate';
import { GuestInstructorEdit } from '@/pages/admin/guest-instructors/GuestInstructorEdit';
import { OrganizersList } from '@/pages/admin/organizers/OrganizersList';
import { OrganizerCreate } from '@/pages/admin/organizers/OrganizerCreate';
import { OrganizerEdit } from '@/pages/admin/organizers/OrganizerEdit';
import { AboutSectionsList } from '@/pages/admin/about-sections/AboutSectionsList';
import { AboutSectionCreate } from '@/pages/admin/about-sections/AboutSectionCreate';
import { AboutSectionEdit } from '@/pages/admin/about-sections/AboutSectionEdit';
import { SpecialEventsList } from '@/pages/admin/special-events/SpecialEventsList';
import { SpecialEventCreate } from '@/pages/admin/special-events/SpecialEventCreate';
import { SpecialEventEdit } from '@/pages/admin/special-events/SpecialEventEdit';
import { SiteSettings } from '@/pages/admin/site-settings/SiteSettings';
import { VolunteerSettings } from '@/pages/admin/volunteer/VolunteerSettings';
import { AddonsList } from '@/pages/admin/addons/AddonsList';
import { AddonCreate } from '@/pages/admin/addons/AddonCreate';
import { AddonEdit } from '@/pages/admin/addons/AddonEdit';
import { SponsorsList } from '@/pages/admin/sponsors/SponsorsList';
import { SponsorCreate } from '@/pages/admin/sponsors/SponsorCreate';
import { SponsorEdit } from '@/pages/admin/sponsors/SponsorEdit';
import { EmailTemplatesList } from '@/pages/admin/email-templates/EmailTemplatesList';
import { EventRegistrationSettings } from '@/pages/admin/event-registration-settings/EventRegistrationSettings';
import { WaiverSettings } from '@/pages/admin/waiver-settings/WaiverSettings';
import { WaitlistList } from '@/pages/admin/waitlist/WaitlistList';
import { PendingBilling } from '@/pages/admin/billing/PendingBilling';

/**
 * Admin Panel App component
 * This is a standalone admin application for Cactus Cup management
 */
export const App: FC = () => {
  return (
    <BrowserRouter>
      <Refine
        dataProvider={dataProvider}
        authProvider={authProvider}
        routerProvider={routerProvider}
        resources={[
          {
            name: 'tournaments',
            list: '/tournaments',
            create: '/tournaments/create',
            edit: '/tournaments/edit/:id',
            show: '/tournaments/show/:id',
            meta: {
              label: 'Tournaments',
            },
          },
          {
            name: 'activities',
            list: '/activities',
            create: '/activities/create',
            edit: '/activities/edit/:id',
            show: '/activities/show/:id',
            meta: {
              label: 'Activities',
            },
          },
          {
            name: 'event_registrations',
            list: '/registrations',
            show: '/registrations/show/:id',
            meta: {
              label: 'Registrations',
            },
          },
          {
            name: 'addons',
            list: '/addons',
            create: '/addons/create',
            edit: '/addons/edit/:id',
            meta: {
              label: 'Add-Ons',
            },
          },
          {
            name: 'hotel_partners',
            list: '/hotel-partners',
            create: '/hotel-partners/create',
            edit: '/hotel-partners/edit/:id',
            meta: {
              label: 'Hotel Partners',
            },
          },
          {
            name: 'sponsors',
            list: '/sponsors',
            create: '/sponsors/create',
            edit: '/sponsors/edit/:id',
            meta: {
              label: 'Sponsors & Vendors',
            },
          },
          {
            name: 'guest_instructors',
            list: '/guest-instructors',
            create: '/guest-instructors/create',
            edit: '/guest-instructors/edit/:id',
            meta: {
              label: 'Guest Instructors',
            },
          },
          {
            name: 'organizers',
            list: '/organizers',
            create: '/organizers/create',
            edit: '/organizers/edit/:id',
            meta: {
              label: 'Organizers',
            },
          },
          {
            name: 'about_sections',
            list: '/about-sections',
            create: '/about-sections/create',
            edit: '/about-sections/edit/:id',
            meta: {
              label: 'About Sections',
            },
          },
          {
            name: 'special_events',
            list: '/special-events',
            create: '/special-events/create',
            edit: '/special-events/edit/:id',
            meta: {
              label: 'Special Event',
            },
          },
          {
            name: 'site_settings',
            list: '/site-settings',
            meta: {
              label: 'Site Settings',
            },
          },
          {
            name: 'volunteer',
            list: '/volunteer',
            meta: {
              label: 'Volunteer',
            },
          },
          {
            name: 'event_registration_settings',
            list: '/event-registration-settings',
            meta: {
              label: 'Event Registration',
            },
          },
          {
            name: 'email_templates',
            list: '/email-templates',
            meta: {
              label: 'Email Templates',
            },
          },
          {
            name: 'waiver_settings',
            list: '/waiver-settings',
            meta: {
              label: 'Waiver Settings',
            },
          },
          {
            name: 'waitlist',
            list: '/waitlist',
            meta: {
              label: 'Waitlist',
            },
          },
          {
            name: 'pending_billing',
            list: '/pending-billing',
            meta: {
              label: 'Pending Billing',
            },
          },
        ]}
        options={{
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
        }}
      >
        <Routes>
          {/* Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Admin Routes */}
          <Route
            path="/*"
            element={
              <ProtectedAdminRoute>
                <AdminLayout>
                  <Routes>
                    <Route path="/" element={<AdminDashboard />} />
                    <Route path="/tournaments" element={<TournamentsList />} />
                    <Route path="/tournaments/create" element={<TournamentCreate />} />
                    <Route path="/tournaments/edit/:id" element={<TournamentEdit />} />
                    <Route path="/activities" element={<ActivitiesList />} />
                    <Route path="/activities/create" element={<ActivityCreate />} />
                    <Route path="/activities/edit/:id" element={<ActivityEdit />} />
                    <Route path="/registrations" element={<RegistrationsList />} />
                    <Route path="/addons" element={<AddonsList />} />
                    <Route path="/addons/create" element={<AddonCreate />} />
                    <Route path="/addons/edit/:id" element={<AddonEdit />} />
                    <Route path="/hotel-partners" element={<HotelPartnersList />} />
                    <Route path="/hotel-partners/create" element={<HotelPartnerCreate />} />
                    <Route path="/hotel-partners/edit/:id" element={<HotelPartnerEdit />} />
                    <Route path="/sponsors" element={<SponsorsList />} />
                    <Route path="/sponsors/create" element={<SponsorCreate />} />
                    <Route path="/sponsors/edit/:id" element={<SponsorEdit />} />
                    <Route path="/guest-instructors" element={<GuestInstructorsList />} />
                    <Route path="/guest-instructors/create" element={<GuestInstructorCreate />} />
                    <Route path="/guest-instructors/edit/:id" element={<GuestInstructorEdit />} />
                    <Route path="/organizers" element={<OrganizersList />} />
                    <Route path="/organizers/create" element={<OrganizerCreate />} />
                    <Route path="/organizers/edit/:id" element={<OrganizerEdit />} />
                    <Route path="/about-sections" element={<AboutSectionsList />} />
                    <Route path="/about-sections/create" element={<AboutSectionCreate />} />
                    <Route path="/about-sections/edit/:id" element={<AboutSectionEdit />} />
                    <Route path="/special-events" element={<SpecialEventsList />} />
                    <Route path="/special-events/create" element={<SpecialEventCreate />} />
                    <Route path="/special-events/edit/:id" element={<SpecialEventEdit />} />
                    <Route path="/site-settings" element={<SiteSettings />} />
                    <Route path="/volunteer" element={<VolunteerSettings />} />
                    <Route path="/event-registration-settings" element={<EventRegistrationSettings />} />
                    <Route path="/email-templates" element={<EmailTemplatesList />} />
                    <Route path="/waiver-settings" element={<WaiverSettings />} />
                    <Route path="/waitlist" element={<WaitlistList />} />
                    <Route path="/pending-billing" element={<PendingBilling />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AdminLayout>
              </ProtectedAdminRoute>
            }
          />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
};
