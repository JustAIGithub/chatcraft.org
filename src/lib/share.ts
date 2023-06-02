import { ChatOpenAI } from "langchain/chat_models/openai";

import { ChatCraftChat, SerializedChatCraftChat } from "./ChatCraftChat";
import { ChatCraftHumanMessage, ChatCraftSystemMessage } from "./ChatCraftMessage";
import { getToken, getUser } from "../lib/storage";

function createShareUrl(user: User, chat: ChatCraftChat) {
  // Create a share URL we can give to other people
  const { origin } = new URL(location.href);
  const shareUrl = new URL(`/c/${user.username}/${chat.id}`, origin);

  return shareUrl.href;
}

export async function createOrUpdateShare(chat: ChatCraftChat) {
  const token = getToken();
  const user = getUser();
  if (!(user && token)) {
    throw new Error("missing user credentials necessary for sharing");
  }

  const res = await fetch(`/api/share/${user.username}/${chat.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(chat.serialize()),
  });

  if (!res.ok) {
    const {
      message,
    }: {
      message?: string;
    } = await res.json();
    throw new Error(`Unable to share chat: ${message || "unknown error"}`);
  }

  return createShareUrl(user, chat);
}

export async function loadShare(user: string, id: string) {
  const res = await fetch(`/api/share/${user}/${id}`);
  if (!res.ok) {
    throw new Error("Unable to load shared chat" + (await res.json()).message);
  }

  const serialized: SerializedChatCraftChat = await res.json();
  return ChatCraftChat.parse(serialized);
}

export async function summarizeChat(openaiApiKey: string, chat: ChatCraftChat) {
  const chatOpenAI = new ChatOpenAI({
    openAIApiKey: openaiApiKey,
    temperature: 0,
    modelName: "gpt-3.5-turbo",
  });

  const systemChatMessage = new ChatCraftSystemMessage({
    text: "You are expert at summarizing",
  });

  const summarizeInstruction = new ChatCraftHumanMessage({
    text: `Summarize this entire chat in 75 words or fewer. Respond only with the summary text`,
  });

  try {
    const res = await chatOpenAI.call([systemChatMessage, ...chat.messages, summarizeInstruction]);
    return res.text.trim();
  } catch (err) {
    console.error("Error summarizing chat", err);
    throw err;
  }
}