"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "./_trpc/client";
import { useUser } from "@auth0/nextjs-auth0";
interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: string;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] =
    useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  //trpc
  const askGemini = trpc.askGemini.useMutation();
  const insertMessage = trpc.insertMessage.useMutation();
  const createConversation = trpc.createConversation.useMutation();
  const updateConversation = trpc.updateConversation.useMutation();

  const { user } = useUser();

  const { data } = trpc.getConversation.useQuery(user?.sub ?? "", {
    enabled: !!user?.sub,
  });

  useEffect(() => {
    if (data && data.length > 0) {
      // Convert timestamps to Date objects if needed
      setCurrentConversationId(data[0].id);
      setConversations(data);
    }
  }, [data]);

  const simulateAIResponse = async (userMessage: string): Promise<string> => {
    // Simulate AI thinking time
    const result = await askGemini.mutateAsync(userMessage);

    if (!result.text) return "Something Wrong with Google AI";
    return result.text;
  };

  const currentConversation = conversations.find(
    (conv) => conv.id === currentConversationId
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages, isTyping]);

  const createNewConversation = async () => {
    if (!user) return;
    const response = await createConversation.mutateAsync({
      userId: user?.sub,
      title: "New Chat",
    });

    setConversations((prev) => [response, ...prev]);
    setCurrentConversationId(response.id);
    setSidebarOpen(false);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Create new conversation if none exists

    let conversationId = currentConversationId;

    if (!conversationId) {
      if (!user) return;
      const response = await createConversation.mutateAsync({
        userId: user?.sub,
        title:
          inputMessage.slice(0, 30) + (inputMessage.length > 30 ? "..." : ""),
      });
      conversationId = response.id;
      setCurrentConversationId(conversationId);
      const message_reponse = await insertMessage.mutateAsync({
        conversation_id: conversationId,
        user_id: user?.sub,
        content: inputMessage.trim(),
        role: "user",
      });
      const newConversation: Conversation = {
        id: response.id,
        title: response.title,
        messages: [message_reponse],
        lastUpdated: response.lastUpdated,
      };
      setConversations((prev) => [newConversation, ...prev]);
    } else {
      // Add message to existing conversation
      const response = await insertMessage.mutateAsync({
        conversation_id: currentConversationId,
        user_id: user?.sub ?? "",
        content: inputMessage.trim(),
        role: "user",
      });
      const convo_update = await updateConversation.mutateAsync({
        conversation_id: currentConversationId,
        title:
          inputMessage.length === 0
            ? "New Chat"
            : inputMessage.slice(0, 30) +
              (inputMessage.length > 30 ? "..." : ""),
      });
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [...conv.messages, response],
                title:
                  conv.messages.length === 0
                    ? inputMessage.slice(0, 30) +
                      (inputMessage.length > 30 ? "..." : "")
                    : conv.title,
              }
            : conv
        )
      );
    }

    setInputMessage("");
    setIsTyping(true);

    try {
      const aiResponse = await simulateAIResponse(inputMessage);
      if (aiResponse && user) {
        const response = await insertMessage.mutateAsync({
          user_id: user?.sub,
          conversation_id: conversationId,
          role: "assistant",
          content: aiResponse,
        });
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, response],
                }
              : conv
          )
        );
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setSidebarOpen(false);
  };

  if (!user)
    return (
      <div className="container d-flex flex-column justify-content-center align-items-center vh-100">
        <h2 className="mb-4">Welcome to ChatGPT Clone</h2>
        <div className="d-flex gap-3">
          <a href="/auth/login" className="btn btn-primary">
            Log In
          </a>
          <a
            href="/auth/login?screen_hint=signup"
            className="btn btn-outline-secondary">
            Sign Up
          </a>
        </div>
      </div>
    );

  return (
    <div className="container-fluid p-0 h-100">
      <div className="row h-100 g-0">
        {/* Sidebar */}
        <div
          className={`col-md-3 col-lg-2 sidebar  d-flex flex-column h-100 ${
            sidebarOpen ? "show" : ""
          }`}>
          {/* Top Section (New Chat + Conversations) */}
          <div className="p-3 flex-grow-1 overflow-auto">
            <button className="new-chat-btn" onClick={createNewConversation}>
              + New Chat
            </button>

            <div className="conversations-list">
              <h6 className=" mb-3">Recent Conversations</h6>
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={`conversation-item ${
                    conversation.id === currentConversationId ? "active" : ""
                  }`}
                  onClick={() => selectConversation(conversation.id)}>
                  <div className="d-flex justify-content-between align-items-start">
                    <span className="text-truncate">{conversation.title}</span>
                  </div>
                  <small>{conversation?.messages?.length} messages</small>
                </button>
              ))}

              {conversations.length === 0 && (
                <p className=" small">
                  No conversations yet. Start a new chat!
                </p>
              )}
            </div>
          </div>

          {/* Bottom Section (User Profile) */}
          <div className="p-3">
            <div className="d-flex align-items-center gap-2">
              <img
                src={user?.picture || "/default-avatar.png"}
                alt="User avatar"
                className="rounded-circle"
                width="40"
                height="40"
              />

              <div className="text-truncate">
                <strong className="d-block">{user?.name || "User"}</strong>
                <small>{user?.email}</small>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="col-md-9 col-lg-10 chat-container">
          {/* Mobile Menu Button */}
          <div className="d-md-none p-3 bg-dark">
            <button
              className="btn btn-outline-secondary"
              onClick={() => setSidebarOpen(!sidebarOpen)}>
              ☰ Menu
            </button>
          </div>

          {/* Messages Container */}
          <div className="messages-container">
            {!currentConversation ? (
              <div className="text-center mt-5">
                <h2 className="text-light mb-4">ChatGPT Clone</h2>
                <p className="text-light">
                  Start a conversation by typing a message below.
                </p>
              </div>
            ) : (
              <>
                {(currentConversation?.messages ?? []).map((message) => (
                  <div key={message.id} className={`message ${message.role}`}>
                    <div className="message-content">{message.content}</div>
                  </div>
                ))}

                {isTyping && (
                  <div className="message assistant">
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span>AI is typing</span>
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Container */}
          <div className="input-container">
            <div className="input-group">
              <textarea
                ref={textareaRef}
                className="form-control"
                placeholder="Type your message here..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
                style={{ resize: "none" }}
              />
              <button
                className="btn btn-primary ms-2"
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isTyping}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-md-none"
          style={{ zIndex: 1040 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
