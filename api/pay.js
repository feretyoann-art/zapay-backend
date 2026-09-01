import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { amount, desc } = req.query;

  const { error } = await supabase
    .from('payments')
    .insert({
      paid: true,
      amount,
      desc
    });

  if (error) {
    return res.status(500).json({ success: false, error });
  }

  res.status(200).json({ success: true });
}
