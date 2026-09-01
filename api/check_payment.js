import fs from 'fs';

export default function handler(req, res) {
  let paid = false;

  try {
    const raw = fs.readFileSync('/tmp/payment.json');
    const data = JSON.parse(raw);
    paid = data.paid;
  } catch (e) {
    paid = false;
  }

  res.status(200).json({ paid });
}
