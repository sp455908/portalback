const xssPatterns = [
  /<\s*script[^>]*>.*?<\s*\/\s*script\s*>/gi,
  /javascript:\s*/gi,
  /on\w+\s*=\s*"[^"]*"/gi,
  /on\w+\s*=\s*'[^']*'/gi,
  /on\w+\s*=\s*[^\s>]+/gi,
  /<\s*img[^>]*(on\w+\s*=)[^>]*>/gi,
  /<\s*iframe[^>]*>/gi,
  /<\s*\/\s*iframe\s*>/gi
];

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  let v = value;
  xssPatterns.forEach((re) => {
    v = v.replace(re, '');
  });
  // Neutralize angle brackets and ampersands
  v = v.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return v;
}

function sanitizeValue(value) {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = sanitizeValue(value[k]);
    }
    return out;
  }
  return value;
}

module.exports = { sanitizeString, sanitizeValue };