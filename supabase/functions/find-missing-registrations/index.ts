import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MissingRegistration {
  orderId: string | null;
  orderNumber: string | null;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  orderItemId: string | null;
  itemName: string;
  itemType: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentStatus: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  source: 'supabase' | 'stripe_only';
}

interface StripeTransaction {
  id: string;
  amount: number;
  description: string | null;
  created: number;
  lineItems: Array<{
    name: string;
    quantity: number;
    amount: number;
  }>;
}

interface UserWithMissingRegistrations {
  oderId: string | null;
  userName: string;
  userEmail: string | null;
  stripeCustomerId: string | null;
  missingRegistrations: MissingRegistration[];
  stripeTransactions: StripeTransaction[];
}

interface Summary {
  totalUsersAffected: number;
  totalMissingRegistrations: number;
  users: UserWithMissingRegistrations[];
}

// Keywords that indicate tournament/registration items
const TOURNAMENT_KEYWORDS = [
  'cutting', 'sparring', 'longsword', 'sword', 'rapier', 'saber', 'sabre',
  'tournament', 'hema', 'fencing', 'dagger', 'messer', 'pole', 'staff'
];

function isTournamentItem(itemName: string): boolean {
  const nameLower = itemName.toLowerCase();
  return TOURNAMENT_KEYWORDS.some(keyword => nameLower.includes(keyword));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Map to collect users with issues
    const userMap = new Map<string, UserWithMissingRegistrations>();

    // =====================================================
    // APPROACH 1: Check Supabase order_items for missing registration links
    // =====================================================
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        item_name,
        item_type,
        quantity,
        unit_price,
        total,
        tournament_registration_id,
        activity_registration_id,
        event_registration_id,
        special_event_registration_id,
        orders!inner (
          id,
          order_number,
          user_id,
          payment_status,
          stripe_session_id,
          stripe_payment_intent_id,
          stripe_customer_id,
          created_at
        )
      `)
      .eq('orders.payment_status', 'paid');

    if (itemsError) {
      throw new Error(`Failed to fetch order items: ${itemsError.message}`);
    }

    // Get all user IDs for profile lookup
    const allUserIds = new Set<string>();

    for (const item of orderItems || []) {
      const order = item.orders as any;
      const itemTypeLower = (item.item_type || '').toLowerCase();
      const itemNameLower = (item.item_name || '').toLowerCase();

      let shouldHaveRegistration = false;
      let hasMissingRegistration = false;

      // Tournament items
      if (itemTypeLower.includes('tournament') || isTournamentItem(item.item_name || '')) {
        shouldHaveRegistration = true;
        if (!item.tournament_registration_id) {
          hasMissingRegistration = true;
        }
      }

      // Activity items
      if (itemTypeLower.includes('activity') || itemTypeLower.includes('class') || itemTypeLower.includes('workshop')) {
        shouldHaveRegistration = true;
        if (!item.activity_registration_id) {
          hasMissingRegistration = true;
        }
      }

      // Event items
      if (itemTypeLower.includes('event') && !itemTypeLower.includes('special')) {
        shouldHaveRegistration = true;
        if (!item.event_registration_id) {
          hasMissingRegistration = true;
        }
      }

      // Special event items
      if (itemTypeLower.includes('special_event') || itemTypeLower.includes('special event')) {
        shouldHaveRegistration = true;
        if (!item.special_event_registration_id) {
          hasMissingRegistration = true;
        }
      }

      if (shouldHaveRegistration && hasMissingRegistration) {
        allUserIds.add(order.user_id);
        const key = order.user_id;

        if (!userMap.has(key)) {
          userMap.set(key, {
            oderId: order.user_id,
            userName: '',
            userEmail: null,
            stripeCustomerId: order.stripe_customer_id || null,
            missingRegistrations: [],
            stripeTransactions: [],
          });
        }

        userMap.get(key)!.missingRegistrations.push({
          orderId: order.id,
          orderNumber: order.order_number,
          userId: order.user_id,
          userName: '',
          userEmail: null,
          orderItemId: item.id,
          itemName: item.item_name,
          itemType: item.item_type || 'unknown',
          quantity: item.quantity || 1,
          unitPrice: item.unit_price || 0,
          total: item.total || 0,
          paymentStatus: order.payment_status,
          stripeSessionId: order.stripe_session_id,
          stripePaymentIntentId: order.stripe_payment_intent_id,
          createdAt: order.created_at,
          source: 'supabase',
        });
      }
    }

    // =====================================================
    // APPROACH 2: Check Stripe transactions for items not in Supabase
    // =====================================================

    // Get all order_items item names for comparison
    const { data: allOrderItems } = await supabase
      .from('order_items')
      .select('item_name, orders!inner(stripe_session_id, stripe_customer_id)')
      .eq('orders.payment_status', 'paid');

    const supabaseItemsBySession = new Map<string, Set<string>>();
    const supabaseItemsByCustomer = new Map<string, Set<string>>();

    for (const item of allOrderItems || []) {
      const order = item.orders as any;
      const itemNameLower = (item.item_name || '').toLowerCase();

      if (order.stripe_session_id) {
        if (!supabaseItemsBySession.has(order.stripe_session_id)) {
          supabaseItemsBySession.set(order.stripe_session_id, new Set());
        }
        supabaseItemsBySession.get(order.stripe_session_id)!.add(itemNameLower);
      }

      if (order.stripe_customer_id) {
        if (!supabaseItemsByCustomer.has(order.stripe_customer_id)) {
          supabaseItemsByCustomer.set(order.stripe_customer_id, new Set());
        }
        supabaseItemsByCustomer.get(order.stripe_customer_id)!.add(itemNameLower);
      }
    }

    // Get all tournament registrations to check against
    const { data: tournamentRegs } = await supabase
      .from('tournament_registrations')
      .select('user_id, tournaments(name)');

    const userTournamentNames = new Map<string, Set<string>>();
    for (const reg of tournamentRegs || []) {
      const tournament = reg.tournaments as any;
      if (tournament?.name) {
        if (!userTournamentNames.has(reg.user_id)) {
          userTournamentNames.set(reg.user_id, new Set());
        }
        userTournamentNames.get(reg.user_id)!.add(tournament.name.toLowerCase());
      }
    }

    // Fetch all Stripe customers and check their transactions
    let hasMoreCustomers = true;
    let customerCursor: string | undefined;

    while (hasMoreCustomers) {
      const customersParams: Stripe.CustomerListParams = { limit: 100 };
      if (customerCursor) {
        customersParams.starting_after = customerCursor;
      }

      const customersResponse = await stripe.customers.list(customersParams);

      for (const customer of customersResponse.data) {
        if (!customer.email) continue;

        // Get checkout sessions for this customer
        try {
          const sessions = await stripe.checkout.sessions.list({
            customer: customer.id,
            limit: 100,
            expand: ['data.line_items.data.price.product'],
          });

          for (const session of sessions.data) {
            if (session.payment_status !== 'paid') continue;

            const sessionItemsInSupabase = supabaseItemsBySession.get(session.id) || new Set();
            const customerItemsInSupabase = supabaseItemsByCustomer.get(customer.id) || new Set();

            if (session.line_items?.data) {
              for (const lineItem of session.line_items.data) {
                const product = lineItem.price?.product as Stripe.Product | undefined;
                const itemName = product?.name || lineItem.description || 'Unknown Item';
                const itemNameLower = itemName.toLowerCase();

                // Only check tournament-related items
                if (!isTournamentItem(itemName)) continue;

                // Check if this item exists in Supabase
                const existsInSupabase = sessionItemsInSupabase.has(itemNameLower) ||
                  customerItemsInSupabase.has(itemNameLower) ||
                  // Also check for partial matches
                  Array.from(sessionItemsInSupabase).some(name => itemNameLower.includes(name) || name.includes(itemNameLower)) ||
                  Array.from(customerItemsInSupabase).some(name => itemNameLower.includes(name) || name.includes(itemNameLower));

                if (!existsInSupabase) {
                  // Find the user in Supabase by email or stripe_customer_id
                  const { data: userByStripe } = await supabase
                    .from('orders')
                    .select('user_id')
                    .eq('stripe_customer_id', customer.id)
                    .limit(1)
                    .single();

                  const userId = userByStripe?.user_id || null;
                  const key = customer.email.toLowerCase();

                  // Check if user has this tournament registered
                  if (userId) {
                    const userRegs = userTournamentNames.get(userId) || new Set();
                    const hasRegistration = Array.from(userRegs).some(regName =>
                      itemNameLower.includes(regName) || regName.includes(itemNameLower)
                    );
                    if (hasRegistration) continue; // Skip - they have the registration
                  }

                  if (!userMap.has(key)) {
                    userMap.set(key, {
                      oderId: userId,
                      userName: customer.name || 'Unknown',
                      userEmail: customer.email,
                      stripeCustomerId: customer.id,
                      missingRegistrations: [],
                      stripeTransactions: [],
                    });
                  }

                  const userData = userMap.get(key)!;
                  userData.userName = customer.name || userData.userName;
                  userData.userEmail = customer.email;

                  // Check if we already added this item
                  const alreadyAdded = userData.missingRegistrations.some(
                    m => m.itemName.toLowerCase() === itemNameLower && m.stripeSessionId === session.id
                  );

                  if (!alreadyAdded) {
                    userData.missingRegistrations.push({
                      orderId: null,
                      orderNumber: null,
                      userId,
                      userName: customer.name || 'Unknown',
                      userEmail: customer.email,
                      orderItemId: null,
                      itemName,
                      itemType: 'stripe_transaction',
                      quantity: lineItem.quantity || 1,
                      unitPrice: lineItem.price?.unit_amount || 0,
                      total: lineItem.amount_total || 0,
                      paymentStatus: 'paid',
                      stripeSessionId: session.id,
                      stripePaymentIntentId: typeof session.payment_intent === 'string'
                        ? session.payment_intent
                        : session.payment_intent?.id || null,
                      createdAt: new Date(session.created * 1000).toISOString(),
                      source: 'stripe_only',
                    });
                  }

                  // Add transaction info
                  const txExists = userData.stripeTransactions.some(t => t.id === session.id);
                  if (!txExists) {
                    userData.stripeTransactions.push({
                      id: session.id,
                      amount: session.amount_total || 0,
                      description: null,
                      created: session.created,
                      lineItems: session.line_items.data.map(li => {
                        const prod = li.price?.product as Stripe.Product | undefined;
                        return {
                          name: prod?.name || li.description || 'Unknown',
                          quantity: li.quantity || 1,
                          amount: li.amount_total || 0,
                        };
                      }),
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error fetching sessions for customer ${customer.id}:`, err);
        }
      }

      hasMoreCustomers = customersResponse.has_more;
      if (customersResponse.data.length > 0) {
        customerCursor = customersResponse.data[customersResponse.data.length - 1].id;
      }
    }

    // =====================================================
    // Fill in user profile names for Supabase-found issues
    // =====================================================
    if (allUserIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', Array.from(allUserIds));

      for (const profile of profiles || []) {
        const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
        for (const [key, userData] of userMap) {
          if (userData.oderId === profile.id) {
            userData.userName = userName;
            for (const reg of userData.missingRegistrations) {
              if (reg.userId === profile.id) {
                reg.userName = userName;
              }
            }
          }
        }
      }
    }

    // Filter out users with no missing registrations
    const usersWithIssues = Array.from(userMap.values()).filter(u => u.missingRegistrations.length > 0);

    const summary: Summary = {
      totalUsersAffected: usersWithIssues.length,
      totalMissingRegistrations: usersWithIssues.reduce((sum, u) => sum + u.missingRegistrations.length, 0),
      users: usersWithIssues,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in find-missing-registrations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
