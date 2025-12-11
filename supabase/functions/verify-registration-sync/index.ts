import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncIssue {
  issueType: 'missing_registration' | 'orphaned_registration' | 'missing_addon_link';
  itemType: string;
  itemName: string;
  orderId: string | null;
  orderNumber: string | null;
  orderItemId: string | null;
  registrationId: string | null;
  userId: string;
  userName: string;
  total: number;
  createdAt: string;
  details: string;
}

interface UserSyncResult {
  userId: string;
  userName: string;
  userEmail: string | null;
  // Counts
  orderItemsCount: number;
  tournamentRegistrationsCount: number;
  activityRegistrationsCount: number;
  eventRegistrationsCount: number;
  specialEventRegistrationsCount: number;
  addonPurchasesCount: number;
  totalRegistrationsCount: number;
  // Issues
  issues: SyncIssue[];
  hasIssues: boolean;
}

interface SyncVerificationSummary {
  totalUsersChecked: number;
  totalUsersWithIssues: number;
  totalOrderItems: number;
  totalTournamentRegistrations: number;
  totalActivityRegistrations: number;
  totalEventRegistrations: number;
  totalSpecialEventRegistrations: number;
  totalAddonPurchases: number;
  totalRegistrations: number;
  totalMissingRegistrations: number;
  totalOrphanedRegistrations: number;
  totalMissingAddonLinks: number;
  users: UserSyncResult[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =====================================================
    // STEP 1: Fetch all data in parallel for better performance
    // =====================================================
    const [
      ordersResult,
      tournamentRegsResult,
      activityRegsResult,
      eventRegsResult,
      specialEventRegsResult,
    ] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          id,
          order_number,
          user_id,
          payment_status,
          created_at
        `)
        .eq('payment_status', 'paid'),
      supabase
        .from('tournament_registrations')
        .select('id, user_id, tournament_id, order_id, payment_status, registered_at, tournaments(name)'),
      supabase
        .from('activity_registrations')
        .select('id, user_id, activity_id, order_id, payment_status, registered_at, activities(title)'),
      supabase
        .from('event_registrations')
        .select('id, user_id, event_year, payment_status, created_at'),
      supabase
        .from('special_event_registrations')
        .select('id, user_id, event_id, order_id, payment_status, registered_at, special_events(title)'),
    ]);

    if (ordersResult.error) {
      throw new Error(`Failed to fetch orders: ${ordersResult.error.message}`);
    }

    const paidOrders = ordersResult.data || [];
    const tournamentRegs = tournamentRegsResult.data || [];
    const activityRegs = activityRegsResult.data || [];
    const eventRegs = eventRegsResult.data || [];
    const specialEventRegs = specialEventRegsResult.data || [];

    // Initialize summary
    const summary: SyncVerificationSummary = {
      totalUsersChecked: 0,
      totalUsersWithIssues: 0,
      totalOrderItems: 0,
      totalTournamentRegistrations: tournamentRegs.length,
      totalActivityRegistrations: activityRegs.length,
      totalEventRegistrations: eventRegs.length,
      totalSpecialEventRegistrations: specialEventRegs.length,
      totalAddonPurchases: 0,
      totalRegistrations: tournamentRegs.length + activityRegs.length + eventRegs.length + specialEventRegs.length,
      totalMissingRegistrations: 0,
      totalOrphanedRegistrations: 0,
      totalMissingAddonLinks: 0,
      users: [],
    };

    if (paidOrders.length === 0) {
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all order IDs and user IDs
    const orderIds = paidOrders.map(o => o.id);
    const orderUserIds = [...new Set(paidOrders.map(o => o.user_id))];

    // Also include users from registrations who may not have orders
    const regUserIds = [
      ...tournamentRegs.map(r => r.user_id),
      ...activityRegs.map(r => r.user_id),
      ...eventRegs.map(r => r.user_id),
      ...specialEventRegs.map(r => r.user_id),
    ];
    const allUserIds = [...new Set([...orderUserIds, ...regUserIds])];

    // Fetch order items and profiles in parallel
    const [orderItemsResult, profilesResult] = await Promise.all([
      supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          item_name,
          item_type,
          item_id,
          quantity,
          total,
          tournament_registration_id,
          activity_registration_id,
          event_registration_id,
          special_event_registration_id,
          addon_id,
          created_at
        `)
        .in('order_id', orderIds),
      supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', allUserIds),
    ]);

    if (orderItemsResult.error) {
      throw new Error(`Failed to fetch order items: ${orderItemsResult.error.message}`);
    }

    const orderItems = orderItemsResult.data || [];
    const profiles = profilesResult.data || [];

    summary.totalOrderItems = orderItems.length;

    // Create lookup maps
    const profileMap = new Map(
      profiles.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown'])
    );
    const orderMap = new Map(paidOrders.map(o => [o.id, o]));

    // Create sets for registration IDs
    const tournamentRegIds = new Set(tournamentRegs.map(r => r.id));
    const activityRegIds = new Set(activityRegs.map(r => r.id));
    const eventRegIds = new Set(eventRegs.map(r => r.id));
    const specialEventRegIds = new Set(specialEventRegs.map(r => r.id));

    // Track linked registrations
    const linkedTournamentRegIds = new Set<string>();
    const linkedActivityRegIds = new Set<string>();
    const linkedEventRegIds = new Set<string>();
    const linkedSpecialEventRegIds = new Set<string>();

    // =====================================================
    // STEP 2: Build user data map with counts
    // =====================================================
    const userDataMap = new Map<string, UserSyncResult>();

    // Initialize all users
    for (const userId of allUserIds) {
      userDataMap.set(userId, {
        userId,
        userName: profileMap.get(userId) || 'Unknown',
        userEmail: null,
        orderItemsCount: 0,
        tournamentRegistrationsCount: 0,
        activityRegistrationsCount: 0,
        eventRegistrationsCount: 0,
        specialEventRegistrationsCount: 0,
        addonPurchasesCount: 0,
        totalRegistrationsCount: 0,
        issues: [],
        hasIssues: false,
      });
    }

    // Count registrations per user
    for (const reg of tournamentRegs) {
      const userData = userDataMap.get(reg.user_id);
      if (userData) {
        userData.tournamentRegistrationsCount++;
        userData.totalRegistrationsCount++;
      }
    }

    for (const reg of activityRegs) {
      const userData = userDataMap.get(reg.user_id);
      if (userData) {
        userData.activityRegistrationsCount++;
        userData.totalRegistrationsCount++;
      }
    }

    for (const reg of eventRegs) {
      const userData = userDataMap.get(reg.user_id);
      if (userData) {
        userData.eventRegistrationsCount++;
        userData.totalRegistrationsCount++;
      }
    }

    for (const reg of specialEventRegs) {
      const userData = userDataMap.get(reg.user_id);
      if (userData) {
        userData.specialEventRegistrationsCount++;
        userData.totalRegistrationsCount++;
      }
    }

    // =====================================================
    // STEP 3: Process order items and check for issues
    // =====================================================
    for (const item of orderItems) {
      const order = orderMap.get(item.order_id);
      if (!order) continue;

      const userId = order.user_id;
      const userData = userDataMap.get(userId);
      if (!userData) continue;

      userData.orderItemsCount++;
      const itemTypeLower = (item.item_type || '').toLowerCase();

      // Track addon purchases
      if (item.addon_id) {
        userData.addonPurchasesCount++;
        summary.totalAddonPurchases++;
      }

      // Check tournament items
      if (itemTypeLower.includes('tournament')) {
        if (item.tournament_registration_id) {
          linkedTournamentRegIds.add(item.tournament_registration_id);
          if (!tournamentRegIds.has(item.tournament_registration_id)) {
            userData.issues.push({
              issueType: 'missing_registration',
              itemType: 'tournament',
              itemName: item.item_name,
              orderId: order.id,
              orderNumber: order.order_number,
              orderItemId: item.id,
              registrationId: item.tournament_registration_id,
              userId,
              userName: userData.userName,
              total: item.total || 0,
              createdAt: item.created_at || order.created_at,
              details: `Order item references tournament_registration_id ${item.tournament_registration_id} but registration not found`,
            });
            summary.totalMissingRegistrations++;
          }
        } else {
          userData.issues.push({
            issueType: 'missing_registration',
            itemType: 'tournament',
            itemName: item.item_name,
            orderId: order.id,
            orderNumber: order.order_number,
            orderItemId: item.id,
            registrationId: null,
            userId,
            userName: userData.userName,
            total: item.total || 0,
            createdAt: item.created_at || order.created_at,
            details: 'Paid tournament order item has no tournament_registration_id link',
          });
          summary.totalMissingRegistrations++;
        }
      }

      // Check activity items
      if (itemTypeLower.includes('activity') || itemTypeLower.includes('class') || itemTypeLower.includes('workshop')) {
        if (item.activity_registration_id) {
          linkedActivityRegIds.add(item.activity_registration_id);
          if (!activityRegIds.has(item.activity_registration_id)) {
            userData.issues.push({
              issueType: 'missing_registration',
              itemType: 'activity',
              itemName: item.item_name,
              orderId: order.id,
              orderNumber: order.order_number,
              orderItemId: item.id,
              registrationId: item.activity_registration_id,
              userId,
              userName: userData.userName,
              total: item.total || 0,
              createdAt: item.created_at || order.created_at,
              details: `Order item references activity_registration_id ${item.activity_registration_id} but registration not found`,
            });
            summary.totalMissingRegistrations++;
          }
        } else {
          userData.issues.push({
            issueType: 'missing_registration',
            itemType: 'activity',
            itemName: item.item_name,
            orderId: order.id,
            orderNumber: order.order_number,
            orderItemId: item.id,
            registrationId: null,
            userId,
            userName: userData.userName,
            total: item.total || 0,
            createdAt: item.created_at || order.created_at,
            details: 'Paid activity order item has no activity_registration_id link',
          });
          summary.totalMissingRegistrations++;
        }
      }

      // Check event registration items
      if (itemTypeLower.includes('event_registration') ||
          itemTypeLower.includes('supporter') ||
          itemTypeLower.includes('spectator')) {
        if (item.event_registration_id) {
          linkedEventRegIds.add(item.event_registration_id);
          if (!eventRegIds.has(item.event_registration_id)) {
            userData.issues.push({
              issueType: 'missing_registration',
              itemType: 'event_registration',
              itemName: item.item_name,
              orderId: order.id,
              orderNumber: order.order_number,
              orderItemId: item.id,
              registrationId: item.event_registration_id,
              userId,
              userName: userData.userName,
              total: item.total || 0,
              createdAt: item.created_at || order.created_at,
              details: `Order item references event_registration_id ${item.event_registration_id} but registration not found`,
            });
            summary.totalMissingRegistrations++;
          }
        } else {
          userData.issues.push({
            issueType: 'missing_registration',
            itemType: 'event_registration',
            itemName: item.item_name,
            orderId: order.id,
            orderNumber: order.order_number,
            orderItemId: item.id,
            registrationId: null,
            userId,
            userName: userData.userName,
            total: item.total || 0,
            createdAt: item.created_at || order.created_at,
            details: 'Paid event registration order item has no event_registration_id link',
          });
          summary.totalMissingRegistrations++;
        }
      }

      // Check special event items
      if (itemTypeLower.includes('special_event') || itemTypeLower.includes('banquet') || itemTypeLower.includes('dinner')) {
        if (item.special_event_registration_id) {
          linkedSpecialEventRegIds.add(item.special_event_registration_id);
          if (!specialEventRegIds.has(item.special_event_registration_id)) {
            userData.issues.push({
              issueType: 'missing_registration',
              itemType: 'special_event',
              itemName: item.item_name,
              orderId: order.id,
              orderNumber: order.order_number,
              orderItemId: item.id,
              registrationId: item.special_event_registration_id,
              userId,
              userName: userData.userName,
              total: item.total || 0,
              createdAt: item.created_at || order.created_at,
              details: `Order item references special_event_registration_id ${item.special_event_registration_id} but registration not found`,
            });
            summary.totalMissingRegistrations++;
          }
        } else {
          userData.issues.push({
            issueType: 'missing_registration',
            itemType: 'special_event',
            itemName: item.item_name,
            orderId: order.id,
            orderNumber: order.order_number,
            orderItemId: item.id,
            registrationId: null,
            userId,
            userName: userData.userName,
            total: item.total || 0,
            createdAt: item.created_at || order.created_at,
            details: 'Paid special event order item has no special_event_registration_id link',
          });
          summary.totalMissingRegistrations++;
        }
      }

      // Check addon items
      if (itemTypeLower.includes('addon') || itemTypeLower.includes('merchandise') || itemTypeLower.includes('apparel')) {
        if (!item.addon_id) {
          userData.issues.push({
            issueType: 'missing_addon_link',
            itemType: 'addon',
            itemName: item.item_name,
            orderId: order.id,
            orderNumber: order.order_number,
            orderItemId: item.id,
            registrationId: null,
            userId,
            userName: userData.userName,
            total: item.total || 0,
            createdAt: item.created_at || order.created_at,
            details: 'Paid add-on order item has no addon_id link',
          });
          summary.totalMissingAddonLinks++;
        }
      }
    }

    // =====================================================
    // STEP 4: Check for orphaned registrations
    // =====================================================

    // Check tournament registrations
    for (const reg of tournamentRegs) {
      if (reg.payment_status === 'paid' && !linkedTournamentRegIds.has(reg.id)) {
        const userData = userDataMap.get(reg.user_id);
        if (userData) {
          const tournament = reg.tournaments as { name?: string } | null;
          userData.issues.push({
            issueType: 'orphaned_registration',
            itemType: 'tournament',
            itemName: tournament?.name || 'Unknown Tournament',
            orderId: reg.order_id,
            orderNumber: null,
            orderItemId: null,
            registrationId: reg.id,
            userId: reg.user_id,
            userName: userData.userName,
            total: 0,
            createdAt: reg.registered_at || '',
            details: 'Paid tournament registration exists but no order_item links to it',
          });
          summary.totalOrphanedRegistrations++;
        }
      }
    }

    // Check activity registrations
    for (const reg of activityRegs) {
      if (reg.payment_status === 'paid' && !linkedActivityRegIds.has(reg.id)) {
        const userData = userDataMap.get(reg.user_id);
        if (userData) {
          const activity = reg.activities as { title?: string } | null;
          userData.issues.push({
            issueType: 'orphaned_registration',
            itemType: 'activity',
            itemName: activity?.title || 'Unknown Activity',
            orderId: reg.order_id,
            orderNumber: null,
            orderItemId: null,
            registrationId: reg.id,
            userId: reg.user_id,
            userName: userData.userName,
            total: 0,
            createdAt: reg.registered_at || '',
            details: 'Paid activity registration exists but no order_item links to it',
          });
          summary.totalOrphanedRegistrations++;
        }
      }
    }

    // Check event registrations
    for (const reg of eventRegs) {
      if (reg.payment_status === 'completed' && !linkedEventRegIds.has(reg.id)) {
        const userData = userDataMap.get(reg.user_id);
        if (userData) {
          userData.issues.push({
            issueType: 'orphaned_registration',
            itemType: 'event_registration',
            itemName: `Event Registration ${reg.event_year}`,
            orderId: null,
            orderNumber: null,
            orderItemId: null,
            registrationId: reg.id,
            userId: reg.user_id,
            userName: userData.userName,
            total: 0,
            createdAt: reg.created_at || '',
            details: 'Completed event registration exists but no order_item links to it',
          });
          summary.totalOrphanedRegistrations++;
        }
      }
    }

    // Check special event registrations
    for (const reg of specialEventRegs) {
      if (reg.payment_status === 'paid' && !linkedSpecialEventRegIds.has(reg.id)) {
        const userData = userDataMap.get(reg.user_id);
        if (userData) {
          const specialEvent = reg.special_events as { title?: string } | null;
          userData.issues.push({
            issueType: 'orphaned_registration',
            itemType: 'special_event',
            itemName: specialEvent?.title || 'Unknown Special Event',
            orderId: reg.order_id,
            orderNumber: null,
            orderItemId: null,
            registrationId: reg.id,
            userId: reg.user_id,
            userName: userData.userName,
            total: 0,
            createdAt: reg.registered_at || '',
            details: 'Paid special event registration exists but no order_item links to it',
          });
          summary.totalOrphanedRegistrations++;
        }
      }
    }

    // =====================================================
    // STEP 5: Compile final results - return ALL users
    // =====================================================
    summary.totalUsersChecked = allUserIds.length;

    // Convert map to array and mark users with issues
    const allUsers: UserSyncResult[] = [];
    for (const [, userData] of userDataMap) {
      userData.hasIssues = userData.issues.length > 0;
      if (userData.hasIssues) {
        summary.totalUsersWithIssues++;
      }
      allUsers.push(userData);
    }

    // Sort: users with issues first (by issue count), then others by name
    allUsers.sort((a, b) => {
      if (a.hasIssues && !b.hasIssues) return -1;
      if (!a.hasIssues && b.hasIssues) return 1;
      if (a.hasIssues && b.hasIssues) {
        return b.issues.length - a.issues.length;
      }
      return a.userName.localeCompare(b.userName);
    });

    summary.users = allUsers;

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in verify-registration-sync:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
