import type { FC } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Refine } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { dataProvider, authProvider } from '@/providers/refine';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDashboard } from './Dashboard';
import { TournamentsList } from './tournaments/TournamentsList';
import { TournamentCreate } from './tournaments/TournamentCreate';
import { TournamentEdit } from './tournaments/TournamentEdit';
import { ActivitiesList } from './activities/ActivitiesList';
import { ActivityCreate } from './activities/ActivityCreate';
import { ActivityEdit } from './activities/ActivityEdit';
import { RegistrationsList } from './registrations/RegistrationsList';
import { HotelPartnersList } from './hotel-partners/HotelPartnersList';
import { HotelPartnerCreate } from './hotel-partners/HotelPartnerCreate';
import { HotelPartnerEdit } from './hotel-partners/HotelPartnerEdit';
import { GuestInstructorsList } from './guest-instructors/GuestInstructorsList';
import { GuestInstructorCreate } from './guest-instructors/GuestInstructorCreate';
import { GuestInstructorEdit } from './guest-instructors/GuestInstructorEdit';
import { OrganizersList } from './organizers/OrganizersList';
import { OrganizerCreate } from './organizers/OrganizerCreate';
import { OrganizerEdit } from './organizers/OrganizerEdit';
import { AboutSectionsList } from './about-sections/AboutSectionsList';
import { AboutSectionCreate } from './about-sections/AboutSectionCreate';
import { AboutSectionEdit } from './about-sections/AboutSectionEdit';
import { SpecialEventsList } from './special-events/SpecialEventsList';
import { SpecialEventCreate } from './special-events/SpecialEventCreate';
import { SpecialEventEdit } from './special-events/SpecialEventEdit';
import { SiteSettings } from './site-settings/SiteSettings';
import { VolunteerSettings } from './volunteer/VolunteerSettings';
import { AddonsList } from './addons/AddonsList';
import { AddonCreate } from './addons/AddonCreate';
import { AddonEdit } from './addons/AddonEdit';
import { SponsorsList } from './sponsors/SponsorsList';
import { SponsorCreate } from './sponsors/SponsorCreate';
import { SponsorEdit } from './sponsors/SponsorEdit';
import { EmailTemplatesList } from './email-templates/EmailTemplatesList';
import { EventRegistrationSettings } from './event-registration-settings/EventRegistrationSettings';
import { WaiverSettings } from './waiver-settings/WaiverSettings';

/**
 * Admin section root component
 * Configures Refine and routes for admin panel
 */
export const Admin: FC = () => {
  return (
    <Refine
      dataProvider={dataProvider}
      authProvider={authProvider}
      routerProvider={routerProvider}
      resources={[
        {
          name: 'tournaments',
          list: '/admin/tournaments',
          create: '/admin/tournaments/create',
          edit: '/admin/tournaments/edit/:id',
          show: '/admin/tournaments/show/:id',
          meta: {
            label: 'Tournaments',
          },
        },
        {
          name: 'activities',
          list: '/admin/activities',
          create: '/admin/activities/create',
          edit: '/admin/activities/edit/:id',
          show: '/admin/activities/show/:id',
          meta: {
            label: 'Activities',
          },
        },
        {
          name: 'event_registrations',
          list: '/admin/registrations',
          show: '/admin/registrations/show/:id',
          meta: {
            label: 'Registrations',
          },
        },
        {
          name: 'addons',
          list: '/admin/addons',
          create: '/admin/addons/create',
          edit: '/admin/addons/edit/:id',
          meta: {
            label: 'Add-Ons',
          },
        },
        {
          name: 'hotel_partners',
          list: '/admin/hotel-partners',
          create: '/admin/hotel-partners/create',
          edit: '/admin/hotel-partners/edit/:id',
          meta: {
            label: 'Hotel Partners',
          },
        },
        {
          name: 'sponsors',
          list: '/admin/sponsors',
          create: '/admin/sponsors/create',
          edit: '/admin/sponsors/edit/:id',
          meta: {
            label: 'Sponsors & Vendors',
          },
        },
        {
          name: 'guest_instructors',
          list: '/admin/guest-instructors',
          create: '/admin/guest-instructors/create',
          edit: '/admin/guest-instructors/edit/:id',
          meta: {
            label: 'Guest Instructors',
          },
        },
        {
          name: 'organizers',
          list: '/admin/organizers',
          create: '/admin/organizers/create',
          edit: '/admin/organizers/edit/:id',
          meta: {
            label: 'Organizers',
          },
        },
        {
          name: 'about_sections',
          list: '/admin/about-sections',
          create: '/admin/about-sections/create',
          edit: '/admin/about-sections/edit/:id',
          meta: {
            label: 'About Sections',
          },
        },
        {
          name: 'special_events',
          list: '/admin/special-events',
          create: '/admin/special-events/create',
          edit: '/admin/special-events/edit/:id',
          meta: {
            label: 'Special Event',
          },
        },
        {
          name: 'site_settings',
          list: '/admin/site-settings',
          meta: {
            label: 'Site Settings',
          },
        },
        {
          name: 'volunteer',
          list: '/admin/volunteer',
          meta: {
            label: 'Volunteer',
          },
        },
        {
          name: 'event_registration_settings',
          list: '/admin/event-registration-settings',
          meta: {
            label: 'Event Registration',
          },
        },
        {
          name: 'email_templates',
          list: '/admin/email-templates',
          meta: {
            label: 'Email Templates',
          },
        },
        {
          name: 'waiver_settings',
          list: '/admin/waiver-settings',
          meta: {
            label: 'Waiver Settings',
          },
        },
      ]}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
      }}
    >
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
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminLayout>
    </Refine>
  );
};
