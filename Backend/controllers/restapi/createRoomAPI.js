// controllers/roomController.js
const { createNewRoom } = require("../../config/DBFunctions");

const createRoomAPI = async (req, res) => {
  try {
    const { roomId, name } = req.body;
    const response = await createNewRoom(roomId, name);

    if (response.success) {
      console.log(`✅ Room created by ${name}: ${roomId}`);
      return res.status(200).json({ success: true, message: "Room Created." });
    } else {
      console.log(`⚠️ Failed to create room: ${response.message}`);
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error(`❌ Room creation failed: ${error.message}`);
    return res
      .status(500)
      .json({ success: false, message: "Room creation failed." });
  }
};

module.exports = { createRoomAPI };

