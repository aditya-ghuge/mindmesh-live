require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // <-- ADDED: For handling file paths

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const { CohereClient } = require('cohere-ai');

const app = express();
app.use(cors());
app.use(express.json());

// <-- ADDED: This tells your server to host the frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

app.post('/api/enhance', async (req, res) => {
    const { text, mood, context, lang, history } = req.body;

    let historyContext = "";
    if (history && history.length > 0) {
        const formattedHistory = history.map(msg => `${msg.role === 'them' ? 'THEM' : 'ME'}: ${msg.text}`).join('\n');
        historyContext = `Chat History for context:\n${formattedHistory}\n\n`;
    }

    let systemPrompt = "";

    let langRule = "";
    if (lang === "Hinglish") {
        langRule = "in conversational Roman Hinglish (Indian Gen-Z WhatsApp texting style with natural slang like 'mast', 'badhiya', 'yaar'). Do NOT use formal Hindi.";
    } else if (lang === "English") {
        langRule = "in natural, native-sounding English.";
    } else {
        langRule = "in the exact same language as the input text (use casual Roman Hinglish slang if the input has Hindi/Urdu words).";
    }

    if (mood === "RageOff") {
        if (context === "Me") {
            systemPrompt = `You are an empathetic communication expert. ${historyContext}
            The user wrote this angry draft: "${text}". 
            Your goal is de-escalation. Rewrite it to be calm and mature ${langRule}. 
            Format strictly as JSON: { "vibe": "Upset (Draft)", "emoji": "🧘", "replies": ["rewrite 1", "rewrite 2", "rewrite 3"] }`;
        } else {
            systemPrompt = `You are an empathetic communication expert. ${historyContext}
            The user received this aggressive message: "${text}". 
            Your goal is de-escalation. Generate calming, mature replies ${langRule}. Focus ONLY on replying to this latest message.
            Format strictly as JSON: { "vibe": "Aggressive (Incoming)", "emoji": "🧘", "replies": ["reply 1", "reply 2", "reply 3"] }`;
        }
    } else {
        let toneDetails = "";
        if (mood === "Executive") toneDetails = "highly professional, diplomatic, and corporate";
        if (mood === "Savage") toneDetails = "savage, sharp, witty, and unapologetic";
        if (mood === "AuraFlirt") toneDetails = "humorous, flirty, charming, and smooth";
        if (mood === "Easy Talk") toneDetails = "calm, simple, casual, and friendly";

        if (context === "Me") {
            systemPrompt = `You are an expert copywriter. ${historyContext}
            The user wrote this draft: "${text}". 
            Detect the mood, then enhance and rewrite the draft using a ${toneDetails} tone ${langRule}. 
            Format strictly as JSON: { "vibe": "Detected Mood", "emoji": "🎭", "replies": ["option 1", "option 2", "option 3"] }`;
        } else {
            systemPrompt = `You are a conversational assistant. ${historyContext}
            The user wants to reply to this message: "${text}". 
            Detect the mood of the message, then generate 3 distinct replies using a ${toneDetails} tone ${langRule}. Focus ONLY on replying to this latest message.
            Format strictly as JSON: { "vibe": "Detected Mood", "emoji": "🎭", "replies": ["reply 1", "reply 2", "reply 3"] }`;
        }
    }

    systemPrompt += `\n\nCRITICAL RULES:
    1. Output NOTHING except the valid JSON object. Do not wrap in \`\`\`json blocks.
    2. Make sure the replies sound exactly like a real human texting. Avoid AI buzzwords.`;

    // ---------------------------------------------------------
    // THE API WATERFALL (WITH NATIVE JSON MODE)
    // ---------------------------------------------------------

    const callGemini = async () => {
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig: {
                temperature: 0.8,
                responseMimeType: "application/json"
            }
        });
        const result = await model.generateContent(systemPrompt);
        return { source: 'Gemini', data: result.response.text() };
    };

    const callGroq = async () => {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemPrompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.8,
            response_format: { type: "json_object" }
        });
        return { source: 'Groq', data: completion.choices[0].message.content };
    };

    const callCohere = async () => {
        const response = await cohere.chat({
            message: systemPrompt,
            model: 'command-r-08-2024',
            temperature: 0.8,
        });
        return { source: 'Cohere', data: response.text };
    };

    try {
        console.log(`\n[MindMesh] Request -> Mode: ${mood} | Lang: ${lang} | Context: ${context}`);
        let finalResponse;

        // Try Gemini First
        try {
            finalResponse = await callGemini();
            console.log("✅ Success: Gemini handled the request.");
        }
        catch (e) {
            console.log("❌ Gemini failed:", e.message);
            console.log("🔄 Trying Groq...");
            // Try Groq Second
            try {
                finalResponse = await callGroq();
                console.log("✅ Success: Groq handled the request.");
            }
            catch (e2) {
                console.log("❌ Groq failed:", e2.message);
                console.log("🔄 Trying Cohere...");
                // Try Cohere Third
                finalResponse = await callCohere();
                console.log("✅ Success: Cohere handled the request.");
            }
        }

        // Clean any leftover markdown just in case Cohere was used 
        const cleanJsonString = finalResponse.data.replace(/```json|```/g, '').trim();
        const aiData = JSON.parse(cleanJsonString);

        res.json({
            success: true,
            vibe: aiData.vibe,
            emoji: aiData.emoji,
            replies: aiData.replies
        });

    } catch (error) {
        console.error("❌ Ultimate Failure:", error.message);
        res.status(500).json({
            success: false,
            vibe: "Error",
            emoji: "🚨",
            replies: ["Engine Overloaded.", "All systems failed.", "Check terminal logs."]
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 MindMesh Engine running on port ${PORT}`);
});