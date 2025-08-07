"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "./_trpc/client";
import { useUser } from "@auth0/nextjs-auth0";
import {
  Search,
  Menu,
  MessageCircle,
  Sparkles,
  PenTool,
  FileText,
  Mic,
  Volume2,
  Plus,
} from "lucide-react";
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
  const suggestionButtons = [
    {
      icon: <Sparkles className="me-2" size={16} />,
      text: "Create image",
      color: "success",
    },
    {
      icon: <PenTool className="me-2" size={16} />,
      text: "Help me write",
      color: "primary",
    },
    {
      icon: <FileText className="me-2" size={16} />,
      text: "Summarize text",
      color: "warning",
    },
    { text: "More", color: "secondary" },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [isTyping]);

  const createNewConversation = async () => {
    if (!user) return;
    const response = await createConversation.mutateAsync({
      userId: user?.sub,
      title: "New Chat",
    });
    console.log(response);

    const newConversation: Conversation = {
      title: response.title,
      id: response.id,
      messages: [],
      lastUpdated: response.last_updated,
    };

    console.log(newConversation);

    setConversations((prev) => [newConversation, ...prev]);
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
        lastUpdated: response.last_updated,
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
                messages: [...(conv.messages || []), response],
                title:
                  conv.messages.length === 0
                    ? inputMessage.slice(0, 30) +
                      (inputMessage.length > 30 ? "..." : "")
                    : conv.title,
                lastUpdated: convo_update.last_updated,
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
          <a href="/auth/login?screen_hint=signup" className="btn btn-primary">
            Sign Up
          </a>
        </div>
      </div>
    );

  return (
    <div className="container-fluid p-0 h-100">
      <div className="row h-100 g-0">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? "show" : ""}`}>
          {/* Mobile Header */}
          <div className="d-md-none mobile-sidebar-header">
            <div className="search-container">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search"
                className="search-input"
              />
            </div>
          </div>

          <div className="p-3">
            {/* Desktop New Chat Button */}
            <button
              className="new-chat-btn d-none d-md-block"
              onClick={createNewConversation}>
              + New Chat
            </button>

            {/* Mobile Navigation Items */}
            <div className="d-md-none mobile-nav-items">
              <div className="nav-item">
                <Plus size={20} />
                <span onClick={createNewConversation}>New Chat</span>
              </div>
            </div>

            <div className="conversations-list">
              <h6 className=" mb-3 d-none d-md-block">Recent Conversations</h6>
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
                </button>
              ))}

              {conversations.length === 0 && (
                <p className=" small d-none d-md-block">
                  No conversations yet. Start a new chat!
                </p>
              )}
            </div>

            {/* Mobile User Profile */}
            <div className="d-md-none mobile-user-profile">
              <div className="user-avatar">P</div>
              <span>{user?.name}</span>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-container">
          {/* Mobile Menu Button */}
          <div className="d-md-none mobile-header">
            <button
              className="btn-icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={20} />
            </button>
            <div className="mobile-title">
              <span>Get Plus</span>
              <span className="plus-icon">+</span>
            </div>
            <button className="btn-icon">
              <div className="refresh-icon">⟲</div>
            </button>
          </div>

          {/* Messages Container */}
          <div className="messages-container">
            {!currentConversation ? (
              <div className="welcome-screen">
                <div className="d-none d-md-block text-center">
                  <h2 className="text-light mb-4">ChatGPT Clone</h2>
                  <p className="">
                    Start a conversation by typing a message below.
                  </p>
                </div>

                {/* Mobile Welcome Screen */}
                <div className="d-md-none mobile-welcome">
                  <h1 className="welcome-title">What can I help with?</h1>
                  <div className="suggestion-buttons">
                    {suggestionButtons.map((button, index) => (
                      <button
                        key={index}
                        className={`suggestion-btn btn-outline-${button.color}`}
                        onClick={() => {
                          if (button.text !== "More") {
                            setInputMessage(`Help me with: ${button.text}`);
                          }
                        }}>
                        {button.icon}
                        {button.text}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="d-none d-md-block desktop-welcome">
                  <h1 className="welcome-title">What can I help with?</h1>
                  <div className="suggestion-buttons desktop-suggestions">
                    {suggestionButtons.map((button, index) => (
                      <button
                        key={index}
                        className={`suggestion-btn btn-outline-${button.color}`}
                        onClick={() => {
                          if (button.text !== "More") {
                            setInputMessage(`Help me with: ${button.text}`);
                          }
                        }}>
                        {button.icon}
                        {button.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {currentConversation?.messages &&
                  currentConversation.messages.map((message) => (
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
            <div className="input-group desktop-input-group">
              <button className="btn-icon d-md-none input-icon-left">
                <MessageCircle size={20} />
              </button>
              <textarea
                ref={textareaRef}
                className="form-control"
                placeholder="Ask anything"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
              />
              <button className="btn-icon d-md-none input-icon-right">
                <Mic size={20} />
              </button>
              <button className="btn-icon d-md-none input-icon-right">
                <Volume2 size={20} />
              </button>
              <button
                className="btn btn-primary ms-2 d-none d-md-block"
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
          className="sidebar-overlay d-md-none"
          style={{ zIndex: 1040 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
