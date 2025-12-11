import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineItemDiagnosis {
  stripeName: string;
  stripeQuantity: number;
  stripeAmount: number;
  existsInOrderItems: boolean;
  existsInRegistrations: boolean;
  orderItemId: string | null;
  registrationId: string | null;
  registrationType: string | null;
}

interface SessionDiagnosis {
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  stripeAmount: number;
  stripeStatus: string;
  stripeCreated: string;
  existsInOrders: boolean;
  orderId: string | null;
  orderNumber: string | null;
  orderTotal: number | null;
  orderPaymentStatus: string | null;
  lineItems: LineItemDiagnosis[];
  issues: string[];
}

interface CustomerDiagnosis {
  stripeCustomerId: string;
  stripeEmail: string | null;
  stripeName: string | null;
  supabaseUserId: string | null;
  supabaseUserName: string | null;
  sessions: SessionDiagnosis[];
  totalIssues: number;
}

interface DiagnosisResult {
  searchQuery: string | null;
  customersScanned: number;
  customersWithIssues: number;
  totalSessionsWithIssues: number;
  totalMissingOrders: number;
  totalMissingLineItems: number;
  totalMissingRegistrations: number;
  customers: CustomerDiagnosis[];
}

serve(async (req) => {
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

    // Parse request body for optional filters
    const { nameFilter, emailFilter } = await req.json().catch(() => ({}));
    const searchQuery = nameFilter || emailFilter || null;

    // Build a map of all orders by stripe_session_id
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, order_number, total, payment_status, stripe_session_id, stripe_payment_intent_id, stripe_customer_id, user_id')
      .not('stripe_session_id', 'is', null);

    const ordersBySession = new Map<string, typeof allOrders[0]>();
    const ordersByCustomer = new Map<string, typeof allOrders>();
    for (const order of allOrders || []) {
      if (order.stripe_session_id) {
        ordersBySession.set(order.stripe_session_id, order);
      }
      if (order.stripe_customer_id) {
        const customerOrders = ordersByCustomer.get(order.stripe_customer_id) || [];
        customerOrders.push(order);
        ordersByCustomer.set(order.stripe_customer_id, customerOrders);
      }
    }

    // Build a map of all order_items by order_id
    const { data: allOrderItems } = await supabase
      .from('order_items')
      .select('id, order_id, item_name, quantity, total, tournament_registration_id, activity_registration_id, event_registration_id, special_event_registration_id');

    const orderItemsByOrderId = new Map<string, typeof allOrderItems>();
    for (const item of allOrderItems || []) {
      const items = orderItemsByOrderId.get(item.order_id) || [];
      items.push(item);
      orderItemsByOrderId.set(item.order_id, items);
    }

    // Build a map of tournament registrations by user_id
    const { data: allTournamentRegs } = await supabase
      .from('tournament_registrations')
      .select('id, user_id, tournament_id, tournaments(name)');

    const tournamentRegsByUser = new Map<string, typeof allTournamentRegs>();
    for (const reg of allTournamentRegs || []) {
      const regs = tournamentRegsByUser.get(reg.user_id) || [];
      regs.push(reg);
      tournamentRegsByUser.set(reg.user_id, regs);
    }

    // Get user profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name');

    const profilesById = new Map<string, typeof profiles[0]>();
    for (const profile of profiles || []) {
      profilesById.set(profile.id, profile);
    }

    // Scan Stripe customers
    const result: DiagnosisResult = {
      searchQuery,
      customersScanned: 0,
      customersWithIssues: 0,
      totalSessionsWithIssues: 0,
      totalMissingOrders: 0,
      totalMissingLineItems: 0,
      totalMissingRegistrations: 0,
      customers: [],
    };

    let hasMoreCustomers = true;
    let customerCursor: string | undefined;

    while (hasMoreCustomers) {
      const customersParams: Stripe.CustomerListParams = { limit: 100 };
      if (customerCursor) {
        customersParams.starting_after = customerCursor;
      }
      if (emailFilter) {
        customersParams.email = emailFilter;
      }

      const customersResponse = await stripe.customers.list(customersParams);
      result.customersScanned += customersResponse.data.length;

      for (const customer of customersResponse.data) {
        // Apply name filter if provided
        if (nameFilter) {
          const customerName = (customer.name || '').toLowerCase();
          const filterLower = nameFilter.toLowerCase();
          if (!customerName.includes(filterLower)) {
            continue;
          }
        }

        const customerDiagnosis: CustomerDiagnosis = {
          stripeCustomerId: customer.id,
          stripeEmail: customer.email,
          stripeName: customer.name,
          supabaseUserId: null,
          supabaseUserName: null,
          sessions: [],
          totalIssues: 0,
        };

        // Find supabase user
        const customerOrders = ordersByCustomer.get(customer.id) || [];
        if (customerOrders.length > 0) {
          const userId = customerOrders[0].user_id;
          customerDiagnosis.supabaseUserId = userId;
          const profile = profilesById.get(userId);
          if (profile) {
            customerDiagnosis.supabaseUserName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || null;
          }
        }

        // Get all checkout sessions for this customer
        try {
          const sessions = await stripe.checkout.sessions.list({
            customer: customer.id,
            limit: 100,
            expand: ['data.line_items.data.price.product'],
          });

          for (const session of sessions.data) {
            if (session.payment_status !== 'paid') continue;

            const sessionDiagnosis: SessionDiagnosis = {
              stripeSessionId: session.id,
              stripePaymentIntentId: typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id || null,
              stripeAmount: session.amount_total || 0,
              stripeStatus: session.payment_status,
              stripeCreated: new Date(session.created * 1000).toISOString(),
              existsInOrders: false,
              orderId: null,
              orderNumber: null,
              orderTotal: null,
              orderPaymentStatus: null,
              lineItems: [],
              issues: [],
            };

            // Check if session exists in orders
            const order = ordersBySession.get(session.id);
            if (order) {
              sessionDiagnosis.existsInOrders = true;
              sessionDiagnosis.orderId = order.id;
              sessionDiagnosis.orderNumber = order.order_number;
              sessionDiagnosis.orderTotal = order.total;
              sessionDiagnosis.orderPaymentStatus = order.payment_status;

              // Get order items for this order
              const orderItems = orderItemsByOrderId.get(order.id) || [];

              // Check each Stripe line item
              if (session.line_items?.data) {
                for (const lineItem of session.line_items.data) {
                  const product = lineItem.price?.product as Stripe.Product | undefined;
                  const stripeName = product?.name || lineItem.description || 'Unknown';
                  const stripeNameLower = stripeName.toLowerCase();

                  const lineItemDiagnosis: LineItemDiagnosis = {
                    stripeName,
                    stripeQuantity: lineItem.quantity || 1,
                    stripeAmount: lineItem.amount_total || 0,
                    existsInOrderItems: false,
                    existsInRegistrations: false,
                    orderItemId: null,
                    registrationId: null,
                    registrationType: null,
                  };

                  // Check if this line item exists in order_items
                  const matchingOrderItem = orderItems.find(oi => {
                    const oiNameLower = (oi.item_name || '').toLowerCase();
                    return oiNameLower === stripeNameLower ||
                      oiNameLower.includes(stripeNameLower) ||
                      stripeNameLower.includes(oiNameLower);
                  });

                  if (matchingOrderItem) {
                    lineItemDiagnosis.existsInOrderItems = true;
                    lineItemDiagnosis.orderItemId = matchingOrderItem.id;

                    // Check if it has a registration
                    if (matchingOrderItem.tournament_registration_id) {
                      lineItemDiagnosis.existsInRegistrations = true;
                      lineItemDiagnosis.registrationId = matchingOrderItem.tournament_registration_id;
                      lineItemDiagnosis.registrationType = 'tournament';
                    } else if (matchingOrderItem.activity_registration_id) {
                      lineItemDiagnosis.existsInRegistrations = true;
                      lineItemDiagnosis.registrationId = matchingOrderItem.activity_registration_id;
                      lineItemDiagnosis.registrationType = 'activity';
                    } else if (matchingOrderItem.event_registration_id) {
                      lineItemDiagnosis.existsInRegistrations = true;
                      lineItemDiagnosis.registrationId = matchingOrderItem.event_registration_id;
                      lineItemDiagnosis.registrationType = 'event';
                    } else if (matchingOrderItem.special_event_registration_id) {
                      lineItemDiagnosis.existsInRegistrations = true;
                      lineItemDiagnosis.registrationId = matchingOrderItem.special_event_registration_id;
                      lineItemDiagnosis.registrationType = 'special_event';
                    }
                  }

                  // Also check tournament_registrations directly
                  if (!lineItemDiagnosis.existsInRegistrations && order.user_id) {
                    const userTournamentRegs = tournamentRegsByUser.get(order.user_id) || [];
                    const matchingReg = userTournamentRegs.find(reg => {
                      const tournament = reg.tournaments as any;
                      const tournamentName = (tournament?.name || '').toLowerCase();
                      return tournamentName === stripeNameLower ||
                        tournamentName.includes(stripeNameLower) ||
                        stripeNameLower.includes(tournamentName);
                    });

                    if (matchingReg) {
                      lineItemDiagnosis.existsInRegistrations = true;
                      lineItemDiagnosis.registrationId = matchingReg.id;
                      lineItemDiagnosis.registrationType = 'tournament (direct)';
                    }
                  }

                  sessionDiagnosis.lineItems.push(lineItemDiagnosis);

                  // Track issues
                  if (!lineItemDiagnosis.existsInOrderItems) {
                    sessionDiagnosis.issues.push(`Line item "${stripeName}" not found in order_items`);
                    result.totalMissingLineItems++;
                  }
                  if (!lineItemDiagnosis.existsInRegistrations) {
                    // Only flag as missing registration if it looks like a tournament/activity
                    const isTournamentLike = stripeNameLower.includes('cutting') ||
                      stripeNameLower.includes('sparring') ||
                      stripeNameLower.includes('tournament') ||
                      stripeNameLower.includes('longsword') ||
                      stripeNameLower.includes('sword') ||
                      stripeNameLower.includes('rapier');
                    if (isTournamentLike) {
                      sessionDiagnosis.issues.push(`Line item "${stripeName}" has no registration`);
                      result.totalMissingRegistrations++;
                    }
                  }
                }
              }
            } else {
              // Order doesn't exist at all
              sessionDiagnosis.issues.push('Stripe session not found in Supabase orders');
              result.totalMissingOrders++;

              // Still capture line items for diagnosis
              if (session.line_items?.data) {
                for (const lineItem of session.line_items.data) {
                  const product = lineItem.price?.product as Stripe.Product | undefined;
                  sessionDiagnosis.lineItems.push({
                    stripeName: product?.name || lineItem.description || 'Unknown',
                    stripeQuantity: lineItem.quantity || 1,
                    stripeAmount: lineItem.amount_total || 0,
                    existsInOrderItems: false,
                    existsInRegistrations: false,
                    orderItemId: null,
                    registrationId: null,
                    registrationType: null,
                  });
                }
              }
            }

            // Only include sessions with issues
            if (sessionDiagnosis.issues.length > 0) {
              customerDiagnosis.sessions.push(sessionDiagnosis);
              customerDiagnosis.totalIssues += sessionDiagnosis.issues.length;
              result.totalSessionsWithIssues++;
            }
          }
        } catch (err) {
          console.error(`Error fetching sessions for customer ${customer.id}:`, err);
        }

        // Only include customers with issues
        if (customerDiagnosis.sessions.length > 0) {
          result.customers.push(customerDiagnosis);
          result.customersWithIssues++;
        }
      }

      hasMoreCustomers = customersResponse.has_more;
      if (customersResponse.data.length > 0) {
        customerCursor = customersResponse.data[customersResponse.data.length - 1].id;
      }

      // If we have a search query and found results, stop pagination
      if (searchQuery && result.customers.length > 0) {
        break;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in diagnose-stripe-sync:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
