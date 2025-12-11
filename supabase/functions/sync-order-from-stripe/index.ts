import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncOrderResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  itemsUpdated: number;
  itemsCreated: number;
  itemsDeleted: number;
  newTotal: number;
  error?: string;
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

    const { orderId } = await req.json();
    if (!orderId) {
      throw new Error('orderId is required');
    }

    // Fetch the order from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, user_id, stripe_session_id, stripe_payment_intent_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
    }

    if (!order.stripe_session_id && !order.stripe_payment_intent_id) {
      throw new Error('Order has no Stripe session or payment intent ID');
    }

    const result: SyncOrderResult = {
      success: false,
      orderId: order.id,
      orderNumber: order.order_number,
      itemsUpdated: 0,
      itemsCreated: 0,
      itemsDeleted: 0,
      newTotal: 0,
    };

    // Get Stripe data
    let stripeTotal = 0;
    const stripeLineItems: Array<{
      name: string;
      description: string | null;
      quantity: number;
      unitPrice: number;
      total: number;
      productId: string | null;
      priceId: string | null;
    }> = [];

    if (order.stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {
        expand: ['line_items.data.price.product'],
      });

      stripeTotal = session.amount_total || 0;

      if (session.line_items?.data) {
        for (const lineItem of session.line_items.data) {
          const product = lineItem.price?.product as Stripe.Product | undefined;
          stripeLineItems.push({
            name: product?.name || lineItem.description || 'Unknown Item',
            description: product?.description || null,
            quantity: lineItem.quantity || 1,
            unitPrice: lineItem.price?.unit_amount || 0,
            total: lineItem.amount_total || 0,
            productId: typeof lineItem.price?.product === 'string'
              ? lineItem.price.product
              : (lineItem.price?.product as Stripe.Product)?.id || null,
            priceId: lineItem.price?.id || null,
          });
        }
      }
    } else if (order.stripe_payment_intent_id) {
      const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      stripeTotal = paymentIntent.amount || 0;

      // Payment intents don't have detailed line items
      // We can only update the total, not individual items
      stripeLineItems.push({
        name: 'Payment',
        description: paymentIntent.description || null,
        quantity: 1,
        unitPrice: paymentIntent.amount || 0,
        total: paymentIntent.amount || 0,
        productId: null,
        priceId: null,
      });
    }

    // Get existing order items
    const { data: existingItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, item_name')
      .eq('order_id', orderId);

    if (itemsError) {
      throw new Error(`Failed to fetch existing items: ${itemsError.message}`);
    }

    // Delete existing order items
    if (existingItems && existingItems.length > 0) {
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (deleteError) {
        throw new Error(`Failed to delete existing items: ${deleteError.message}`);
      }
      result.itemsDeleted = existingItems.length;
    }

    // Insert new order items from Stripe
    let subtotal = 0;
    for (const item of stripeLineItems) {
      const { error: insertError } = await supabase
        .from('order_items')
        .insert({
          order_id: orderId,
          item_type: 'synced_from_stripe',
          item_name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.total,
          tax: 0, // Tax is calculated at order level
          total: item.total,
          discount_amount: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Failed to insert item:', insertError);
        // Continue with other items
      } else {
        result.itemsCreated++;
        subtotal += item.total;
      }
    }

    // Calculate tax (difference between stripe total and subtotal)
    const tax = stripeTotal - subtotal;

    // Update the order total
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        subtotal: subtotal,
        tax: tax > 0 ? tax : 0,
        total: stripeTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Failed to update order total: ${updateError.message}`);
    }

    result.success = true;
    result.newTotal = stripeTotal;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sync-order-from-stripe:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
