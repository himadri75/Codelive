const { getCurrentTime } = require("../utils/currentTime");
const { redisClient } = require("./redis");

/*
Redis structure:

room:{roomId}
  created_by
  created_at

room:{roomId}:users
  Set of userIds

user:{userId}:room
  roomId
  name

room:{roomId}:user:{userId}
  userId
  name
  joined_at
*/


const isRoomExists = async (roomId) => {
  return (await redisClient.exists(`room:${roomId}`)) === 1;
};

// Create a new room
const createNewRoom = async (roomId, createdBy) => {
  if (!createdBy) {
    createdBy = "Guest_" + Math.floor(Math.random() * 900 + 100);
  }

  const roomKey = `room:${roomId}`;

  // Prevent duplicate rooms
  const exists = await redisClient.exists(roomKey);

  if (exists) {
    return {
      success: false,
      message: "Room already exists.",
    };
  }

  await redisClient.hSet(roomKey, {
    created_by: createdBy,
    created_at: getCurrentTime(),
  });

  return {
    success: true,
    message: "Room successfully created.",
  };
};


// Join a room
const joinRoom = async (roomId, userId, name) => {
  if (!(await isRoomExists(roomId))) {
    return {
      success: false,
      message: "Room does not exist.",
    };
  }

  const roomUsersKey = `room:${roomId}:users`;
  const userRoomKey = `user:${userId}:room`;
  const userInfoKey = `room:${roomId}:user:${userId}`;

  // Check if user is already in this room
  const alreadyInRoom = await redisClient.sIsMember(
    roomUsersKey,
    userId
  );

  if (alreadyInRoom) {
    return {
      success: false,
      message: "User already in room.",
    };
  }

  // Optional: prevent a user from joining multiple rooms
  const existingUserRoom = await redisClient.hGet(
    userRoomKey,
    "roomId"
  );

  if (existingUserRoom) {
    return {
      success: false,
      message: "User is already in another room.",
    };
  }

  const joinedAt = getCurrentTime();

  // Add user to room
  await redisClient.sAdd(roomUsersKey, userId);

  // Store user's room information
  await redisClient.hSet(userRoomKey, {
    roomId,
    name: name || "",
  });

  // Store user information specific to this room
  await redisClient.hSet(userInfoKey, {
    userId,
    name: name || "",
    joined_at: joinedAt,
  });

  return {
    success: true,
    message: "User successfully joined the room.",
  };
};


// Get room information from user ID
const getRoomIdFromUserId = async (userId) => {
  const userRoomKey = `user:${userId}:room`;

  const info = await redisClient.hGetAll(userRoomKey);

  if (!info || !info.roomId) {
    return {
      success: false,
      message: "RoomId not found.",
    };
  }

  return {
    success: true,
    roomId: info.roomId,
    name: info.name,
  };
};


// Get total users in a room
const totalUsersAtRoom = async (roomId) => {
  if (!(await isRoomExists(roomId))) {
    return {
      success: false,
      message: "Room does not exist.",
    };
  }

  const count = await redisClient.sCard(`room:${roomId}:users`);

  return {
    success: true,
    count,
  };
};


// Leave a room
const leaveRoom = async (roomId, userId) => {
  if (!(await isRoomExists(roomId))) {
    return {
      success: false,
      message: "Room does not exist.",
    };
  }

  const roomUsersKey = `room:${roomId}:users`;
  const userRoomKey = `user:${userId}:room`;
  const userInfoKey = `room:${roomId}:user:${userId}`;

  const isMember = await redisClient.sIsMember(
    roomUsersKey,
    userId
  );

  if (!isMember) {
    return {
      success: false,
      message: "User is not in the room.",
    };
  }

  // Remove user from room
  await redisClient.sRem(roomUsersKey, userId);

  // Remove user's room mapping
  await redisClient.del(userRoomKey);

  // Remove user's room-specific information
  await redisClient.del(userInfoKey);

  return {
    success: true,
    message: "User removed from the room.",
  };
};


// Delete a room
const deleteRoom = async (roomId) => {
  if (!(await isRoomExists(roomId))) {
    return {
      success: false,
      message: "Room does not exist.",
    };
  }

  const roomUsersKey = `room:${roomId}:users`;

  const userCount = await redisClient.sCard(roomUsersKey);

  if (userCount > 0) {
    return {
      success: false,
      message: "Room is not empty.",
    };
  }

  await redisClient.del(
    `room:${roomId}`,
    roomUsersKey
  );

  return {
    success: true,
    message: "Room deleted.",
  };
};


// Get all users in a room
const getAllUsersById = async (roomId) => {
  const roomKey = `room:${roomId}`;

  const roomInfo = await redisClient.hGetAll(roomKey);

  if (!roomInfo || !roomInfo.created_by) {
    return {
      success: false,
      message: "Room not found.",
    };
  }

  const userIds = await redisClient.sMembers(
    `room:${roomId}:users`
  );

  const users = await Promise.all(
    userIds.map(async (userId) => {
      const userInfo = await redisClient.hGetAll(
        `room:${roomId}:user:${userId}`
      );

      return {
        userId,
        name: userInfo.name || "",
        joined_at: userInfo.joined_at || null,
      };
    })
  );

  return {
    success: true,
    created_by: roomInfo.created_by,
    created_at: roomInfo.created_at,
    users,
  };
};


module.exports = {
  createNewRoom,
  joinRoom,
  totalUsersAtRoom,
  leaveRoom,
  deleteRoom,
  getRoomIdFromUserId,
  getAllUsersById,
};