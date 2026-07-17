type Letter = "A" | "B" | "C" | "D";

type RequestBody = {
  situation?: string;
  stem?: string;
  choices?: Record<Letter, string>;
  correct?: Letter;
  letter?: Letter;
  extractedRationale?: string;
};

export default async function handler(
  request: { method?: string; body?: RequestBody },
  response: { status: (code: number) => { json: (body: unknown) => void } },
) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });

  const { situation = "", stem = "", choices, correct, letter, extractedRationale = "" } = request.body || {};
  if (!choices || !correct || !letter || !stem) return response.status(400).json({ error: "Question details are incomplete." });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return response.status(500).json({ error: "The AI service is not configured yet." });

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
    const data = await result.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (!result.ok) return response.status(result.status).json({ error: data.error?.message || "Gemini could not generate a rationale." });
    const rationale = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!rationale) return response.status(502).json({ error: "Gemini returned an empty rationale. Please try again." });
    return response.status(200).json({ rationale });
  } catch {
    return response.status(502).json({ error: "The AI service could not be reached. Please try again." });
  }
}
