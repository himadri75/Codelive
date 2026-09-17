const {
  joinRoom,
  totalUsersAtRoom,
  leaveRoom,
  deleteRoom,
  getRoomIdFromUserId,
  getAllUsersById,
} = require("../config/DBFunctions");

// -------------------- JOIN ROOM --------------------
const joinRoomController = async (io, socket, name, roomId) => {
  try {
    const result = await joinRoom(roomId, socket.id, name);

    if (!result.success) {
      socket.emit("errorMessage", result.message);
      return;
    }

    socket.join(roomId);
    socket.emit("userJoinSuccess", "You joined the Room");

    const userCount = await totalUsersAtRoom(roomId);
    if (userCount.success) {
      io.to(roomId).emit("countTotalUser", userCount.count);
    }

    // Notify others
    socket.to(roomId).emit("userJoined", `${name} joined the Room.`);

    getAllUsersController(io, socket, roomId);
  } catch (error) {
    socket.emit("errorMessage", "Error joining room.");
  }
};

// -------------------- LEAVE ROOM --------------------
const leaveRoomController = async (io, socket, name, roomId) => {
  try {
    // Leave the room and remove from database
    socket.leave(roomId);
    await leaveRoom(roomId, socket.id);

    // Notify the user they left successfully
    socket.emit("userLeavedRoom", { success: true });

    // Check if room should be deleted (no users left)
    const response = await deleteRoom(roomId);

    if (response.success) {
      // Room was deleted (no users left)
      socket.emit("successMessage", "The room was deleted!");
      return;
    }

    // Room still has users, update everyone
    const result = await totalUsersAtRoom(roomId);
    if (result.success) {
      io.to(roomId).emit("countTotalUser", result.count);
    }

    // Notify others that user left
    socket.to(roomId).emit("successMessage", `${name} left the room`);

    // Update the user list for remaining users in the room
    getAllUsersController(io, socket, roomId);
  } catch (error) {
    console.log(`❌ Error leaving room: ${error.message}`);
  }
};

// -------------------- GET ALL USERS --------------------
const getAllUsersController = async (io, socket, roomId) => {
  try {
    const response = await getAllUsersById(roomId);

    if (!response || !response.success) {
      return;
    }

    console.log(response);

    // Emit to all users in the room (including the requester)
    io.to(roomId).emit("seeAllUsers", response);
  } catch (error) {
    console.log(`❌ Error fetching all users: ${error.message}`);
  }
};

// -------------------- HANDLE DISCONNECT --------------------
const handleUserDisconnect = async (io, socket) => {
  try {
    // Find the room the user was in
    const room = await getRoomIdFromUserId(socket.id);
    if (!room.success) {
      return;
    }

    // Handle leaving the room
    await leaveRoomController(io, socket, room.name, room.roomId);
  } catch (error) {
    console.log(`❌ Error handling disconnect: ${error.message}`);
  }
};

// -------------------- EXPORTS --------------------
module.exports = {
  joinRoomController,
  leaveRoomController,
  getAllUsersController,
  handleUserDisconnect,
};
