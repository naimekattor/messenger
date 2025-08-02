"use client";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { CiLocationArrow1 } from "react-icons/ci";
import { HiMenuAlt2, HiX } from "react-icons/hi";

const socket = io("https://messenger-server-po5n.onrender.com");

const Chat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userList, setUserList] = useState([]);
  const [otherUserId, setOtherUserId] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [typingUserId, setTypingUserId] = useState(null);

  const getUserById = (id) => userList.find((user) => user._id === id);

  useEffect(() => {
    const fetchUsers = async () => {
      const user = JSON.parse(localStorage.getItem("user"));
      const res = await fetch(
        `https://messenger-server-po5n.onrender.com/users/${user._id}`
      );
      const users = await res.json();
      setUserList(users);
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setCurrentUserId(parsedUser._id);
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    socket.emit("register", currentUserId);

    const handleReceiveMessage = ({ senderId, message, timeStamp }) => {
      const serverTime = new Date().toISOString();
      const finalTimeStamp = timeStamp || serverTime;
      setMessages((prev) => [
        ...prev,
        { senderId, message, timeStamp: finalTimeStamp },
      ]);
    };

    const handleTyping = ({ senderId }) => {
      setTypingUserId(senderId);
      console.log(`User ${senderId} is typing...`);

      setTimeout(() => setTypingUserId(null), 2000);
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("typing", handleTyping);
    return () => socket.off("receive-message", handleReceiveMessage);
  }, [currentUserId]);

  const handleMessage = () => {
    if (input.trim() && otherUserId) {
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
    }
  };

  const handleTyping = () => {
    socket.emit("typing", { senderId: currentUserId, receiverId: otherUserId });
  };

  console.log(messages);

  if (!currentUserId) return <p className="p-4">Loading chat...</p>;

  return (
    <div className="flex h-screen overflow-hidden relative">
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
          <div className="flex flex-col gap-3">
            {userList.map((user) => (
              <div
                key={user._id}
                onClick={() => {
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
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                    <div className="text-xs text-white mt-1">
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
          {typingUserId === otherUserId && (
            <div className="text-sm text-gray-500 italic">Typing...</div>
          )}
        </div>

        {/* Input Box */}
        <div className="p-4 flex items-center gap-2 border-t">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
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
      </div>
    </div>
  );
};

export default Chat;
