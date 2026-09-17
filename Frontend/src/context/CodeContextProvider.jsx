import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { authContext } from "./AuthContextProvider";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export const codeContext = createContext();

const CodeContextProvider = ({ children }) => {
  const { user } = useContext(authContext);

  // ================== State ==================
  const [socket, setSocket] = useState(null);
  const [userName, setUserName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [lang, setLang] = useState("plaintext");
  const [theme, setTheme] = useState("vs-dark");
  const [localCode, setLocalCode] = useState("Hello, welcome to CodeLIVE");
  const [editorInstance, setEditorInstance] = useState(null);

  const [userMessages, setUserMessages] = useState([]);
  const [connctionMsg, setConnctionMsg] = useState({ successMsg: "", errorMsg: "" });
  const [totalUser, setTotalUser] = useState(0);
  const [isUserJoined, setIsUserJoined] = useState(false);
  const [userLists, setUserLists] = useState({ creator: "", created_at: "", users: [] });

  // Yjs
  const [ydoc] = useState(new Y.Doc());
  const [yProvider, setYProvider] = useState(null);
  const [yText, setYText] = useState(null);

  const SOCKET_URL = import.meta.env.VITE_API_URL;
  // Auto-detect ws:// vs wss:// based on page protocol (HTTPS requires wss://)
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const YJS_URL = `${wsProtocol}//${import.meta.env.VITE_YJS_WS_URL}/yjs`;

  // ================== Username Setup ==================
  useEffect(() => {
    setUserName(user ? user.username : `Guest-${Math.floor(1000 + Math.random() * 9000)}`);
  }, [user]);

  // ================== Socket.IO Setup ==================
  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      path: "/socket.io/",
      transports: ["polling", "websocket"],
      upgrade: true,
      timeout: 20000,
      forceNew: true
    });
    setSocket(socketInstance);

    socketInstance.on("connect_error", (error) => {
      console.error("❌ Socket.IO Connection Error:", error);
    });

    socketInstance.on("validateConnection", (message) =>
      setConnctionMsg((prev) => ({ ...prev, successMsg: message }))
    );

    socketInstance.on("RoomCreationSuccess", ({ success, message }) =>
      setConnctionMsg((prev) => ({ ...prev, [success ? "successMsg" : "errorMsg"]: message }))
    );

    socketInstance.on("userJoined", (msg) =>
      setConnctionMsg((prev) => ({ ...prev, successMsg: msg }))
    );

    socketInstance.on("userJoinSuccess", (msg) => {
      setIsUserJoined(true);
      localStorage.setItem("isJoined", "true");
      setConnctionMsg((prev) => ({ ...prev, successMsg: msg }));
    });

    socketInstance.on("userLeavedRoom", () => {
      localStorage.setItem("isJoined", "false");
      setIsUserJoined(false);
    });

    socketInstance.on("successMessage", (msg) =>
      setConnctionMsg((prev) => ({ ...prev, successMsg: msg }))
    );

    socketInstance.on("errorMessage", (msg) =>
      setConnctionMsg((prev) => ({ ...prev, errorMsg: msg }))
    );

    socketInstance.on("countTotalUser", (count) => setTotalUser(count));

    socketInstance.on("msgFromServer", ({ name, message }) =>
      setUserMessages((prev) => [...prev, { sender: name, local: 0, msg: message }])
    );

    socketInstance.on("seeAllUsers", (response) => {
      if (response && response.success) {
        setUserLists({
          creator: response.created_by,
          created_at: response.created_at,
          users: response.users,
        });
      }
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // ================== Yjs Setup (Dynamic per room) ==================
  useEffect(() => {
    if (!roomCode) {
      return;
    }

    // Cleanup previous provider if switching rooms
    if (yProvider) {
      yProvider.destroy();
    }

    try {
      // Create a new WebSocket provider for the room
      const provider = new WebsocketProvider(`${YJS_URL}?room=${roomCode}`, roomCode, ydoc);
      const textType = ydoc.getText("monaco");

      setYProvider(provider);
      setYText(textType);

      // Update localCode whenever Yjs text changes
      textType.observe(() => setLocalCode(textType.toString()));

    } catch (error) {
      console.error("❌ Error setting up Yjs:", error);
    }

    // Cleanup on unmount or room change
    return () => {
      if (yProvider) {
        yProvider.destroy();
      }
    };
  }, [roomCode, ydoc]);

  // ================== Room Management ==================
  const handleRoomCreation = async (roomCode) => {
    if (!roomCode) return false;

    try {
      const response = await fetch(`${SOCKET_URL}/api/create-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId: roomCode, name: userName || "Guest" }),
      });
      const data = await response.json();
      console.log(data);

      if (data.success) {
        console.log(`Room created successfully! You can now join it.`);
        return true;
      } else {
        console.log(`Failed to create room: ${data.message}`);
        return false;
      }
    } catch {
      console.log("Error creating room. Please try again.");
      return false;
    }
  };

  const handleRoomJoining = (roomCode) => {
    if (!roomCode) {
      console.warn("Room code missing");
      return false;
    }

    try {
      localStorage.setItem("roomId", roomCode);
      localStorage.setItem("username", userName || "Guest");
      setRoomCode(roomCode);

      socket?.emit("joinRoom", { name: userName, roomCode });
      return true;
    } catch (err) {
      console.error("Failed to join room:", err);
      return false;
    }
  };

  const handleRoomLeaving = (roomCode) => {
    socket?.emit("leaveRoom", { name: userName, roomCode });
    setRoomCode("");
    setIsUserJoined(false);
  };

  const getAllUsersByRoomId = (roomId) => {
    socket?.emit("getAllUser", roomId);
  };

  // ================== Chat Handling ==================
  const handleLocalMessageToServer = (message) => {
    if (isUserJoined && roomCode) {
      socket?.emit("msgFromClient", { roomCode, name: userName, msg: message });
    }
  };

  // ================== Context Value ==================
  const value = {
    // editor
    localCode,
    lang,
    theme,
    setLang,
    setTheme,
    setLocalCode,
    editorInstance,
    setEditorInstance,

    // socket + room
    socket,
    roomCode,
    totalUser,
    isUserJoined,
    userName,
    userLists,
    connctionMsg,
    userMessages,
    setRoomCode,

    // handlers
    handleRoomCreation,
    handleRoomJoining,
    handleRoomLeaving,
    handleLocalMessageToServer,
    setUserMessages,
    getAllUsersByRoomId,

    // Yjs
    ydoc,
    yProvider,
    yText,
  };

  return <codeContext.Provider value={value}>{children}</codeContext.Provider>;
};

export default CodeContextProvider;

