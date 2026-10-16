const SYSTEM_PROMPT = 'You summarize web page changes in one short sentence, present tense, ≤ 20 words. Mention what changed factually. No preamble.';

export async function summarizeChange(oldText, newText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Before:\n${String(oldText).slice(0, 4000)}\n\nAfter:\n${String(newText).slice(0, 4000)}` }
        ]
      })
    });
    if (!response.ok) return null;
    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content?.trim();
    return summary ? summary.split(/\s+/).slice(0, 20).join(' ') : null;
  } catch {
    return null;
  }
}
