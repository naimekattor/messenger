"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Send, Menu, X, Search, MoreHorizontal, Mic } from "lucide-react";
import {
  Camera,
  FileText,
  ImageIcon,
  Paperclip,
  Download,
  File,
  Phone,
  Video,
  Settings,
} from "lucide-react";

// Initialize socket outside component to prevent reconnections
let socket = null;

const Chat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userList, setUserList] = useState([]);
  const [filteredUserList, setFilteredUserList] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [otherUserId, setOtherUserId] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [mediaStream, setMediaStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showRecordingUI, setShowRecordingUI] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const getUserById = (id) => userList.find((user) => user._id === id);

  // Initialize socket connection
  useEffect(() => {
    if (!socket) {
      console.log("🔌 Initializing socket connection...");
      socket = io("http://localhost:4000/", {
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
    };
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      const user = JSON.parse(localStorage.getItem("user"));
      console.log("👤 User from localStorage:", user);
      if (!user || !user._id) {
        console.error("❌ No user found in localStorage");
        return;
      }

      try {
        const res = await fetch(`http://localhost:4000/users/${user._id}`);
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
    socket.emit("register", currentUserId);
    console.log("📡 Emitted register event:", currentUserId);

    socket.off("receive-message");
    socket.off("typing");
    socket.off("stop-typing");

    const handleReceiveMessage = ({
      senderId,
      message,
      timeStamp,
      messageType,
      fileUrl,
      downloadUrl,
      fileName,
      isDocument,
    }) => {
      console.log("📨 Received message:", {
        senderId,
        message,
        timeStamp,
        messageType,
        fileUrl,
        downloadUrl,
        fileName,
      });

      const serverTime = new Date().toISOString();
      const finalTimeStamp = timeStamp || serverTime;

      setMessages((prev) => [
        ...prev,
        {
          senderId,
          message,
          timeStamp: finalTimeStamp,
          messageType: messageType || "text",
          fileUrl,
          downloadUrl,
          fileName,
          isDocument,
        },
      ]);

      if (senderId === otherUserId) {
        console.log("🛑 Stopping typing indicator - message received");
        setIsTyping(false);
        setTypingUser(null);
      }
    };

    const handleTyping = ({ senderId }) => {
      if (senderId === otherUserId) {
        console.log("✅ SETTING TYPING TO TRUE");
        setIsTyping(true);
        setTypingUser(senderId);
      }
    };

    const handleStopTyping = ({ senderId }) => {
      console.log("  - senderId:", senderId);
      if (senderId === otherUserId) {
        console.log("✅ SETTING TYPING TO FALSE");
        setIsTyping(false);
        setTypingUser(null);
      }
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);

    console.log("✅ Socket listeners registered");

    return () => {
      console.log("🧹 Cleaning up socket listeners");
      if (socket) {
        socket.off("receive-message", handleReceiveMessage);
        socket.off("typing", handleTyping);
        socket.off("stop-typing", handleStopTyping);
      }
    };
  }, [currentUserId, otherUserId, socketConnected]);

  useEffect(() => {
    console.log("🔄 Switching chat to user:", otherUserId);
    setIsTyping(false);
    setTypingUser(null);
    setMessages([]);
  }, [otherUserId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });
    }
  }, [messages]);

  useEffect(() => {
    const fetchMessages = async () => {
      const res = await fetch(
        `http://localhost:4000/messages/${currentUserId}/${otherUserId}`
      );
      const data = await res.json();
      setMessages(data); // render in chat UI
      console.log(data);
    };
    fetchMessages();
  }, [otherUserId]);

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      console.log("📤 Uploading file:", file.name);

      const response = await fetch("http://localhost:4000/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("✅ File uploaded successfully:", data);

      return {
        fileUrl: data.url,
        downloadUrl: data.downloadUrl || data.url,
        fileName: data.originalName || file.name,
        fileSize: data.fileSize || file.size,
        fileType: data.fileType || file.type,
        isDocument: data.isDocument || false,
      };
    } catch (error) {
      console.error("❌ File upload error:", error);
      alert("Failed to upload file. Please try again.");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleMessage = () => {
    if (!input.trim() || !otherUserId || !socket) {
      console.log("❌ Cannot send message - missing requirements");
      return;
    }
    setRecentChats((prev) =>
      prev.includes(otherUserId) ? prev : [...prev, otherUserId]
    );

    console.log("📤 Sending text message:", {
      senderId: currentUserId,
      receiverId: otherUserId,
      message: input,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socket.emit("stop-typing", {
      senderId: currentUserId,
      receiverId: otherUserId,
    });

    socket.emit("send-message", {
      senderId: currentUserId,
      receiverId: otherUserId,
      message: input,
      messageType: "text",
    });

    setMessages((prev) => [
      ...prev,
      {
        senderId: currentUserId,
        message: input,
        timeStamp: new Date().toISOString(),
        messageType: "text",
      },
    ]);

    setInput("");
  };

  const handleFileMessage = async (fileData) => {
    if (!otherUserId || !socket || !fileData) {
      console.log("❌ Cannot send file message - missing requirements");
      return;
    }
    setRecentChats((prev) =>
      prev.includes(otherUserId) ? prev : [...prev, otherUserId]
    );

    console.log("📤 Sending file message:", {
      senderId: currentUserId,
      receiverId: otherUserId,
      fileUrl: fileData.fileUrl,
      fileName: fileData.fileName,
    });

    let messageType = "file";
    if (fileData.fileType?.startsWith("image/")) {
      messageType = "image";
    }

    socket.emit("send-message", {
      senderId: currentUserId,
      receiverId: otherUserId,
      message: fileData.fileName,
      messageType: messageType,
      fileUrl: fileData.fileUrl,
      downloadUrl: fileData.downloadUrl,
      fileName: fileData.fileName,
      isDocument: fileData.isDocument,
      fileType: fileData.fileType,
    });

    setMessages((prev) => [
      ...prev,
      {
        senderId: currentUserId,
        message: fileData.fileName,
        timeStamp: new Date().toISOString(),
        messageType: messageType,
        fileUrl: fileData.fileUrl,
        downloadUrl: fileData.downloadUrl,
        fileName: fileData.fileName,
        isDocument: fileData.isDocument,
      },
    ]);
  };

  const handleTyping = () => {
    if (!otherUserId || !currentUserId || !socket || !socketConnected) {
      console.log("❌ Cannot emit typing - missing requirements");
      return;
    }

    const typingData = {
      senderId: currentUserId,
      receiverId: otherUserId,
    };

    socket.emit("typing", typingData);
    console.log("📡 Typing event emitted:", typingData);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      console.log("⏰ Timeout - emitting stop-typing");
      socket.emit("stop-typing", {
        senderId: currentUserId,
        receiverId: otherUserId,
      });
    }, 3000);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleMessage();
    }
  };

  const handleFileSelect = async (event, type) => {
    const file = event.target.files[0];
    console.log("📁 File selected:", file);

    if (file) {
      setIsModalOpen(false);
      const fileData = await uploadFile(file);
      if (fileData) {
        await handleFileMessage(fileData);
      }
    }

    event.target.value = "";
  };

  const getFileExtension = (fileName) => {
    return fileName.split(".").pop().toUpperCase();
  };

  const isImageFile = (messageType, fileName) => {
    if (messageType === "image") return true;
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return imageExtensions.includes(extension);
  };

  const renderMessageContent = (msg) => {
    const {
      messageType,
      fileUrl,
      downloadUrl,
      fileName,
      message,
      isDocument,
      text,
    } = msg;

    // Handle Audio Messages
    if (messageType === "audio" && fileUrl) {
      return (
        <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg border border-white/20">
          <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
            <div className="w-6 h-6 flex items-center justify-center">🎵</div>
          </div>
          <div className="flex-1 min-w-0">
            <audio
              controls
              className="w-full max-w-xs"
              preload="metadata"
              style={{
                height: "32px",
                filter:
                  "sepia(20%) saturate(70%) grayscale(1) contrast(99%) invert(12%)",
              }}
            >
              <source src={fileUrl} type="audio/webm" />
              <source src={fileUrl} type="audio/wav" />
              <source src={fileUrl} type="audio/mp3" />
              Your browser does not support the audio element.
            </audio>
            <p className="text-xs opacity-75 mt-1">Voice message</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = downloadUrl || fileUrl;
                link.download = fileName || "voice-message.webm";
                link.target = "_blank";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex-shrink-0 p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Download audio"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      );
    }
    // Handle Image Messages
    else if (messageType === "image" || isImageFile(messageType, fileName)) {
      return (
        <div className="space-y-2">
          <img
            src={fileUrl || "/placeholder.svg"}
            alt={fileName}
            className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(fileUrl, "_blank")}
            style={{ maxHeight: "200px", objectFit: "cover" }}
          />
          {fileName && <p className="text-xs opacity-75">{fileName}</p>}
        </div>
      );
    }
    // Handle File Messages
    else if (messageType === "file" && fileUrl) {
      const isPdf = fileName?.toLowerCase().endsWith(".pdf");
      const urlToUse = downloadUrl || fileUrl;

      return (
        <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg border border-white/20">
          <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
            <File size={20} className="text-current" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {fileName || "Unknown file"}
            </p>
            <p className="text-xs opacity-75">
              {getFileExtension(fileName || "")}
            </p>
          </div>
          <div className="flex gap-1">
            {isPdf && (
              <button
                onClick={() => window.open(fileUrl, "_blank")}
                className="flex-shrink-0 p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="View PDF"
              >
                👁️
              </button>
            )}
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = urlToUse;
                link.download = fileName || "download";
                link.target = "_blank";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex-shrink-0 p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Download file"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      );
    }
    // Handle Text Messages
    else {
      return <span>{text || message}</span>;
    }
  };

  // handleSearch by name and email
  const handleSearch = (e) => {
    const input = e.target.value.toLowerCase();
    if (!input) {
      setFilteredUserList([]);
      return;
    }

    const filteredData = userList.filter(
      (user) =>
        (user.email && user.email.toLowerCase().includes(input)) ||
        (user.firstName && user.firstName.toLowerCase().includes(input))
    );
    setFilteredUserList(filteredData);
    console.log(filteredData);

    console.log(input);
  };

  console.log("Current otherUserId:", otherUserId);

  // Voice Recording in Browser
  // const startRecording = async () => {
  //   try {
  //     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  //     const recorder = new MediaRecorder(stream);
  //     const chunks = [];
  //     recorder.ondataavailable = (e) => chunks.push(e.data);
  //     recorder.onstop = () => {
  //       const blob = new Blob(chunks, { type: "audio/webm" });
  //       setAudioBlob(blob);
  //       setShowRecordingUI(true);
  //     };
  //     recorder.start();
  //     setMediaRecorder(recorder);
  //     setIsRecording(true);
  //   } catch (err) {
  //     alert(
  //       "Microphone access denied. Please allow permission to record audio."
  //     );
  //     console.error(err);
  //   }
  // };
  // const stopRecording = () => {
  //   if (mediaRecorder && isRecording) {
  //     mediaRecorder.stop();
  //     setIsRecording(false);
  //   }
  // };

  //Updated recording functions that mimic Teams behavior

  const startRecording = async () => {
    try {
      // Stop any existing stream first
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      // Teams-like audio constraints - much more aggressive processing
      const constraints = {
        audio: {
          // Device selection (prefer communications device like Teams)
          deviceId: "communications", // This is what Teams typically uses

          // Essential audio processing (like Teams)
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,

          // Advanced constraints for professional quality
          sampleRate: 48000, // Higher sample rate like Teams
          sampleSize: 16,
          channelCount: 1, // Mono like Teams calls

          // Volume and gain settings
          volume: 1.0,

          // Browser-specific optimizations (Chrome/Edge like Teams)
          googEchoCancellation: true,
          googEchoCancellation2: true,
          googAutoGainControl: true,
          googAutoGainControl2: true,
          googNoiseSuppression: true,
          googNoiseSuppression2: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false,

          // Additional Teams-like settings
          googAGC: true,
          googAEC: true,
          googNS: true,
          googDAEchoCancellation: true,
        },
      };

      console.log("🎤 Starting Teams-like recording...");

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Log what we actually got
      const audioTrack = stream.getAudioTracks()[0];
      console.log("✅ Audio track created:", audioTrack.label);
      console.log("📊 Track settings:", audioTrack.getSettings());

      // Verify audio processing is enabled
      const settings = audioTrack.getSettings();
      console.log("🔧 Audio processing status:");
      console.log("- Echo Cancellation:", settings.echoCancellation);
      console.log("- Noise Suppression:", settings.noiseSuppression);
      console.log("- Auto Gain Control:", settings.autoGainControl);
      console.log("- Sample Rate:", settings.sampleRate);

      setMediaStream(stream);

      // Use the same codec that Teams uses
      let mimeType = "audio/webm;codecs=opus";

      // Fallback mime types if opus not supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.log("Opus not supported, trying alternatives...");
        const alternatives = ["audio/webm", "audio/mp4", "audio/wav"];

        for (const type of alternatives) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            console.log("Using fallback:", type);
            break;
          }
        }
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000, // Same as Teams quality
      });

      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          console.log("📦 Audio chunk:", e.data.size, "bytes");
        }
      };

      recorder.onstop = async () => {
        console.log("⏹️ Recording stopped");

        // Stop all tracks
        stream.getTracks().forEach((track) => {
          track.stop();
          console.log("🛑 Stopped track:", track.kind);
        });

        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          console.log(
            "✅ Audio blob created:",
            blob.size,
            "bytes, type:",
            blob.type
          );

          // Additional processing to ensure quality
          if (blob.size < 1000) {
            // Less than 1KB probably means no audio
            console.error("❌ Audio blob too small, likely no audio recorded");
            alert(
              "No audio detected. Please speak closer to the microphone and try again."
            );
            return;
          }

          setAudioBlob(blob);
          setShowRecordingUI(true);
        } else {
          console.error("❌ No audio chunks recorded");
          alert(
            "Recording failed. Please check your microphone and try again."
          );
        }

        setMediaStream(null);
      };

      recorder.onerror = (e) => {
        console.error("❌ MediaRecorder error:", e.error);
        stream.getTracks().forEach((track) => track.stop());
        alert("Recording error: " + e.error.message);
      };

      // Start recording with smaller chunks for better processing
      recorder.start(500); // 500ms chunks like Teams
      setMediaRecorder(recorder);
      setIsRecording(true);

      console.log("🚀 Recording started successfully with Teams-like settings");
    } catch (err) {
      console.error("❌ Recording failed:", err);

      if (err.name === "NotAllowedError") {
        alert(
          "Microphone permission denied. Please allow access and refresh the page."
        );
      } else if (err.name === "NotFoundError") {
        alert("No microphone found. Please connect a microphone.");
      } else if (err.name === "OverconstrainedError") {
        console.log("⚠️ Constraints too strict, trying basic recording...");

        // Fallback to basic recording like Teams does
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          // Continue with basic setup...
          console.log("✅ Fallback recording started");
          // ... rest of recording logic with basicStream
        } catch (basicErr) {
          alert("Failed to start recording: " + basicErr.message);
        }
      } else {
        alert("Microphone error: " + err.message);
      }
    }
  };

  // Enhanced stop recording
  const stopRecording = () => {
    console.log("🛑 Stopping recording...");

    if (mediaRecorder && isRecording) {
      // Set a timeout to ensure we get some audio data
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 10000);

      setIsRecording(false);

      // Stop stream tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => {
          track.stop();
          console.log("🔇 Track stopped:", track.kind);
        });
      }
    }
  };

  // Debug function to compare with Teams
  const debugAudioCapabilities = async () => {
    try {
      console.log("🔍 Audio capabilities debug:");

      // Check supported mime types
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/wav",
      ];

      console.log("📋 Supported formats:");
      mimeTypes.forEach((type) => {
        console.log(`- ${type}: ${MediaRecorder.isTypeSupported(type)}`);
      });

      // Test with Teams-like constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: "communications",
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      const track = stream.getAudioTracks()[0];
      console.log("🎯 Teams-like settings achieved:");
      console.log(track.getSettings());

      // Cleanup
      stream.getTracks().forEach((t) => t.stop());
    } catch (error) {
      console.error("Debug failed:", error);
    }
  };

  // Call this once to see what your browser supports
  // debugAudioCapabilities();

  const sendAudioMessage = async () => {
    if (!audioBlob) return;
    setShowRecordingUI(false);

    const file = new window.File([audioBlob], "voice-message.webm", {
      type: audioBlob.type,
    });
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:4000/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    console.log(data);

    // Send message to backend
    socket.emit("send-message", {
      senderId: currentUserId,
      receiverId: otherUserId,
      message: "Voice message",
      messageType: "audio",
      fileUrl: data.url,
      fileName: "voice-message.webm",
      fileType: audioBlob.type,
    });

    setMessages((prev) => [
      ...prev,
      {
        senderId: currentUserId,
        message: "Voice message",
        timeStamp: new Date().toISOString(),
        messageType: "audio",
        fileUrl: data.url,
        fileName: "voice-message.webm",
      },
    ]);
    setAudioBlob(null);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 left-4 z-30 md:hidden bg-white p-2 rounded-lg shadow-lg border"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed md:static top-0 left-0 h-full w-80 bg-white border-r border-gray-200 z-20 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 shadow-lg md:shadow-none`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Teams Chat</h1>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <Search size={18} className="text-white" />
              </button>
              <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <MoreHorizontal size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Connection Status */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                socketConnected ? "bg-green-400" : "bg-red-400"
              }`}
            ></div>
            <span className="text-sm text-white/90">
              {socketConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              onChange={handleSearch}
              placeholder="Search people..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {filteredUserList.length > 0 && (
          <div className="flex-1 overflow-y-auto h-[400px]">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Serch Result
              </h3>

              <div className="space-y-1 overflow-y-auto">
                {filteredUserList.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => {
                      console.log(
                        "👤 Selected user:",
                        user._id,
                        user.firstName
                      );
                      setOtherUserId(user._id);
                      setIsSidebarOpen(false);
                      setRecentChats((prev) =>
                        prev.includes(user._id) ? prev : [...prev, user._id]
                      );
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                      otherUserId === user._id
                        ? "bg-purple-50 border-l-4 border-purple-500"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={
                          user.image_url ||
                          "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png" ||
                          "/placeholder.svg"
                        }
                        alt="User"
                        className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {user.firstName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        Available
                      </p>
                    </div>
                    {otherUserId === user._id && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="flex-1 overflow-y-auto h-[600px]">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Recent Chats
            </h3>

            <div className="space-y-1">
              {userList
                .filter((user) => recentChats.includes(user._id))
                .map((user) => (
                  <div
                    key={user._id}
                    onClick={() => {
                      setOtherUserId(user._id);
                      setIsSidebarOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                      otherUserId === user._id
                        ? "bg-purple-50 border-l-4 border-purple-500"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={
                          user.image_url ||
                          "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png" ||
                          "/placeholder.svg"
                        }
                        alt="User"
                        className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {user.firstName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        Available
                      </p>
                    </div>
                    {otherUserId === user._id && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-white">
        {/* Chat Header */}
        {otherUserId && (
          <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const user = getUserById(otherUserId);
                  return (
                    <>
                      <div className="relative">
                        <img
                          src={
                            user?.image_url ||
                            "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png" ||
                            "/placeholder.svg"
                          }
                          alt="User"
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">
                          {user?.firstName}
                        </h3>
                        {isTyping ? (
                          <p className="text-sm text-purple-600 animate-pulse font-medium">
                            typing...
                          </p>
                        ) : (
                          <p className="text-sm text-green-600">Active now</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Phone size={20} className="text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Video size={20} className="text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Settings size={20} className="text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 bg-gray-50"
          style={{ height: "calc(100vh - 140px)" }}
        >
          {!otherUserId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-12 h-12 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome to Teams Chat
              </h3>
              <p className="text-gray-500 max-w-md">
                Select a person from the sidebar to start a conversation. Stay
                connected with your team!
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => {
              const isMe = msg.senderId === currentUserId;
              const user = getUserById(msg.senderId);

              return (
                <div
                  key={i}
                  className={`flex gap-3 items-start ${
                    isMe ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isMe && (
                    <div className="w-10 h-10 flex-shrink-0">
                      {user?.image_url ? (
                        <img
                          src={user.image_url || "/placeholder.svg"}
                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                          alt="avatar"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                          {user?.firstName?.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                      isMe
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                        : "bg-white text-gray-800 border border-gray-200"
                    }`}
                  >
                    {renderMessageContent(msg)}
                    {msg.timeStamp && (
                      <div
                        className={`text-xs mt-2 ${
                          isMe ? "text-purple-100" : "text-gray-500"
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

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3 items-start justify-start">
                <div className="w-10 h-10 flex-shrink-0">
                  {(() => {
                    const user = getUserById(typingUser);
                    return user?.image_url ? (
                      <img
                        src={user.image_url || "/placeholder.svg"}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                        alt="avatar"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                        {user?.firstName?.charAt(0).toUpperCase() || "U"}
                      </div>
                    );
                  })()}
                </div>
                <div className="bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {showRecordingUI && (
          <div className="flex items-center gap-4 p-4 bg-white border rounded-xl shadow mb-2">
            {/* Sound wave animation */}
            <div className="flex gap-1 items-center">
              <div className="w-2 h-6 bg-purple-400 animate-pulse"></div>
              <div className="w-2 h-4 bg-purple-300 animate-pulse"></div>
              <div className="w-2 h-8 bg-purple-500 animate-pulse"></div>
              <div className="w-2 h-5 bg-purple-300 animate-pulse"></div>
              <div className="w-2 h-7 bg-purple-400 animate-pulse"></div>
            </div>
            <button
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg shadow hover:from-purple-700 hover:to-blue-700"
              onClick={sendAudioMessage}
            >
              Send
            </button>
            <button
              className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg ml-2"
              onClick={() => {
                setShowRecordingUI(false);
                setAudioBlob(null);
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Message Input */}
        {otherUserId && (
          <div className="p-4 border-t border-gray-200 bg-white ">
            <div className="flex items-center justify-between">
              <div className="flex flex-1 items-center gap-3 bg-gray-50 rounded-2xl p-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  disabled={isUploading}
                  className={`p-3 rounded-xl transition-all duration-200 ${
                    isUploading
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-purple-600 hover:bg-purple-100"
                  }`}
                  aria-label="Upload file"
                >
                  <Paperclip size={20} />
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
                  className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-gray-800 placeholder-gray-500"
                  disabled={isUploading}
                />

                <button
                  onClick={handleMessage}
                  disabled={!input.trim() || isUploading}
                  className={`p-3 rounded-xl transition-all duration-200 ${
                    input.trim() && !isUploading
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <Send size={18} />
                </button>
              </div>
              <button
                className="bg-blue-600 text-white p-2 rounded-full"
                onClick={isRecording ? stopRecording : startRecording}
              >
                <Mic />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* File Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-bold mb-8 text-center text-gray-900">
              Share Files
            </h3>

            <div className="grid grid-cols-3 gap-6">
              {/* Camera */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => cameraInputRef.current.click()}
                  disabled={isUploading}
                  className={`w-16 h-16 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                    isUploading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105"
                  }`}
                >
                  <Camera size={24} />
                </button>
                <span className="mt-3 text-sm font-medium text-gray-700">
                  Camera
                </span>
              </div>

              {/* Documents */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => fileInputRef.current.click()}
                  disabled={isUploading}
                  className={`w-16 h-16 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                    isUploading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transform hover:scale-105"
                  }`}
                >
                  <FileText size={24} />
                </button>
                <span className="mt-3 text-sm font-medium text-gray-700">
                  Documents
                </span>
              </div>

              {/* Gallery */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => fileInputRef.current.click()}
                  disabled={isUploading}
                  className={`w-16 h-16 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                    isUploading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-105"
                  }`}
                >
                  <ImageIcon size={24} />
                </button>
                <span className="mt-3 text-sm font-medium text-gray-700">
                  Gallery
                </span>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-3 text-purple-600">
                  <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium">Uploading file...</span>
                </div>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => handleFileSelect(e, "file")}
              accept=".pdf,.doc,.docx,.txt,image/*"
              disabled={isUploading}
            />
            <input
              type="file"
              ref={cameraInputRef}
              className="hidden"
              onChange={(e) => handleFileSelect(e, "camera")}
              accept="image/*"
              capture="user"
              disabled={isUploading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
