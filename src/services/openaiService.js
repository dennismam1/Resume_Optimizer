const config = require('../config');

/**
 * Call OpenAI API with the given prompt
 * @param {string} prompt - The prompt to send to OpenAI
 * @param {Object} [options]
 * @param {number} [options.maxTokens]
 * @param {number} [options.temperature]
 * @param {number} [options.top_p]
 * @param {string} [options.system]
 * @returns {Promise<string>} - The response content
 */
async function callOpenAI(prompt, options = {}) {
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('Missing OpenAI API key. Set OPENAI_API_KEY environment variable.');
  }

  try {
    console.log('Calling OpenAI with model:', config.OPENAI_MODEL_ID);
    console.log('API Key starts with:', config.OPENAI_API_KEY.substring(0, 8) + '...');

    const requestBody = {
      model: config.OPENAI_MODEL_ID,
      messages: [
        {
          role: 'system',
          content: options.system || 'You are a helpful assistant that extracts structured information from resumes and returns valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: Math.max(1, Math.min(Number(options.maxTokens || 512), 4096)),
      temperature: options.temperature == null ? 0.2 : options.temperature,
      top_p: options.top_p == null ? 0.9 : options.top_p
    };

    const response = await fetch(config.OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API call failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI Response object:', data);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else {
      throw new Error('Unexpected response format from OpenAI API');
    }
  } catch (error) {
    console.error('OpenAI API Error:', error);
    if (error.message.includes('401')) {
      throw new Error('Invalid OpenAI API key. Check your OPENAI_API_KEY.');
    }
    if (error.message.includes('404')) {
      throw new Error(`Model ${config.OPENAI_MODEL_ID} not found. Try a different model.`);
    }
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Extract JSON from a string response
 * @param {string} text - The text to extract JSON from
 * @returns {Object|null} - Parsed JSON object or null
 */
function extractJsonFromString(text) {
  if (!text) return null;
  // Try to find a fenced code block first
  const codeBlockMatch = text.match(/```(?:json)?\n([\s\S]*?)```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : text;

  // Find the first JSON object by brace matching
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const jsonSlice = candidate.slice(start, i + 1);
        try {
          return JSON.parse(jsonSlice);
        } catch (e) {
          // continue searching if parse fails
        }
      }
    }
  }
  return null;
}

module.exports = {
  callOpenAI,
  extractJsonFromString
};


