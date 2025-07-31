"use client";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { CiLocationArrow1 } from "react-icons/ci";

const socket = io("https://messenger-server-po5n.onrender.com/"); // Singleton socket

const Chat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userList, setUserList] = useState([]);
  const [otherUserId, setOtherUserId] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const user = JSON.parse(localStorage.getItem("user"));
      const res = await fetch(
        `https://messenger-server-po5n.onrender.com/users/${user._id}`
      );
      const users = await res.json();
      setUserList(users); // all other users
    };

    fetchUsers();
  }, []);
  console.log("userList", userList);

  // 1. Get userId from localStorage on client side only
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setCurrentUserId(parsedUser._id);
    }
  }, []);

  useEffect(() => {
    socket.emit("register", currentUserId);

    const handleReceiveMessage = ({ senderId, message }) => {
      setMessages((prev) => [...prev, { senderId, message }]);
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
    };
  }, [currentUserId]);

  const handleMessage = () => {
    if (input.trim()) {
      socket.emit("send-message", {
        senderId: currentUserId,
        receiverId: otherUserId,
        message: input,
      });
      setMessages((prev) => [
        ...prev,
        { senderId: currentUserId, message: input },
      ]);
      setInput("");
    }
  };

  // 4. Prevent UI render until user ID is loaded
  if (!currentUserId) return <p className="p-4">Loading chat...</p>;

  return (
    <div className="flex gap-2  h-screen">
      <div className="flex justify-between items-center p-4 bg-gray-200 border-r-2 border-gray-300">
        <h1 className="text-xl font-bold">Chat</h1>
        <select
          className="border rounded p-2"
          onChange={(e) => setOtherUserId(e.target.value)}
        >
          {userList.map((user) => (
            <option key={user._id} value={user._id}>
              {user.firstName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 bg-white border-r-2 border-gray-300 h-screen overflow-y-auto justify-end">
        <div className=" h-[calc(100vh-100px)] flex flex-col gap-2 p-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent:
                  msg.senderId === currentUserId ? "flex-end" : "flex-start",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "12px",
                  maxWidth: "300px",
                  backgroundColor:
                    msg.senderId === currentUserId ? "#3B82F6" : "#E5E7EB",
                  color: msg.senderId === currentUserId ? "#FFFFFF" : "#111827",
                  fontSize: "14px",
                }}
              >
                <strong>
                  {msg.senderId === currentUserId ? "Me" : msg.senderId}:
                </strong>{" "}
                {msg.message}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4 py-6 justify-center">
          <div className="border-1 border-gray-300/60 rounded">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full py-2 px-4"
            />
          </div>

          <button
            onClick={handleMessage}
            className="bg-black text-white rounded-md px-4 "
          >
            <CiLocationArrow1 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
export default Chat;
