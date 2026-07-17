const letters = ["A", "B", "C", "D"];

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Question details are incomplete." }, { status: 400 });
    }

    const { situation = "", stem = "", choices, correct, letter, extractedRationale = "" } = body || {};
    if (!choices || !letters.includes(correct) || !letters.includes(letter) || !stem) {
      return Response.json({ error: "Question details are incomplete." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "The AI service is not configured yet." }, { status: 500 });
    }

    const prompt = `You are creating a PNLE practice-bank rationale. Write one concise but clinically useful rationale for choice ${letter} only.

Situation: ${situation || "None"}
Question: ${stem}
Choices:
A. ${choices.A}
B. ${choices.B}
C. ${choices.C}
D. ${choices.D}
Correct answer: ${correct}
Choice to explain: ${letter}
Extracted source rationale, if any: ${extractedRationale || "None"}

Requirements:
- Explain why this choice is ${letter === correct ? "the best answer" : "not the best answer"}.
- Use the question's nursing priority, safety, assessment, or clinical reasoning when relevant.
- Preserve useful facts from the extracted source rationale, but correct unclear wording.
- Do not invent patient-specific facts or cite unverified guidelines.
- Keep it to 2–4 sentences, educational and exam-focused.
- Return only the rationale text, with no heading or letter label.`;

    try {
      const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.25, maxOutputTokens: 320 },
        }),
      });
      const data = await result.json();
      if (!result.ok) {
        return Response.json({ error: data.error?.message || "Gemini could not generate a rationale." }, { status: result.status });
      }
      const rationale = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!rationale) {
        return Response.json({ error: "Gemini returned an empty rationale. Please try again." }, { status: 502 });
      }
      return Response.json({ rationale });
    } catch {
      return Response.json({ error: "The AI service could not be reached. Please try again." }, { status: 502 });
    }
  },
};
