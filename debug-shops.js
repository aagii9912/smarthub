
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkShops() {
    const { count, error } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Total shops:', count);
    }

    // Also check if we can select specific columns
    const { data, error: selectError } = await supabase
        .from('shops')
        .select('id, name, is_active')
        .limit(5);

    if (selectError) {
        console.error('Select Error:', selectError);
    } else {
        console.log('Sample shops:', data);
    }
}

checkShops();
