import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StripeLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId: string | null;
}

interface StripeTransaction {
  id: string;
  sessionId: string | null;
  paymentIntentId: string | null;
  amount: number;
  status: string;
  created: number;
  lineItems: StripeLineItem[];
}

interface StripeCustomerWithTransactions {
  customerId: string;
  email: string;
  name: string | null;
  transactions: StripeTransaction[];
  totalSpent: number;
}

interface SupabaseOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemType: string;
  orderId: string;
  orderNumber: string;
}

interface SupabaseUserWithOrders {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  orderItems: SupabaseOrderItem[];
  totalSpent: number;
}

interface ItemDiscrepancy {
  itemName: string;
  stripeQuantity: number;
  stripeTotal: number;
  supabaseQuantity: number;
  supabaseTotal: number;
  status: 'missing_in_supabase' | 'missing_in_stripe' | 'quantity_mismatch' | 'amount_mismatch';
}

interface UserReconciliation {
  email: string;
  stripeCustomerId: string | null;
  supabaseUserId: string | null;
  stripeName: string | null;
  supabaseName: string | null;
  stripeTotal: number;
  supabaseTotal: number;
  totalDifference: number;
  stripeItemCount: number;
  supabaseItemCount: number;
  discrepancies: ItemDiscrepancy[];
  hasIssues: boolean;
}

interface ReconciliationSummary {
  totalStripeCustomers: number;
  totalSupabaseUsers: number;
  totalMatchedEmails: number;
  usersWithDiscrepancies: number;
  totalStripePurchases: number;
  totalSupabasePurchases: number;
  totalStripeAmount: number;
  totalSupabaseAmount: number;
  amountDifference: number;
  users: UserReconciliation[];
}

// Helper to process items in batches with concurrency limit
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
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

    // Parse optional filters from request
    const { emailFilter } = await req.json().catch(() => ({}));

    // ========================================
    // STEP 1: Fetch all Stripe customers with transactions
    // ========================================
    const stripeCustomerMap = new Map<string, StripeCustomerWithTransactions>();

    // Fetch all customers from Stripe (paginated)
    let hasMoreCustomers = true;
    let customerCursor: string | undefined;

    while (hasMoreCustomers) {
      const customersParams: Stripe.CustomerListParams = {
        limit: 100,
      };
      if (customerCursor) {
        customersParams.starting_after = customerCursor;
      }
      if (emailFilter) {
        customersParams.email = emailFilter;
      }

      const customersResponse = await stripe.customers.list(customersParams);

      // Process each customer to get their transactions
      await processInBatches(customersResponse.data, 5, async (customer: Stripe.Customer) => {
        if (!customer.email) return;

        const email = customer.email.toLowerCase();
        const transactions: StripeTransaction[] = [];
        let totalSpent = 0;

        // Get checkout sessions for this customer
        try {
          const sessions = await stripe.checkout.sessions.list({
            customer: customer.id,
            limit: 100,
            expand: ['data.line_items.data.price.product'],
          });

          for (const session of sessions.data) {
            if (session.payment_status !== 'paid') continue;

            const lineItems: StripeLineItem[] = [];

            if (session.line_items?.data) {
              for (const lineItem of session.line_items.data) {
                const product = lineItem.price?.product as Stripe.Product | undefined;
                lineItems.push({
                  name: product?.name || lineItem.description || 'Unknown Item',
                  quantity: lineItem.quantity || 1,
                  unitPrice: lineItem.price?.unit_amount || 0,
                  total: lineItem.amount_total || 0,
                  productId: product?.id || null,
                });
              }
            }

            transactions.push({
              id: session.id,
              sessionId: session.id,
              paymentIntentId: typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id || null,
              amount: session.amount_total || 0,
              status: session.payment_status,
              created: session.created,
              lineItems,
            });

            totalSpent += session.amount_total || 0;
          }
        } catch (err) {
          console.error(`Error fetching sessions for customer ${customer.id}:`, err);
        }

        // Also check for payment intents not tied to checkout sessions
        try {
          const paymentIntents = await stripe.paymentIntents.list({
            customer: customer.id,
            limit: 100,
          });

          for (const pi of paymentIntents.data) {
            if (pi.status !== 'succeeded') continue;

            // Skip if we already have this from a checkout session
            const existingSession = transactions.find(t => t.paymentIntentId === pi.id);
            if (existingSession) continue;

            // Payment intent without checkout session - single line item
            transactions.push({
              id: pi.id,
              sessionId: null,
              paymentIntentId: pi.id,
              amount: pi.amount,
              status: pi.status,
              created: pi.created,
              lineItems: [{
                name: pi.description || 'Payment',
                quantity: 1,
                unitPrice: pi.amount,
                total: pi.amount,
                productId: null,
              }],
            });

            totalSpent += pi.amount;
          }
        } catch (err) {
          console.error(`Error fetching payment intents for customer ${customer.id}:`, err);
        }

        if (transactions.length > 0) {
          // Merge with existing customer data if same email
          const existing = stripeCustomerMap.get(email);
          if (existing) {
            existing.transactions.push(...transactions);
            existing.totalSpent += totalSpent;
          } else {
            stripeCustomerMap.set(email, {
              customerId: customer.id,
              email,
              name: customer.name,
              transactions,
              totalSpent,
            });
          }
        }
      });

      hasMoreCustomers = customersResponse.has_more;
      if (customersResponse.data.length > 0) {
        customerCursor = customersResponse.data[customersResponse.data.length - 1].id;
      }
    }

    // ========================================
    // STEP 2: Fetch all Supabase users with orders
    // ========================================
    const supabaseUserMap = new Map<string, SupabaseUserWithOrders>();

    // Get all users from auth (via profiles join)
    let usersQuery = supabase
      .from('profiles')
      .select('id, first_name, last_name');

    const { data: profiles, error: profilesError } = await usersQuery;

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    // Get user emails from auth.users table via RPC or direct query
    const userIds = (profiles || []).map(p => p.id);

    // Get emails for users - need to use auth admin API
    const userEmailMap = new Map<string, string>();

    // Fetch emails by querying orders which have the user's email in stripe_customer_id lookup
    // Alternative: We'll get emails from orders where we can correlate
    const { data: ordersWithEmail, error: ordersEmailError } = await supabase
      .from('orders')
      .select('user_id, stripe_customer_id')
      .not('stripe_customer_id', 'is', null);

    if (!ordersEmailError && ordersWithEmail) {
      // Get unique customer IDs and look them up in Stripe
      const stripeCustomerIds = [...new Set(ordersWithEmail.map(o => o.stripe_customer_id).filter(Boolean))];

      await processInBatches(stripeCustomerIds, 10, async (customerId: string) => {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted && customer.email) {
            const order = ordersWithEmail.find(o => o.stripe_customer_id === customerId);
            if (order) {
              userEmailMap.set(order.user_id, customer.email.toLowerCase());
            }
          }
        } catch {
          // Ignore errors for individual customer lookups
        }
      });
    }

    // Get all orders with items
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        order_number,
        total,
        payment_status,
        stripe_customer_id
      `)
      .eq('payment_status', 'paid');

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    // Get all order items
    const orderIds = (orders || []).map(o => o.id);
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id, item_name, item_type, quantity, unit_price, total')
      .in('order_id', orderIds);

    if (itemsError) {
      throw new Error(`Failed to fetch order items: ${itemsError.message}`);
    }

    // Build order items map
    const orderItemsMap = new Map<string, typeof orderItems>();
    for (const item of orderItems || []) {
      const items = orderItemsMap.get(item.order_id) || [];
      items.push(item);
      orderItemsMap.set(item.order_id, items);
    }

    // Build Supabase user map
    for (const order of orders || []) {
      const email = userEmailMap.get(order.user_id);
      if (!email) continue;

      const profile = profiles?.find(p => p.id === order.user_id);
      const items = orderItemsMap.get(order.id) || [];

      const supabaseItems: SupabaseOrderItem[] = items.map(item => ({
        name: item.item_name,
        quantity: item.quantity || 1,
        unitPrice: item.unit_price || 0,
        total: item.total || 0,
        itemType: item.item_type,
        orderId: order.id,
        orderNumber: order.order_number,
      }));

      const existing = supabaseUserMap.get(email);
      if (existing) {
        existing.orderItems.push(...supabaseItems);
        existing.totalSpent += order.total || 0;
      } else {
        supabaseUserMap.set(email, {
          userId: order.user_id,
          email,
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          orderItems: supabaseItems,
          totalSpent: order.total || 0,
        });
      }
    }

    // ========================================
    // STEP 3: Reconcile by email
    // ========================================
    const allEmails = new Set([...stripeCustomerMap.keys(), ...supabaseUserMap.keys()]);
    const userReconciliations: UserReconciliation[] = [];

    let totalStripePurchases = 0;
    let totalSupabasePurchases = 0;
    let usersWithDiscrepancies = 0;

    for (const email of allEmails) {
      const stripeData = stripeCustomerMap.get(email);
      const supabaseData = supabaseUserMap.get(email);

      // Aggregate Stripe items by name (normalized)
      const stripeItemsAgg = new Map<string, { quantity: number; total: number }>();
      if (stripeData) {
        for (const transaction of stripeData.transactions) {
          for (const item of transaction.lineItems) {
            const normalizedName = item.name.toLowerCase().trim();
            const existing = stripeItemsAgg.get(normalizedName) || { quantity: 0, total: 0 };
            existing.quantity += item.quantity;
            existing.total += item.total;
            stripeItemsAgg.set(normalizedName, existing);
          }
        }
      }

      // Aggregate Supabase items by name (normalized)
      const supabaseItemsAgg = new Map<string, { quantity: number; total: number }>();
      if (supabaseData) {
        for (const item of supabaseData.orderItems) {
          const normalizedName = item.name.toLowerCase().trim();
          const existing = supabaseItemsAgg.get(normalizedName) || { quantity: 0, total: 0 };
          existing.quantity += item.quantity;
          existing.total += item.total;
          supabaseItemsAgg.set(normalizedName, existing);
        }
      }

      // Find discrepancies
      const discrepancies: ItemDiscrepancy[] = [];
      const allItemNames = new Set([...stripeItemsAgg.keys(), ...supabaseItemsAgg.keys()]);

      for (const itemName of allItemNames) {
        const stripeItem = stripeItemsAgg.get(itemName);
        const supabaseItem = supabaseItemsAgg.get(itemName);

        if (stripeItem && !supabaseItem) {
          // In Stripe but not in Supabase
          discrepancies.push({
            itemName,
            stripeQuantity: stripeItem.quantity,
            stripeTotal: stripeItem.total,
            supabaseQuantity: 0,
            supabaseTotal: 0,
            status: 'missing_in_supabase',
          });
        } else if (!stripeItem && supabaseItem) {
          // In Supabase but not in Stripe
          discrepancies.push({
            itemName,
            stripeQuantity: 0,
            stripeTotal: 0,
            supabaseQuantity: supabaseItem.quantity,
            supabaseTotal: supabaseItem.total,
            status: 'missing_in_stripe',
          });
        } else if (stripeItem && supabaseItem) {
          // Both exist - check for mismatches
          if (stripeItem.quantity !== supabaseItem.quantity) {
            discrepancies.push({
              itemName,
              stripeQuantity: stripeItem.quantity,
              stripeTotal: stripeItem.total,
              supabaseQuantity: supabaseItem.quantity,
              supabaseTotal: supabaseItem.total,
              status: 'quantity_mismatch',
            });
          } else if (Math.abs(stripeItem.total - supabaseItem.total) > 1) {
            // Allow 1 cent tolerance for rounding
            discrepancies.push({
              itemName,
              stripeQuantity: stripeItem.quantity,
              stripeTotal: stripeItem.total,
              supabaseQuantity: supabaseItem.quantity,
              supabaseTotal: supabaseItem.total,
              status: 'amount_mismatch',
            });
          }
        }
      }

      const stripeTotal = stripeData?.totalSpent || 0;
      const supabaseTotal = supabaseData?.totalSpent || 0;
      const stripeItemCount = Array.from(stripeItemsAgg.values()).reduce((sum, i) => sum + i.quantity, 0);
      const supabaseItemCount = Array.from(supabaseItemsAgg.values()).reduce((sum, i) => sum + i.quantity, 0);

      totalStripePurchases += stripeItemCount;
      totalSupabasePurchases += supabaseItemCount;

      const hasIssues = discrepancies.length > 0 || Math.abs(stripeTotal - supabaseTotal) > 1;
      if (hasIssues) {
        usersWithDiscrepancies++;
      }

      // Only include users with issues in detailed results to reduce payload
      if (hasIssues) {
        userReconciliations.push({
          email,
          stripeCustomerId: stripeData?.customerId || null,
          supabaseUserId: supabaseData?.userId || null,
          stripeName: stripeData?.name || null,
          supabaseName: supabaseData
            ? [supabaseData.firstName, supabaseData.lastName].filter(Boolean).join(' ') || null
            : null,
          stripeTotal,
          supabaseTotal,
          totalDifference: stripeTotal - supabaseTotal,
          stripeItemCount,
          supabaseItemCount,
          discrepancies,
          hasIssues,
        });
      }
    }

    // Sort by total difference (largest first)
    userReconciliations.sort((a, b) => Math.abs(b.totalDifference) - Math.abs(a.totalDifference));

    const summary: ReconciliationSummary = {
      totalStripeCustomers: stripeCustomerMap.size,
      totalSupabaseUsers: supabaseUserMap.size,
      totalMatchedEmails: [...allEmails].filter(e => stripeCustomerMap.has(e) && supabaseUserMap.has(e)).length,
      usersWithDiscrepancies,
      totalStripePurchases,
      totalSupabasePurchases,
      totalStripeAmount: Array.from(stripeCustomerMap.values()).reduce((sum, c) => sum + c.totalSpent, 0),
      totalSupabaseAmount: Array.from(supabaseUserMap.values()).reduce((sum, u) => sum + u.totalSpent, 0),
      amountDifference: Array.from(stripeCustomerMap.values()).reduce((sum, c) => sum + c.totalSpent, 0) -
        Array.from(supabaseUserMap.values()).reduce((sum, u) => sum + u.totalSpent, 0),
      users: userReconciliations,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in reconcile-stripe-orders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
