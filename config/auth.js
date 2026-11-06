const secret = process.env.JWT_SECRET;
if (!secret || secret === 'CHANGE_THIS_TO_YOUR_STRONG_RANDOM_SECRET' || secret.length < 32) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters');
}
module.exports = { secret };
