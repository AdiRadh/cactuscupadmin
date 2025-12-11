import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface OrderVerificationItem {
  orderId: string;
  orderNumber: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  dbTotal: number;
  stripeTotal: number | null;
  status: 'match' | 'mismatch' | 'no_stripe_data' | 'pending' | 'error';
  dbItems: OrderItem[];
  stripeItems: OrderItem[] | null;
  errorMessage?: string;
}

interface StripeVerificationResult {
  userId: string;
  totalOrders: number;
  matchedOrders: number;
  mismatchedOrders: number;
  pendingOrders: number;
  noStripeDataOrders: number;
  errorOrders: number;
  orders: OrderVerificationItem[];
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

    const { userId } = await req.json();
    if (!userId) {
      throw new Error('userId is required');
    }

    // Fetch all orders for this user
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, total, payment_status, stripe_session_id, stripe_payment_intent_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    const result: StripeVerificationResult = {
      userId,
      totalOrders: orders?.length || 0,
      matchedOrders: 0,
      mismatchedOrders: 0,
      pendingOrders: 0,
      noStripeDataOrders: 0,
      errorOrders: 0,
      orders: [],
    };

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process each order
    for (const order of orders) {
      // Fetch order items from database
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('item_name, quantity, unit_price, total')
        .eq('order_id', order.id);

      const dbItems: OrderItem[] = (orderItems || []).map((item) => ({
        name: item.item_name,
        quantity: item.quantity || 1,
        unitPrice: item.unit_price || 0,
        total: item.total || 0,
      }));

      const verification: OrderVerificationItem = {
        orderId: order.id,
        orderNumber: order.order_number,
        stripeSessionId: order.stripe_session_id,
        stripePaymentIntentId: order.stripe_payment_intent_id,
        dbTotal: order.total || 0,
        stripeTotal: null,
        status: 'no_stripe_data',
        dbItems,
        stripeItems: null,
      };

      // Check if payment is pending
      if (order.payment_status === 'pending') {
        verification.status = 'pending';
        result.pendingOrders++;
        result.orders.push(verification);
        continue;
      }

      // Try to get Stripe data
      if (!order.stripe_session_id && !order.stripe_payment_intent_id) {
        result.noStripeDataOrders++;
        result.orders.push(verification);
        continue;
      }

      try {
        let stripeTotal = 0;
        const stripeItems: OrderItem[] = [];

        // Try to get data from checkout session first
        if (order.stripe_session_id) {
          const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {
            expand: ['line_items.data.price.product'],
          });

          stripeTotal = session.amount_total || 0;

          // Get line items
          if (session.line_items?.data) {
            for (const lineItem of session.line_items.data) {
              const product = lineItem.price?.product as Stripe.Product | undefined;
              stripeItems.push({
                name: product?.name || lineItem.description || 'Unknown Item',
                quantity: lineItem.quantity || 1,
                unitPrice: lineItem.price?.unit_amount || 0,
                total: lineItem.amount_total || 0,
              });
            }
          }
        } else if (order.stripe_payment_intent_id) {
          // Fall back to payment intent
          const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
          stripeTotal = paymentIntent.amount || 0;

          // Payment intents don't have line items, so we just compare totals
          stripeItems.push({
            name: 'Payment Total',
            quantity: 1,
            unitPrice: paymentIntent.amount || 0,
            total: paymentIntent.amount || 0,
          });
        }

        verification.stripeTotal = stripeTotal;
        verification.stripeItems = stripeItems;

        // Compare totals (allow small difference for rounding)
        const dbTotal = order.total || 0;
        const difference = Math.abs(dbTotal - stripeTotal);

        if (difference <= 1) {
          // Within 1 cent tolerance
          verification.status = 'match';
          result.matchedOrders++;
        } else {
          verification.status = 'mismatch';
          result.mismatchedOrders++;
        }
      } catch (stripeError) {
        const errorMessage = stripeError instanceof Error
          ? stripeError.message
          : 'Failed to fetch Stripe data';

        // Check if this is a "resource not found" error (payment intent or session doesn't exist)
        const isResourceMissing = errorMessage.includes('No such') ||
          errorMessage.includes('resource_missing') ||
          errorMessage.includes('does not exist');

        if (isResourceMissing) {
          // Treat missing Stripe resources as "no_stripe_data" instead of error
          verification.status = 'no_stripe_data';
          result.noStripeDataOrders++;
        } else {
          verification.status = 'error';
          verification.errorMessage = errorMessage;
          result.errorOrders++;
        }
      }

      result.orders.push(verification);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in verify-stripe-orders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
