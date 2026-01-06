const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: "smarthub/.env" });

async function testGemini() {
  console.log("Testing Gemini API...");
  console.log("API Key length:", process.env.GEMINI_API_KEY?.length);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent("Hello! Are you working?");
    const response = await result.response;
    const text = response.text();
    console.log("✅ Success! Response:", text);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testGemini();

