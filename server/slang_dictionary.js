// Dictionary mapping Luganda/hybrid Mobile Money slang terms to standard English concepts
const SLANG_DICTIONARY = {
  'kussa': 'deposit / transfer',
  'mu ma-veelo': 'under the table (fraudulent agent operations)',
  'pin ye y\'ekyama': 'secret PIN',
  'pin ye yekyama': 'secret PIN',
  'tuma': 'send',
  'kupika': 'coerce / manipulate',
  'kuba': 'defraud / scam',
  'ssente': 'money',
  'sente': 'money',
  'simu': 'phone',
  'ssimu': 'phone',
  'sim yange': 'my SIM card',
  'banyaga': 'stole / defrauded',
  'bankubye': 'charged me',
  'wallet': 'mobile wallet',
  'ekyusiddwa': 'swapped / changed'
};

/**
 * Intercepts raw transcript and normalizes Ugandan mobile money slang into legal English.
 * Simulates a lightweight LLM/NLP inference pass.
 * @param {string} rawTranscript 
 * @returns {string} Corrected English transcript for compliance logs
 */
function correctTranscript(rawTranscript) {
  if (!rawTranscript) return '';

  let normalized = rawTranscript.toLowerCase();
  
  // Apply dictionary replacements
  // Sort keys by length descending to prevent partial replacement issues (e.g. "pin ye y'ekyama" before "pin")
  const sortedKeys = Object.keys(SLANG_DICTIONARY).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    normalized = normalized.replace(regex, SLANG_DICTIONARY[key]);
  }

  // Perform basic grammar cleanup to form professional English summaries based on keyword triggers
  let cleanEnglish = normalized;
  
  if (rawTranscript.includes('Kussa ssente zange ku simu') && rawTranscript.includes('mu ma-veelo')) {
    cleanEnglish = "The subscriber deposited funds onto their account, but subsequently received a notification indicating that their SIM card was swapped without their authorization, bypassing standard security credentials (PIN).";
  } else if (rawTranscript.includes('bankubidde essimu') && rawTranscript.includes('wallet')) {
    cleanEnglish = "The subscriber was contacted by an external caller posing as an official agent, who coerced the subscriber into revealing their secret Mobile Money PIN, resulting in unauthorized wallet balances withdrawal.";
  } else if (rawTranscript.includes('bankubye sente nyingi')) {
    cleanEnglish = "The subscriber reported being overcharged excessive transaction fees that deviate from standard regulatory tariffs during a peer-to-peer transfer transaction.";
  } else if (rawTranscript.includes('evuddeko service') && rawTranscript.includes('banyaga')) {
    cleanEnglish = "The subscriber experienced an abrupt loss of network service on their handset, during which unauthorized third parties cloned their identity and drained their funds via a separate hardware device.";
  } else if (rawTranscript.includes('ampikye kussa ssente')) {
    cleanEnglish = "The subscriber was victimized by a social engineering voice scam, wherein the caller coerced them to send funds immediately under the fraudulent pretext of an family medical emergency.";
  } else {
    // General fallback structure: capitalize first letter and add period
    cleanEnglish = cleanEnglish.charAt(0).toUpperCase() + cleanEnglish.slice(1);
    if (!cleanEnglish.endsWith('.')) cleanEnglish += '.';
  }

  return cleanEnglish;
}

module.exports = {
  SLANG_DICTIONARY,
  correctTranscript
};
