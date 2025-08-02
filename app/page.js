"use client";
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { CiLocationArrow1 } from "react-icons/ci";
import { HiMenuAlt2, HiX } from "react-icons/hi";
import { Camera, FileText, ImageIcon, Paperclip, X } from "lucide-react";

// Initialize socket outside component to prevent reconnections
let socket = null;

const Chat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userList, setUserList] = useState([]);
  const [otherUserId, setOtherUserId] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const getUserById = (id) => userList.find((user) => user._id === id);

  // Initialize socket connection
  useEffect(() => {
    if (!socket) {
      console.log("🔌 Initializing socket connection...");
      socket = io("https://messenger-server-po5n.onrender.com", {
        transports: ["websocket", "polling"],
        forceNew: true,
      });

      socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
        setSocketConnected(true);
      });

      socket.on("disconnect", () => {
        console.log("❌ Socket disconnected");
        setSocketConnected(false);
      });

      socket.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error);
      });
    }

    return () => {
      // Don't disconnect socket on component unmount
      // Only disconnect when truly needed
    };
  }, []);

  // Debug logging
  console.log("=== CURRENT STATE ===");
  console.log("currentUserId:", currentUserId);
  console.log("otherUserId:", otherUserId);
  console.log("isTyping:", isTyping);
  console.log("typingUser:", typingUser);
  console.log("socket connected:", socketConnected);

  useEffect(() => {
    const fetchUsers = async () => {
      const user = JSON.parse(localStorage.getItem("user"));
      console.log("👤 User from localStorage:", user);

      if (!user || !user._id) {
        console.error("❌ No user found in localStorage");
        return;
      }

      try {
        const res = await fetch(
          `https://messenger-server-po5n.onrender.com/users/${user._id}`
        );
        const users = await res.json();
        console.log("👥 Fetched users:", users);
        setUserList(users);
      } catch (error) {
        console.error("❌ Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      console.log("🔐 Setting currentUserId:", parsedUser._id);
      setCurrentUserId(parsedUser._id);
    } else {
      console.error("❌ No user data in localStorage");
    }
  }, []);

  // Socket event handlers setup
  useEffect(() => {
    if (!socket || !currentUserId || !socketConnected) {
      console.log("⏳ Waiting for socket/currentUserId/connection...");
      return;
    }

    console.log("🔌 Setting up socket listeners for user:", currentUserId);

    // Register user
    socket.emit("register", currentUserId);
    console.log("📡 Emitted register event:", currentUserId);

    // Remove any existing listeners first
    socket.off("receive-message");
    socket.off("typing");
    socket.off("stop-typing");

    const handleReceiveMessage = ({ senderId, message, timeStamp }) => {
      console.log("📨 Received message:", { senderId, message, timeStamp });
      const serverTime = new Date().toISOString();
      const finalTimeStamp = timeStamp || serverTime;
      setMessages((prev) => [
        ...prev,
        { senderId, message, timeStamp: finalTimeStamp },
      ]);

      // Stop typing indicator when message is received
      if (senderId === otherUserId) {
        console.log("🛑 Stopping typing indicator - message received");
        setIsTyping(false);
        setTypingUser(null);
      }
    };

    const handleTyping = ({ senderId }) => {
      console.log("⌨️ TYPING EVENT RECEIVED:");
      console.log("  - senderId:", senderId);
      console.log("  - currentUserId:", currentUserId);
      console.log("  - otherUserId:", otherUserId);
      console.log("  - senderId === otherUserId:", senderId === otherUserId);

      // Check if the typing user is the current chat partner
      if (senderId === otherUserId) {
        console.log("✅ SETTING TYPING TO TRUE");
        setIsTyping(true);
        setTypingUser(senderId);
      } else {
        console.log("❌ Not setting typing - sender is not current chat user");
        console.log("  - Expected:", otherUserId);
        console.log("  - Got:", senderId);
      }
    };

    const handleStopTyping = ({ senderId }) => {
      console.log("🛑 STOP TYPING EVENT RECEIVED:");
      console.log("  - senderId:", senderId);
      console.log("  - otherUserId:", otherUserId);

      if (senderId === otherUserId) {
        console.log("✅ SETTING TYPING TO FALSE");
        setIsTyping(false);
        setTypingUser(null);
      }
    };

    // Set up socket listeners
    socket.on("receive-message", handleReceiveMessage);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);

    console.log("✅ Socket listeners registered");

    // Cleanup function
    return () => {
      console.log("🧹 Cleaning up socket listeners");
      if (socket) {
        socket.off("receive-message", handleReceiveMessage);
        socket.off("typing", handleTyping);
        socket.off("stop-typing", handleStopTyping);
      }
    };
  }, [currentUserId, otherUserId, socketConnected]);

  // Clear typing indicator when switching chats
  useEffect(() => {
    console.log("🔄 Switching chat to user:", otherUserId);
    setIsTyping(false);
    setTypingUser(null);
    setMessages([]); // Clear messages when switching users
  }, [otherUserId]);

  const handleMessage = () => {
    if (!input.trim() || !otherUserId || !socket) {
      console.log("❌ Cannot send message - missing requirements");
      return;
    }

    console.log("📤 Sending message:", {
      senderId: currentUserId,
      receiverId: otherUserId,
      message: input,
    });

    // Stop typing indicator when sending message
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit("stop-typing", {
      senderId: currentUserId,
      receiverId: otherUserId,
    });

    // Send message
    socket.emit("send-message", {
      senderId: currentUserId,
      receiverId: otherUserId,
      message: input,
    });

    setMessages((prev) => [
      ...prev,
      {
        senderId: currentUserId,
        message: input,
        timeStamp: new Date().toISOString(),
      },
    ]);
    setInput("");
  };

  const handleTyping = () => {
    if (!otherUserId || !currentUserId || !socket || !socketConnected) {
      console.log("❌ Cannot emit typing - missing requirements");
      return;
    }

    console.log("⌨️ EMITTING TYPING EVENT:");
    console.log("  - senderId:", currentUserId);
    console.log("  - receiverId:", otherUserId);
    console.log("  - socket connected:", socketConnected);

    // Emit typing event
    const typingData = {
      senderId: currentUserId,
      receiverId: otherUserId,
    };

    socket.emit("typing", typingData);
    console.log("📡 Typing event emitted:", typingData);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      console.log("⏰ Timeout - emitting stop-typing");
      socket.emit("stop-typing", {
        senderId: currentUserId,
        receiverId: otherUserId,
      });
    }, 3000); // Increased to 3 seconds
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleMessage();
    }
  };

  // if (!currentUserId) {
  //   return (
  //     <div className="p-4">
  //       <p>Loading chat...</p>
  //       <div className="mt-4 p-4 bg-yellow-100 rounded">
  //         <h3 className="font-bold">Debug Info:</h3>
  //         <p>Current User ID: {currentUserId || "Not set"}</p>
  //         <p>Socket Connected: {socketConnected ? "Yes" : "No"}</p>
  //         <p>
  //           LocalStorage User:{" "}
  //           {localStorage.getItem("user") ? "Found" : "Not found"}
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  // Handle file selection
  const handleFileSelect = (event, type) => {
    const file = event.target.files[0];
    if (file) {
      setIsModalOpen(false);
      // Simulate sending a file message
      const newMessage = {
        senderId: currentUserId,
        file: { name: file.name, type: file.type },
        timeStamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);
      mockSocket.emit("send-message", {
        senderId: currentUserId,
        receiverId: otherUserId,
        file: { name: file.name, type: file.type },
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Enhanced Debug Panel */}
      {/* <div className="fixed top-0 right-0 bg-black text-white p-2 text-xs z-50 max-w-xs">
        <div>Socket: {socketConnected ? "✅" : "❌"}</div>
        <div>Current: {currentUserId?.slice(-6)}</div>
        <div>Other: {otherUserId?.slice(-6)}</div>
        <div>Typing: {isTyping ? "✅" : "❌"}</div>
        <div>From: {typingUser?.slice(-6) || "none"}</div>
        <div>Messages: {messages.length}</div>
      </div> */}

      {/* Toggle Button (Mobile) */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute top-4 left-4 z-20 md:hidden bg-white p-2 rounded shadow"
      >
        {isSidebarOpen ? <HiX size={24} /> : <HiMenuAlt2 size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed md:static top-0 left-0 h-full w-[260px] bg-gray-100 border-r z-10 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-4 h-full overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Users</h2>
          {!socketConnected && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded">
              Socket disconnected
            </div>
          )}
          <div className="flex flex-col gap-3">
            {userList.map((user) => (
              <div
                key={user._id}
                onClick={() => {
                  console.log("👤 Selected user:", user._id, user.firstName);
                  setOtherUserId(user._id);
                  setIsSidebarOpen(false);
                }}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-200 ${
                  otherUserId === user._id ? "bg-gray-300" : ""
                }`}
              >
                <img
                  src={
                    user.image_url ||
                    "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png"
                  }
                  alt="User"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <span className="font-medium">{user.firstName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col ml-0 md:ml-[260px] w-full">
        {/* Chat Header */}
        {otherUserId && (
          <div className="p-4 border-b bg-white">
            <div className="flex items-center gap-3">
              {(() => {
                const user = getUserById(otherUserId);
                return (
                  <>
                    <img
                      src={
                        user?.image_url ||
                        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png"
                      }
                      alt="User"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="font-semibold">{user?.firstName}</h3>
                      {isTyping && (
                        <p className="text-sm text-blue-500 animate-pulse">
                          typing...
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!otherUserId && (
            <div className="text-center text-gray-500 mt-20">
              Select a user to start chatting
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.senderId === currentUserId;
            const user = getUserById(msg.senderId);

            return (
              <div
                key={i}
                className={`flex gap-2 items-start ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                {!isMe && (
                  <div className="w-10 h-10 flex-shrink-0">
                    {user?.image_url ? (
                      <img
                        src={user.image_url}
                        className="w-10 h-10 rounded-full object-cover"
                        alt="avatar"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white font-bold">
                        {user?.firstName?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`max-w-[70%] rounded-xl px-4 py-2 text-sm ${
                    isMe
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {msg.message}
                  {msg.timeStamp && (
                    <div
                      className={`text-xs mt-1 ${
                        isMe ? "text-blue-100" : "text-gray-500"
                      }`}
                    >
                      {new Date(msg.timeStamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator in Chat Area */}
          {isTyping && (
            <div className="flex gap-2 items-start justify-start">
              <div className="w-10 h-10 flex-shrink-0">
                {(() => {
                  const user = getUserById(typingUser);
                  return user?.image_url ? (
                    <img
                      src={user.image_url}
                      className="w-10 h-10 rounded-full object-cover"
                      alt="avatar"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white font-bold">
                      {user?.firstName?.charAt(0).toUpperCase() || "U"}
                    </div>
                  );
                })()}
              </div>
              <div className="bg-gray-200 rounded-xl px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        {otherUserId && (
          <div className="p-4 flex items-center gap-2 border-t">
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-3 text-gray-600 hover:text-blue-600 transition-colors"
              aria-label="Upload file"
            >
              <Paperclip size={24} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (e.target.value.length > 0) {
                  handleTyping();
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 outline-none"
            />
            <button
              onClick={handleMessage}
              disabled={!input.trim()}
              className={`p-2 rounded-full ${
                input.trim()
                  ? "bg-black text-white hover:bg-gray-800"
                  : "bg-gray-300 text-white cursor-not-allowed"
              }`}
            >
              <CiLocationArrow1 size={20} />
            </button>
          </div>
        )}
      </div>
      {/* File Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm relative">
            <h3 className="text-xl font-bold mb-6 text-center">Upload File</h3>
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <X size={24} />
            </button>
            <div className="flex justify-around items-center">
              {/* Camera */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => cameraInputRef.current.click()}
                  className="p-4 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                >
                  <Camera size={28} />
                </button>
                <span className="mt-2 text-sm text-gray-600">Camera</span>
              </div>
              {/* Documents */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="p-4 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                >
                  <FileText size={28} />
                </button>
                <span className="mt-2 text-sm text-gray-600">Documents</span>
              </div>
              {/* Gallery */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="p-4 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
                >
                  <ImageIcon size={28} />
                </button>
                <span className="mt-2 text-sm text-gray-600">Gallery</span>
              </div>
            </div>

            {/* Hidden file inputs for programmatic click */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,image/*"
            />
            <input
              type="file"
              ref={cameraInputRef}
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*"
              capture="user"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
