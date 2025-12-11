import { useState, useCallback } from 'react';
import { supabase } from '@/lib/api/supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import type {
  DbTournament,
  DbActivity,
  DbAddon,
  DbHotelPartner,
  DbGuestInstructor,
  DbOrganizer,
  DbAboutSection,
  DbSiteSetting,
  DbSpecialEvent,
  DbSponsor,
  Tournament,
  Activity,
  Addon,
  HotelPartner,
  GuestInstructor,
  Organizer,
  AboutSection,
  SiteSetting,
  SpecialEvent,
  Sponsor,
} from '@/types';
import {
  dbToTournament,
  dbToActivity,
  dbToAddon,
  dbToHotelPartner,
  dbToGuestInstructor,
  dbToOrganizer,
  dbToAboutSection,
  dbToSiteSetting,
  dbToSpecialEvent,
  dbToSponsor,
} from '@/types';

export interface AdminState {
  loading: boolean;
  error: PostgrestError | null;
}

export interface ListOptions {
  pagination?: {
    page: number;
    pageSize: number;
  };
  sorters?: Array<{
    field: string;
    order: 'asc' | 'desc';
  }>;
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
}

export interface UseAdminReturn extends AdminState {
  // Generic CRUD operations
  create: <T>(resource: string, data: T) => Promise<void>;
  update: <T>(resource: string, id: string, data: Partial<T>) => Promise<void>;
  delete: (resource: string, id: string) => Promise<void>;
  getOne: <T>(resource: string, id: string) => Promise<T>;
  getList: <T>(resource: string, options?: ListOptions) => Promise<T[]>;

  // Tournament operations
  createTournament: (data: Omit<DbTournament, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateTournament: (id: string, data: Partial<DbTournament>) => Promise<void>;
  deleteTournament: (id: string) => Promise<void>;
  getTournament: (id: string) => Promise<Tournament>;
  listTournaments: (options?: ListOptions) => Promise<Tournament[]>;

  // Activity operations
  createActivity: (data: Omit<DbActivity, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateActivity: (id: string, data: Partial<DbActivity>) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  getActivity: (id: string) => Promise<Activity>;
  listActivities: (options?: ListOptions) => Promise<Activity[]>;

  // Addon operations
  createAddon: (data: Omit<DbAddon, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateAddon: (id: string, data: Partial<DbAddon>) => Promise<void>;
  deleteAddon: (id: string) => Promise<void>;
  getAddon: (id: string) => Promise<Addon>;
  listAddons: (options?: ListOptions) => Promise<Addon[]>;

  // Hotel Partner operations
  createHotelPartner: (data: Omit<DbHotelPartner, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateHotelPartner: (id: string, data: Partial<DbHotelPartner>) => Promise<void>;
  deleteHotelPartner: (id: string) => Promise<void>;
  getHotelPartner: (id: string) => Promise<HotelPartner>;
  listHotelPartners: (options?: ListOptions) => Promise<HotelPartner[]>;

  // Guest Instructor operations
  createGuestInstructor: (data: Omit<DbGuestInstructor, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateGuestInstructor: (id: string, data: Partial<DbGuestInstructor>) => Promise<void>;
  deleteGuestInstructor: (id: string) => Promise<void>;
  getGuestInstructor: (id: string) => Promise<GuestInstructor>;
  listGuestInstructors: (options?: ListOptions) => Promise<GuestInstructor[]>;

  // Organizer operations
  createOrganizer: (data: Omit<DbOrganizer, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateOrganizer: (id: string, data: Partial<DbOrganizer>) => Promise<void>;
  deleteOrganizer: (id: string) => Promise<void>;
  getOrganizer: (id: string) => Promise<Organizer>;
  listOrganizers: (options?: ListOptions) => Promise<Organizer[]>;

  // About Section operations
  createAboutSection: (data: Omit<DbAboutSection, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateAboutSection: (id: string, data: Partial<DbAboutSection>) => Promise<void>;
  deleteAboutSection: (id: string) => Promise<void>;
  getAboutSection: (id: string) => Promise<AboutSection>;
  listAboutSections: (options?: ListOptions) => Promise<AboutSection[]>;

  // Site Settings operations
  updateSiteSetting: (id: string, data: Partial<DbSiteSetting>) => Promise<void>;
  getSiteSetting: (id: string) => Promise<SiteSetting>;
  listSiteSettings: () => Promise<SiteSetting[]>;

  // Special Event operations
  createSpecialEvent: (data: Omit<DbSpecialEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateSpecialEvent: (id: string, data: Partial<DbSpecialEvent>) => Promise<void>;
  deleteSpecialEvent: (id: string) => Promise<void>;
  getSpecialEvent: (id: string) => Promise<SpecialEvent>;
  listSpecialEvents: (options?: ListOptions) => Promise<SpecialEvent[]>;
  getActiveSpecialEvents: () => Promise<SpecialEvent[]>;
  activateSpecialEvent: (id: string) => Promise<void>;
  deactivateSpecialEvent: (id: string) => Promise<void>;

  // Sponsor operations
  createSponsor: (data: Omit<DbSponsor, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateSponsor: (id: string, data: Partial<DbSponsor>) => Promise<void>;
  deleteSponsor: (id: string) => Promise<void>;
  getSponsor: (id: string) => Promise<Sponsor>;
  listSponsors: (options?: ListOptions) => Promise<Sponsor[]>;
}

/**
 * Admin hook providing CRUD operations for admin resources
 * Uses Supabase client directly with proper TypeScript typing
 */
export function useAdmin(): UseAdminReturn {
  const [state, setState] = useState<AdminState>({
    loading: false,
    error: null,
  });

  // ============================================================================
  // Generic CRUD Operations
  // ============================================================================

  const create = useCallback(async <T,>(resource: string, data: T): Promise<void> => {
    setState({ loading: true, error: null });

    try {
      const { error } = await supabase.from(resource).insert([data as any]);

      if (error) throw error;

      setState({ loading: false, error: null });
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const update = useCallback(async <T,>(resource: string, id: string, data: Partial<T>): Promise<void> => {
    setState({ loading: true, error: null });

    try {
      const { error } = await supabase.from(resource).update(data as any).eq('id', id);

      if (error) throw error;

      setState({ loading: false, error: null });
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const deleteResource = useCallback(async (resource: string, id: string): Promise<void> => {
    setState({ loading: true, error: null });

    try {
      const { error } = await supabase.from(resource).delete().eq('id', id);

      if (error) throw error;

      setState({ loading: false, error: null });
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const getOne = useCallback(async <T,>(resource: string, id: string): Promise<T> => {
    setState({ loading: true, error: null });

    try {
      const { data, error } = await supabase.from(resource).select('*').eq('id', id).single();

      if (error) throw error;
      if (!data) throw new Error(`${resource} not found`);

      setState({ loading: false, error: null });
      return data as T;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const getList = useCallback(async <T,>(resource: string, options?: ListOptions): Promise<T[]> => {
    setState({ loading: true, error: null });

    try {
      let query = supabase.from(resource).select('*');

      // Apply pagination
      if (options?.pagination) {
        const { page, pageSize } = options.pagination;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      // Apply sorters
      if (options?.sorters && options.sorters.length > 0) {
        options.sorters.forEach(sorter => {
          query = query.order(sorter.field, { ascending: sorter.order === 'asc' });
        });
      }

      // Apply filters
      if (options?.filters && options.filters.length > 0) {
        options.filters.forEach(filter => {
          query = query.filter(filter.field, filter.operator, filter.value);
        });
      }

      const { data, error } = await query;

      if (error) throw error;

      setState({ loading: false, error: null });
      return data as T[];
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  // ============================================================================
  // Tournament Operations
  // ============================================================================

  const createTournament = useCallback(async (data: Omit<DbTournament, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await supabase
        .from('tournaments')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create tournament');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateTournament = useCallback(async (id: string, data: Partial<DbTournament>): Promise<void> => {
    await update<DbTournament>('tournaments', id, data);
  }, [update]);

  const deleteTournament = useCallback(async (id: string): Promise<void> => {
    await deleteResource('tournaments', id);
  }, [deleteResource]);

  const getTournament = useCallback(async (id: string): Promise<Tournament> => {
    const data = await getOne<DbTournament>('tournaments', id);
    return dbToTournament(data);
  }, [getOne]);

  const listTournaments = useCallback(async (options?: ListOptions): Promise<Tournament[]> => {
    const data = await getList<DbTournament>('tournaments', options);
    return data.map(dbToTournament);
  }, [getList]);

  // ============================================================================
  // Activity Operations
  // ============================================================================

  const createActivity = useCallback(async (data: Omit<DbActivity, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await supabase
        .from('activities')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create activity');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateActivity = useCallback(async (id: string, data: Partial<DbActivity>): Promise<void> => {
    await update<DbActivity>('activities', id, data);
  }, [update]);

  const deleteActivity = useCallback(async (id: string): Promise<void> => {
    await deleteResource('activities', id);
  }, [deleteResource]);

  const getActivity = useCallback(async (id: string): Promise<Activity> => {
    const data = await getOne<DbActivity>('activities', id);
    return dbToActivity(data);
  }, [getOne]);

  const listActivities = useCallback(async (options?: ListOptions): Promise<Activity[]> => {
    const data = await getList<DbActivity>('activities', options);
    return data.map(dbToActivity);
  }, [getList]);

  // ============================================================================
  // Addon Operations
  // ============================================================================

  const createAddon = useCallback(async (data: Omit<DbAddon, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await supabase
        .from('addons')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create addon');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateAddon = useCallback(async (id: string, data: Partial<DbAddon>): Promise<void> => {
    await update<DbAddon>('addons', id, data);
  }, [update]);

  const deleteAddon = useCallback(async (id: string): Promise<void> => {
    await deleteResource('addons', id);
  }, [deleteResource]);

  const getAddon = useCallback(async (id: string): Promise<Addon> => {
    const data = await getOne<DbAddon>('addons', id);
    return dbToAddon(data);
  }, [getOne]);

  const listAddons = useCallback(async (options?: ListOptions): Promise<Addon[]> => {
    const data = await getList<DbAddon>('addons', options);
    return data.map(dbToAddon);
  }, [getList]);

  // ============================================================================
  // Hotel Partner Operations
  // ============================================================================

  const createHotelPartner = useCallback(async (data: Omit<DbHotelPartner, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      // If this hotel is being set as primary, unset all other primary hotels first
      if (data.is_primary) {
        const { error: unsetError } = await supabase
          .from('hotel_partners')
          .update({ is_primary: false })
          .eq('is_primary', true);

        if (unsetError) throw unsetError;
      }

      const { data: result, error } = await supabase
        .from('hotel_partners')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create hotel partner');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateHotelPartner = useCallback(async (id: string, data: Partial<DbHotelPartner>): Promise<void> => {
    setState({ loading: true, error: null });

    try {
      // If this hotel is being set as primary, unset all other primary hotels first
      if (data.is_primary) {
        const { error: unsetError } = await supabase
          .from('hotel_partners')
          .update({ is_primary: false })
          .eq('is_primary', true)
          .neq('id', id); // Don't unset this hotel itself

        if (unsetError) throw unsetError;
      }

      const { error } = await supabase.from('hotel_partners').update(data as any).eq('id', id);

      if (error) throw error;

      setState({ loading: false, error: null });
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const deleteHotelPartner = useCallback(async (id: string): Promise<void> => {
    await deleteResource('hotel_partners', id);
  }, [deleteResource]);

  const getHotelPartner = useCallback(async (id: string): Promise<HotelPartner> => {
    const data = await getOne<DbHotelPartner>('hotel_partners', id);
    return dbToHotelPartner(data);
  }, [getOne]);

  const listHotelPartners = useCallback(async (options?: ListOptions): Promise<HotelPartner[]> => {
    const data = await getList<DbHotelPartner>('hotel_partners', options);
    return data.map(dbToHotelPartner);
  }, [getList]);

  // ============================================================================
  // Guest Instructor Operations
  // ============================================================================

  const createGuestInstructor = useCallback(async (data: Omit<DbGuestInstructor, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await supabase
        .from('guest_instructors')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create guest instructor');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateGuestInstructor = useCallback(async (id: string, data: Partial<DbGuestInstructor>): Promise<void> => {
    await update<DbGuestInstructor>('guest_instructors', id, data);
  }, [update]);

  const deleteGuestInstructor = useCallback(async (id: string): Promise<void> => {
    await deleteResource('guest_instructors', id);
  }, [deleteResource]);

  const getGuestInstructor = useCallback(async (id: string): Promise<GuestInstructor> => {
    const data = await getOne<DbGuestInstructor>('guest_instructors', id);
    return dbToGuestInstructor(data);
  }, [getOne]);

  const listGuestInstructors = useCallback(async (options?: ListOptions): Promise<GuestInstructor[]> => {
    const data = await getList<DbGuestInstructor>('guest_instructors', options);
    return data.map(dbToGuestInstructor);
  }, [getList]);

  // ============================================================================
  // Organizer Operations
  // ============================================================================

  const createOrganizer = useCallback(async (data: Omit<DbOrganizer, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await supabase
        .from('organizers')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create organizer');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateOrganizer = useCallback(async (id: string, data: Partial<DbOrganizer>): Promise<void> => {
    await update<DbOrganizer>('organizers', id, data);
  }, [update]);

  const deleteOrganizer = useCallback(async (id: string): Promise<void> => {
    await deleteResource('organizers', id);
  }, [deleteResource]);

  const getOrganizer = useCallback(async (id: string): Promise<Organizer> => {
    const data = await getOne<DbOrganizer>('organizers', id);
    return dbToOrganizer(data);
  }, [getOne]);

  const listOrganizers = useCallback(async (options?: ListOptions): Promise<Organizer[]> => {
    const data = await getList<DbOrganizer>('organizers', options);
    return data.map(dbToOrganizer);
  }, [getList]);

  // ============================================================================
  // About Section Operations
  // ============================================================================

  const createAboutSection = useCallback(async (data: Omit<DbAboutSection, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await supabase
        .from('about_sections')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create about section');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateAboutSection = useCallback(async (id: string, data: Partial<DbAboutSection>): Promise<void> => {
    await update<DbAboutSection>('about_sections', id, data);
  }, [update]);

  const deleteAboutSection = useCallback(async (id: string): Promise<void> => {
    await deleteResource('about_sections', id);
  }, [deleteResource]);

  const getAboutSection = useCallback(async (id: string): Promise<AboutSection> => {
    const data = await getOne<DbAboutSection>('about_sections', id);
    return dbToAboutSection(data);
  }, [getOne]);

  const listAboutSections = useCallback(async (options?: ListOptions): Promise<AboutSection[]> => {
    const data = await getList<DbAboutSection>('about_sections', options);
    return data.map(dbToAboutSection);
  }, [getList]);

  // ============================================================================
  // Site Settings Operations
  // ============================================================================

  const updateSiteSetting = useCallback(async (id: string, data: Partial<DbSiteSetting>): Promise<void> => {
    await update<DbSiteSetting>('site_settings', id, data);
  }, [update]);

  const getSiteSetting = useCallback(async (id: string): Promise<SiteSetting> => {
    const data = await getOne<DbSiteSetting>('site_settings', id);
    return dbToSiteSetting(data);
  }, [getOne]);

  const listSiteSettings = useCallback(async (): Promise<SiteSetting[]> => {
    const data = await getList<DbSiteSetting>('site_settings');
    return data.map(dbToSiteSetting);
  }, [getList]);

  // ============================================================================
  // Special Event Operations
  // ============================================================================

  const createSpecialEvent = useCallback(async (data: Omit<DbSpecialEvent, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await supabase
        .from('special_events')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create special event');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateSpecialEvent = useCallback(async (id: string, data: Partial<DbSpecialEvent>): Promise<void> => {
    await update<DbSpecialEvent>('special_events', id, data);
  }, [update]);

  const deleteSpecialEvent = useCallback(async (id: string): Promise<void> => {
    await deleteResource('special_events', id);
  }, [deleteResource]);

  const getSpecialEvent = useCallback(async (id: string): Promise<SpecialEvent> => {
    const data = await getOne<DbSpecialEvent>('special_events', id);
    return dbToSpecialEvent(data);
  }, [getOne]);

  const listSpecialEvents = useCallback(async (options?: ListOptions): Promise<SpecialEvent[]> => {
    const data = await getList<DbSpecialEvent>('special_events', options);
    return data.map(dbToSpecialEvent);
  }, [getList]);

  const getActiveSpecialEvents = useCallback(async (): Promise<SpecialEvent[]> => {
    setState({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('special_events')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      setState({ loading: false, error: null });
      return data ? data.map(dbToSpecialEvent) : [];
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const activateSpecialEvent = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });

    try {
      const { error: activateError } = await supabase
        .from('special_events')
        .update({ is_active: true })
        .eq('id', id);

      if (activateError) throw activateError;

      setState({ loading: false, error: null });
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const deactivateSpecialEvent = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });

    try {
      const { error: deactivateError } = await supabase
        .from('special_events')
        .update({ is_active: false })
        .eq('id', id);

      if (deactivateError) throw deactivateError;

      setState({ loading: false, error: null });
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  // ============================================================================
  // Sponsor Operations
  // ============================================================================

  const createSponsor = useCallback(async (data: Omit<DbSponsor, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    setState({ loading: true, error: null });

    try {
      const { data: result, error } = await supabase
        .from('sponsors')
        .insert([data])
        .select('id')
        .single();

      if (error) throw error;
      if (!result) throw new Error('Failed to create sponsor');

      setState({ loading: false, error: null });
      return result.id;
    } catch (error) {
      const pgError = error as PostgrestError;
      setState({ loading: false, error: pgError });
      throw error;
    }
  }, []);

  const updateSponsor = useCallback(async (id: string, data: Partial<DbSponsor>): Promise<void> => {
    await update<DbSponsor>('sponsors', id, data);
  }, [update]);

  const deleteSponsor = useCallback(async (id: string): Promise<void> => {
    await deleteResource('sponsors', id);
  }, [deleteResource]);

  const getSponsor = useCallback(async (id: string): Promise<Sponsor> => {
    const data = await getOne<DbSponsor>('sponsors', id);
    return dbToSponsor(data);
  }, [getOne]);

  const listSponsors = useCallback(async (options?: ListOptions): Promise<Sponsor[]> => {
    const data = await getList<DbSponsor>('sponsors', options);
    return data.map(dbToSponsor);
  }, [getList]);

  return {
    ...state,
    create,
    update,
    delete: deleteResource,
    getOne,
    getList,
    createTournament,
    updateTournament,
    deleteTournament,
    getTournament,
    listTournaments,
    createActivity,
    updateActivity,
    deleteActivity,
    getActivity,
    listActivities,
    createAddon,
    updateAddon,
    deleteAddon,
    getAddon,
    listAddons,
    createHotelPartner,
    updateHotelPartner,
    deleteHotelPartner,
    getHotelPartner,
    listHotelPartners,
    createGuestInstructor,
    updateGuestInstructor,
    deleteGuestInstructor,
    getGuestInstructor,
    listGuestInstructors,
    createOrganizer,
    updateOrganizer,
    deleteOrganizer,
    getOrganizer,
    listOrganizers,
    createAboutSection,
    updateAboutSection,
    deleteAboutSection,
    getAboutSection,
    listAboutSections,
    updateSiteSetting,
    getSiteSetting,
    listSiteSettings,
    createSpecialEvent,
    updateSpecialEvent,
    deleteSpecialEvent,
    getSpecialEvent,
    listSpecialEvents,
    getActiveSpecialEvents,
    activateSpecialEvent,
    deactivateSpecialEvent,
    createSponsor,
    updateSponsor,
    deleteSponsor,
    getSponsor,
    listSponsors,
  };
}
