export const config = { runtime: "nodejs" };

import fs from 'fs';

export default function handler(req, res) {
  const { amount, desc } = req.query;

  const data = {
    paid: true,
    amount,
    desc
  };

  fs.writeFileSync('/tmp/payment.json', JSON.stringify(data));

  res.status(200).json({ success: true });
}
