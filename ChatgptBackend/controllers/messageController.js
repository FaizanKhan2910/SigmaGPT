import Chat from "../models/Chat.js"
import axios from "axios"
import user from "../models/User.js"
import imagekit from "../configs/imageKit.js"
import ai from "../configs/openai.js"

export const textMessageController = async (req, res) => {
    try {
        const userId = req.user._id
        //CHeck credits
        if (req.user.credits < 1) {
            return res.json({
                success: false, message:
                    "U don't have enough credit to use this feature "
            })
        }
        const { chatId, prompt } = req.body

        const chat = await Chat.findOne({ userId, _id: chatId })
        chat.messages.push({
            role: "user", content: prompt, timestamp: Date.now(),
            isImage: false
        })

        // Use Google Generative AI with automated fallback chain to guarantee generation resilience
        const modelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
        let replyText = "";
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                const model = ai.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                replyText = response.text();
                break; // Successfully generated content
            } catch (err) {
                console.warn(`Model ${modelName} failed, attempting fallback...`, err.message);
                lastError = err;
            }
        }

        if (!replyText) {
            throw new Error(`AI generation failed across available clusters. Please verify API key permissions: ${lastError?.message || 'Unknown error'}`);
        }

        const reply = { role: "model", content: replyText, timestamp: Date.now(), isImage: false };

        res.json({ success: true, reply })
        chat.messages.push(reply)
        await chat.save()

        await user.updateOne({ _id: userId }, { $inc: { credits: -1 } })


    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message })
    }
}

//Image genration messages Controller

export const imageMessageController = async (req, res) => {
    try {
        const userId = req.user._id;
        //CHeck credits
        if (req.user.credits < 2) {
            return res.json({
                success: false, message:
                    "U don't have enough credit to use this feature "
            })
        }
        const { prompt, chatId, isPublished } = req.body
        //Find Chat
        const chat = await Chat.findOne({ userId, _id: chatId })

        //Push user message
        chat.messages.push({
            role: "user",
            content: prompt,
            timestamp: Date.now(),
            isImage: false
        });

        // Construct ImageKit AI generation URL
        // Correct structure: endpoint/tr:ik-genimg-prompt-<prompt>/path/to/image.png
        const formattedPrompt = prompt.trim().replace(/\s+/g, '-').toLowerCase();
        const genratedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/$/, '')}/tr:ik-genimg-prompt-${formattedPrompt}/SigmaGpt/${Date.now()}.png?tr=w-800,h-800`;

        console.log("Attempting to generate image at URL:", genratedImageUrl);

        // Trigger gen by fetching from Imagekit 
        let aiImageResponse;
        try {
            aiImageResponse = await axios.get(genratedImageUrl, { responseType: "arraybuffer" });
        } catch (axiosError) {
            console.error("Axios Error Fetching ImageKit AI Image:", {
                status: axiosError.response?.status,
                data: axiosError.response?.data?.toString(),
                message: axiosError.message,
                url: genratedImageUrl
            });
            throw new Error(`Failed to generate image: ImageKit returned ${axiosError.response?.status || axiosError.message}`);
        }

        // Convert to base64
        const base64Image = `data:image/png;base64,${Buffer.from(aiImageResponse.data, "binary").toString('base64')}`;

        const uploadResponse = await imagekit.upload({
            file: base64Image,
            fileName: `${Date.now()}.png`,
            folder: "SigmaGpt"
        })
        const reply = {
            role: 'Assistant',
            content: uploadResponse.url,
            prompt,
            timestamp: Date.now(),
            isImage: true,
            isPublished: isPublished === undefined ? true : isPublished
        }
        res.json({ success: true, reply })

        chat.messages.push(reply)
        await chat.save()


        await user.updateOne({ _id: userId }, { $inc: { credits: -2 } })


    } catch (error) {
        console.error("Image generation controller error:", error);
        res.json({ success: false, message: error.message })
    }
}