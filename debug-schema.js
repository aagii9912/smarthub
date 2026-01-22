
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    // Check shops columns
    const { data: row, error: rowError } = await supabase.from('shops').select('*').limit(1).single();
    if (rowError) console.error('Shops Row Error:', rowError);
    else console.log('Shops columns:', Object.keys(row));

    // Check plans table exists
    const { error: plansError } = await supabase.from('plans').select('id').limit(1);
    if (plansError) console.log('Plans table error (might be missing):', plansError.message);
    else console.log('Plans table exists');

    // Check subscriptions table exists
    const { error: subsError } = await supabase.from('subscriptions').select('id').limit(1);
    if (subsError) console.log('Subscriptions table error (might be missing):', subsError.message);
    else console.log('Subscriptions table exists');
}

checkSchema();
