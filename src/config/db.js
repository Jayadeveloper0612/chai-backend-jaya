import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async (req, res) => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(
      `\n MongoDB Connected !! DB HOST: ${connectionInstance.connection.host}`
        .bgGreen.black
    );
  } catch (error) {
    console.log(`MongoDB Connection Error : ${error}`.bgRed.white.italic);
    process.exit(1);
  }
};

export default connectDB;
