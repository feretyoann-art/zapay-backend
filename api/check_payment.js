import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const data = await kv.get("payment");

  res.status(200).json({
    paid: data?.paid || false,
    amount: data?.amount || null,
    desc: data?.desc || null
  });
}
