const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

function getGenAI() {
    const apiKey = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";
    return new GoogleGenerativeAI(apiKey);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function callGeminiJSON(prompt, retries = 3) {
    const genAI = getGenAI();
    for (let i = 0; i < retries; i++) {
        try {
            // Use gemini-2.5-flash as it's the recommended model for general text tasks and JSON
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json",
                }
            });

            const textResult = result.response.text().trim();
            return JSON.parse(textResult);
        } catch (error) {
            console.error(`Gemini Extraction Error (Attempt ${i + 1})`, error.message);
            if (error.status === 429 && i < retries - 1) {
                console.log("Rate limited (429)! Waiting 4 seconds before retrying...");
                await delay(4000);
                continue;
            }
            return { error: "Failed to generate AI content. Please verify your Gemini API key." };
        }
    }
}

async function extractConcepts(rawText) {
    const prompt = `Extract exactly 5 core academic concepts from the following text. Format as a JSON array of strings: ${rawText}`;
    return await callGeminiJSON(prompt);
}

async function generateMCQs(rawText) {
    const prompt = `Generate 15 to 20 Multiple Choice Questions based on this text, AND include questions exploring deeper, related topics (out-of-scope but highly relevant) to test comprehensive understanding. Return purely as a JSON array of objects with keys 'question', 'options' (Array of 4 strings), and 'answer' (string matching the correct option). Text: ${rawText}`;
    return await callGeminiJSON(prompt);
}

async function generateSubjectiveQA(rawText) {
    const prompt = `Based on the following text, generate two '2-mark' short answer questions, and one '5-mark' detailed subjective question. Return purely as a JSON object: { "two_marks": [{question, answer}], "five_marks": [{question, answer}] }. Text: ${rawText}`;
    return await callGeminiJSON(prompt);
}

async function generateMindMap(rawText) {
    const prompt = `Based on this text, generate a hierarchical mind map structure. Return purely as a JSON object with a 'root' node string, and a 'branches' array mapping strings related to root. Text: ${rawText}`;
    return await callGeminiJSON(prompt);
}

async function generateYouTubeQueries(concepts) {
    const prompt = `Based on these concepts: ${JSON.stringify(concepts)}, generate 3 highly specific YouTube search queries that would yield the best educational videos for learning these topics. Return purely as a JSON array of strings.`;
    return await callGeminiJSON(prompt);
}

async function analyzeImage(imagePath, mimeType) {
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = "Extract all text, concepts, and detailed notes from this image. Explain any diagrams or visual information present. Return the result purely as a JSON object with a single 'text' property containing the full extracted string.";

        const imagePart = {
            inlineData: {
                data: Buffer.from(fs.readFileSync(imagePath)).toString("base64"),
                mimeType
            }
        };

        const result = await model.generateContent({
             contents: [{ role: "user", parts: [ {text: prompt}, imagePart ] }],
             generationConfig: {
                 temperature: 0.2,
                 responseMimeType: "application/json",
             }
        });

        const textResult = result.response.text().trim();
        return JSON.parse(textResult).text || "";
    } catch (error) {
        console.error("Image Analysis Error", error);
        return "Failed to analyze image.";
    }
}

async function generateAllStudyMaterials(rawText) {
    const prompt = `You are a strict JSON data API. Analyze the text and generate a study kit. You MUST output ONLY valid JSON.
{
  "concept_in_depth": [
    { "concept": "Overarching Theme 1", "deep_dive": "Extremely detailed, multi-paragraph explanation that explores this concept profoundly. Include related out-of-scope information, industry examples, and profound mastery-level knowledge to give the student complete understanding of the topic from the ground up." }
  ],
  "exam_notes": [
    { "topic": "Key Concept 1", "content": "Detailed bullet points or paragraphs covering everything needed for the exam regarding this concept..." }
  ],
  "roadmap": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"],
  "mcqs": [
    { "question": "Q text...", "options": ["A", "B", "C", "D"], "answer": "Exact correct string" }
  ],
  "subjective": {
    "two_marks": [ { "question": "Q text", "answer": "A text" } ],
    "five_marks": [ { "question": "Q text", "answer": "A text" } ]
  },
  "mindmap": {
    "root": "Main Topic",
    "branches": [
      {
        "title": "Subtopic string",
        "note": "A very detailed, multi-sentence paragraph explanation of this specific subtopic. MUST BE A LONG PARAGRAPH, NOT JUST A SHORT DESCRIPTION."
      }
    ]
  },
  "youtube": ["Search query 1", "Search query 2", "Search query 3", "Search query 4", "Search query 5"]
}

STRICT REQUIREMENTS:
1. "concept_in_depth" MUST contain at least 2 major overarching concepts with extremely detailed, "mastery level" deep-dive explanations that include related knowledge even if not explicitly in the input text.
2. "exam_notes" MUST contain at least 5 major topics with detailed, comprehensive study notes.
3. "mcqs" array MUST have exactly 15 to 20 questions.
4. "two_marks" array MUST have EXACTLY 10 questions.
5. "five_marks" array MUST have EXACTLY 10 questions.
6. "mindmap.branches" MUST have at least 8 items.
7. "mindmap.branches" MUST be an array of objects. It MUST NOT be an array of strings. Every object MUST have a "title" and a "note" property. If you return an array of strings for the branches, the system will crash.

Text: ${rawText}`;
    return await callGeminiJSON(prompt);
}

module.exports = { extractConcepts, generateMCQs, generateSubjectiveQA, generateMindMap, generateYouTubeQueries, analyzeImage, generateAllStudyMaterials };
