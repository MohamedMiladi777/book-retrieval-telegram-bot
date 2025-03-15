const { axiosInstance } = require("./axios");



function SendMessage(messageObj, messageText) {
  return axiosInstance.get("sendMessage", {
    chat_id: messageObj.chat.id,
    text: messageText,
  });
}

function handleMessage(messageObj) {
   
  const messageText = messageObj.text || "";
  if (messageText.charAt(0) === "/") {
    const command = messageText.substr(1);
    switch (command) {
      case "start":
        return SendMessage(
          messageObj,
          "Hi, I am milady's bot, how can I assist you?"
        );
      default:
        return SendMessage(messageObj, "Type a valid command to assist you");
    }
  } else {
    return SendMessage(messageObj, messageText);
  }
}

module.exports = { handleMessage };
