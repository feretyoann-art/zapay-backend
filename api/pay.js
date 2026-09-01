import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { amount, desc } = req.query;

  await kv.set("payment", {
    paid: true,
    amount,
    desc
  });

  res.status(200).json({ success: true });
}
