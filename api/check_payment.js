import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('id', { ascending: false })
    .limit(1);

  if (error || data.length === 0) {
    return res.status(200).json({ paid: false });
  }

  res.status(200).json({
    paid: data[0].paid,
    amount: data[0].amount,
    desc: data[0].desc
  });
}
