export const generateQuiz = async (userApiKey, examName, numQuestions, duration, difficulty, focusArea, sourceContent, attachedImages) => {
    const systemPrompt = `You are a strict, expert Educational Content Creator for Rajasthan Competitive Exams (RPSC & RSSB). 
You must analyze the provided text/images deeply. Act as an examiner creating a highly balanced, authentic CBT test.

Difficulty Target: ${difficulty}
Specific Topic Focus Requested by User: ${focusArea ? focusArea : "Cover the entire document evenly."}

Rules & Distribution algorithm for ${numQuestions} questions:
1. Ensure approx 40% are Direct/Single-line MCQs (सीधे/एकल-पंक्ति प्रश्न).
2. Ensure approx 20% are Multi-statement Codes (बहु-कथनीय कूट वाले प्रश्न: Choose code 1 & 2, etc).
3. Ensure approx 20% are Assertion-Reason (कथन और कारण).
4. Ensure approx 20% are Match the Following (सुमेलित कीजिए).

Quality Checks:
- Distractors (incorrect options) must be highly plausible and tricky, not obvious.
- All text, questions, options, and rationale MUST be purely in formal Hindi (Devenagari script).
- The 'ans' field MUST be the 0-based index of the correct option in the 'opts' array (e.g., 0, 1, 2, or 3).
- Output strictly in valid JSON matching the schema, with no markdown wrappers outside the JSON structure.`;

    const userQueryText = `सामग्री/छवियां (परीक्षा: ${examName}, प्रश्न: ${numQuestions}):
----------------------------------
${sourceContent.substring(0, 8000)}
----------------------------------`;

    const promptParts = [{ text: userQueryText }];
    attachedImages.forEach(img => {
      const mimeType = img.dataUrl.split(';')[0].split(':')[1];
      const base64Data = img.dataUrl.split(',')[1];
      promptParts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
    });

    const payload = {
      contents: [{ parts: promptParts }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            questions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "INTEGER" },
                  topic: { type: "STRING" },
                  q: { type: "STRING" },
                  opts: { type: "ARRAY", items: { type: "STRING" } },
                  ans: { type: "INTEGER" },
                  rationale: { type: "STRING" }
                },
                required: ["id", "topic", "q", "opts", "ans", "rationale"]
              }
            }
          },
          required: ["questions"]
        }
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey.trim()}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
};
