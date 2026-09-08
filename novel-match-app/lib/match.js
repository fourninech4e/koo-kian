// lib/match.js
// วิเคราะห์ "ลายมือการเขียน" แบบง่าย ๆ จากตัวอย่างงานเขียน แล้วให้คะแนนความเข้ากันได้

function splitSentences(text) {
  return text
    .split(/[\n.!?ๆฯ]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitWords(text) {
  return text
    .replace(/[.,!?"'“”‘’()\[\]{}ๆฯ]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function analyzeSample(text) {
  const clean = (text || '').trim();
  if (!clean) {
    return { avgSentenceLen: 0, avgWordLen: 0, uniqueRatio: 0, totalChars: 0 };
  }
  const sentences = splitSentences(clean);
  const words = splitWords(clean);
  const totalChars = clean.length;

  const avgSentenceLen = sentences.length
    ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
    : totalChars;

  const avgWordLen = words.length
    ? words.reduce((sum, w) => sum + w.length, 0) / words.length
    : 0;

  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const uniqueRatio = words.length ? uniqueWords.size / words.length : 0;

  return { avgSentenceLen, avgWordLen, uniqueRatio, totalChars };
}

function jaccard(setA, setB) {
  const a = new Set(setA || []);
  const b = new Set(setB || []);
  if (a.size === 0 && b.size === 0) return 0.5; // ไม่มีข้อมูลทั้งคู่ ถือว่ากลาง ๆ
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size ? intersection.size / union.size : 0;
}

function closeness(x, y, scale) {
  // ยิ่งค่าใกล้กันยิ่งได้คะแนนสูง (0..1)
  const diff = Math.abs(x - y);
  return Math.max(0, 1 - diff / scale);
}

function compatibility(userA, userB) {
  const genreScore = jaccard(userA.genres, userB.genres);

  const statsA = analyzeSample(userA.sample);
  const statsB = analyzeSample(userB.sample);

  const sentenceScore = closeness(statsA.avgSentenceLen, statsB.avgSentenceLen, 60);
  const wordScore = closeness(statsA.avgWordLen, statsB.avgWordLen, 6);
  const vocabScore = closeness(statsA.uniqueRatio, statsB.uniqueRatio, 0.5);

  const styleScore = (sentenceScore + wordScore + vocabScore) / 3;

  const total = genreScore * 0.5 + styleScore * 0.5;
  return Math.round(total * 100);
}

module.exports = { analyzeSample, compatibility };
