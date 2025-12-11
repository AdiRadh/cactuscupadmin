import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefundRequest {
  paymentIntentId?: string;
  orderId?: string;
  amount?: number; // Optional: partial refund amount in cents. If not provided, full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: string;
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

    // Get the JWT token from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Check if user has admin role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      throw new Error('User role not found');
    }

    const roleName = (userRole.roles as { name: string })?.name;
    if (roleName !== 'admin' && roleName !== 'super_admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { paymentIntentId, orderId, amount, reason }: RefundRequest = await req.json();

    let targetPaymentIntentId = paymentIntentId;

    // If orderId is provided, look up the payment intent
    if (!targetPaymentIntentId && orderId) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('stripe_payment_intent_id, stripe_session_id')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
      }

      if (order.stripe_payment_intent_id) {
        targetPaymentIntentId = order.stripe_payment_intent_id;
      } else if (order.stripe_session_id) {
        // Retrieve the session to get the payment intent
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        if (session.payment_intent) {
          targetPaymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id;
        }
      }
    }

    if (!targetPaymentIntentId) {
      throw new Error('No payment intent found for refund');
    }

    // Create the refund
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: targetPaymentIntentId,
      reason: reason || 'requested_by_customer',
    };

    // If amount is specified, do a partial refund
    if (amount && amount > 0) {
      refundParams.amount = amount;
    }

    const refund = await stripe.refunds.create(refundParams);

    const result: RefundResult = {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    };

    // Log the refund action for audit purposes
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'refund_created',
      resource_type: 'payment',
      resource_id: targetPaymentIntentId,
      details: {
        refund_id: refund.id,
        amount: refund.amount,
        reason: reason || 'requested_by_customer',
        order_id: orderId,
      },
      created_at: new Date().toISOString(),
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to create audit log:', err);
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin-refund-payment:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
