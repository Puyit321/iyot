const axios = require("axios");

async function aic(q, uid) {
    try {
        const response = await axios.get(`${global.NashBot.END}gpt4?prompt=${encodeURIComponent(q)}&uid=${uid}`);
        return response.data.gpt4;
    } catch (error) {
        console.error("Error fetching data:", error.message);
        return "Failed to fetch data. Please try again later.";
    }
}

module.exports = {
    name: "g2",
    description: "Talk to GPT4 (conversational)",
    nashPrefix: false,
    version: "1.0.2",
    role: 0,
    cooldowns: 5,
    aliases: ["ai"],
    execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;
        let prompt = args.join(" ");
        if (!prompt) return api.sendMessage("Please enter a prompt.", threadID, messageID);
        
        if (!global.handle) {
            global.handle = {};
        }
        if (!global.handle.replies) {
            global.handle.replies = {};
        }

        api.sendMessage(
            "Homer AI Bot\n\n" +
            "💬 Responding..." +
            '\n\n[ Type "Clear" to reset conversation ]',
            threadID,
            async (err, info) => {
                if (err) return;
                try {
                    const response = await aic(prompt, senderID);
                    api.editMessage(
                        "Homer AI Bot\n\n" +
                        response +
                        "\n\n[ Reply This Chat to Continue ]",
                        info.messageID
                    );
                    global.handle.replies[info.messageID] = {
                        cmdname: module.exports.name,
                        this_mid: info.messageID,
                        this_tid: info.threadID,
                        tid: threadID,
                        mid: messageID,
                    };
                } catch (g) {
                    api.sendMessage("Error processing your request: " + g.message, threadID);
                }
            },
            messageID
        );
    },
};
