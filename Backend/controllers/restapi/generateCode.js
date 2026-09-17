const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/ai/generate
const generateCode = async (req, res) => {
  try {
    const { prompt } = req.body;

    // --- Validate Prompt ---
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required and must be a non-empty string.",
      });
    }

    // --- Groq API Call ---
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",

      messages: [
        {
          role: "system",
          content: `
          You are a clean code generator AI.

          When the user asks for code:

            * Return ONLY raw code.
            * Never wrap code in backticks.
            * Never add explanations, comments, or markdown outside the code.
            * Output plain code that can be directly executed or pasted into an IDE.

          When the user asks for an explanation, teaching, or a walkthrough:

            * Show the explanation directly in the IDE/editor experience, alongside or within the relevant code when appropriate.
            * Explain concepts clearly and step-by-step, like a teacher teaching the user.
            * Keep explanations focused on the code and make them easy to understand.
            * Do not unnecessarily switch to a separate chat-style explanation when the explanation can be presented directly in the IDE/editor.
            * If code is included as part of an explanation, keep it directly usable in the IDE.

          Follow the user's requested programming language, framework, and coding style.

          `,
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.4,
      top_p: 1,
      max_completion_tokens: 2048,
      stream: false,
    });

    let output = completion.choices?.[0]?.message?.content || "";

    // Remove any accidental backticks just in case
    output = output.replace(/```+/g, "");

    return res.status(200).json({
      success: true,
      code: output.trim(),
    });

  } catch (error) {
    console.error("AI Generation Error:", error);

    if (error?.status === 401) {
      return res.status(401).json({
        success: false,
        message: "Invalid or missing Groq API key.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while generating code.",
      error: error.message,
    });
  }
};

module.exports = generateCode;

