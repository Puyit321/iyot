const axios = require('axios');

async function gptConvoAPI(ask, id) {
    try {
        const response = await axios.get(`https://jonellccprojectapis10.adaptable.app/api/gptconvo?ask=${encodeURIComponent(ask)}&id=${id}`);
        
        if (response.data && response.data.response) {
            return response.data.response;
        } else {
            return "Unexpected API response format. Please check the API or contact support.";
        }
    } catch (error) {
        console.error("Error fetching data:", error.message);
        return "Failed to fetch data. Please try again later.";
    }
}

module.exports = {
    name: "ai",
    description: "Interact with GPT-3 conversational AI",
    nashPrefix: false,
    version: "1.0.0",
    role: 0,
    cooldowns: 5,
    async execute(api, event, args) {
        const { threadID, messageID, senderID } = event;
        const message = args.join(" ");

        if (!message) return api.sendMessage("Please provide your question.\n\nExample: G4 What is the solar system?", threadID, messageID);

        api.sendMessage(
            "💬 Homer AI Bot Responding...",
            threadID,
            async (err, info) => {
                if (err) return;
                try {
                    if (event.type === "message_reply" && event.messageReply.attachments && event.messageReply.attachments[0]) {
                        const attachment = event.messageReply.attachments[0];

                        if (attachment.type === "photo") {
                            const imageURL = attachment.url;
                            const geminiUrl = `https://joncll.serv00.net/chat.php?ask=${encodeURIComponent(message)}&imgurl=${encodeURIComponent(imageURL)}`;
                            const geminiResponse = await axios.get(geminiUrl);
                            const { vision } = geminiResponse.data;

                            if (vision) {
                                return api.editMessage(
                                    `•| 𝙷𝙾𝙼𝙴𝚁 𝙰𝙸 𝙱𝙾𝚃  |•\n\n${vision}\n\n•| 𝙾𝚆𝙽𝙴𝚁 : 𝙷𝙾𝙼𝙴𝚁 𝚁𝙴𝙱𝙰𝚃𝙸𝚂 |•`,
                                    info.messageID
                                );
                            } else {
                                return api.sendMessage("🤖 Failed to recognize the image.", threadID, messageID);
                            }
                        }
                    }

                    const response = await gptConvoAPI(message, senderID);
                    api.editMessage(
                        `•| 𝙷𝙾𝙼𝙴𝚁 𝙰𝙸 𝙱𝙾𝚃 |•\n\n${response}\n\n•| 𝙾𝚆𝙽𝙴𝚁 : 𝙷𝙾𝙼𝙴𝚁 𝚁𝙴𝙱𝙰𝚃𝙸𝚂 |•`,
                        info.messageID,
                        threadID,
                        messageID
                    );
                } catch (error) {
                    api.sendMessage("An error occurred while processing your request.", threadID, messageID);
                }
            },
            messageID
        );
    },
};
