export default function handler(req, res) {
  const amount = req.query.amount;
  const desc = req.query.desc;

  const key = amount + "_" + desc;

  // Stockage en mémoire (Vercel redémarre à chaque appel)
  const paid = globalThis[key] === true;

  res.status(200).json({ paid });
}
