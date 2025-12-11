import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created: number;
  metadata: Record<string, string>;
  address: {
    city: string | null;
    country: string | null;
    line1: string | null;
    line2: string | null;
    postal_code: string | null;
    state: string | null;
  } | null;
  defaultPaymentMethod: string | null;
  balance: number;
  currency: string | null;
  delinquent: boolean;
  invoicePrefix: string | null;
  totalSpent: number;
  paymentCount: number;
}

interface ListCustomersResponse {
  customers: StripeCustomer[];
  hasMore: boolean;
  totalCount: number;
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

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { limit = 50, startingAfter, email } = await req.json().catch(() => ({}));

    // Build query params - limit to 25 to reduce API calls
    const params: Stripe.CustomerListParams = {
      limit: Math.min(limit, 25),
      expand: ['data.default_source'],
    };

    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    if (email) {
      params.email = email;
    }

    // Fetch customers from Stripe
    const customersResponse = await stripe.customers.list(params);

    // Process customers in batches of 5 to avoid rate limiting
    const customers: StripeCustomer[] = await processInBatches(
      customersResponse.data,
      5,
      async (customer: Stripe.Customer) => {
        // Get payment intents to calculate total spent
        let totalSpent = 0;
        let paymentCount = 0;

        try {
          const payments = await stripe.paymentIntents.list({
            customer: customer.id,
            limit: 100,
          });

          for (const payment of payments.data) {
            if (payment.status === 'succeeded') {
              totalSpent += payment.amount;
              paymentCount++;
            }
          }
        } catch {
          // Ignore errors fetching payment data
        }

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          created: customer.created,
          metadata: customer.metadata || {},
          address: customer.address ? {
            city: customer.address.city,
            country: customer.address.country,
            line1: customer.address.line1,
            line2: customer.address.line2,
            postal_code: customer.address.postal_code,
            state: customer.address.state,
          } : null,
          defaultPaymentMethod: typeof customer.default_source === 'string'
            ? customer.default_source
            : customer.default_source?.id || null,
          balance: customer.balance || 0,
          currency: customer.currency,
          delinquent: customer.delinquent || false,
          invoicePrefix: customer.invoice_prefix,
          totalSpent,
          paymentCount,
        };
      }
    );

    const response: ListCustomersResponse = {
      customers,
      hasMore: customersResponse.has_more,
      totalCount: customers.length,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in list-stripe-customers:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
